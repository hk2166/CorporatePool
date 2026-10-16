"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = { error?: string };

// Deletes the signed-in person's account (F-A9, T-2.4): personal data goes, the history other
// people's rides depend on stays as "Deleted user" (supabase/migrations/…_account_deletion.sql).
export async function deleteAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") {
    return { error: "Type DELETE to confirm." };
  }

  // getUser() asks Supabase Auth directly: this is irreversible, so don't trust the cookie
  // alone. Server Actions can be called by a direct POST.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: photos, error } = await admin.rpc("anonymise_account", {
    p_user_id: user.id,
  });
  if (error) {
    return {
      error:
        error.hint === "ACTIVE_RIDES"
          ? "Cancel your upcoming rides and seats first, then try again."
          : "Couldn't delete your account. Please try again.",
    };
  }

  // Car photo files: the saved ones, plus anything uploaded but never saved.
  const bucket = admin.storage.from("car-photos");
  const { data: folder } = await bucket.list(user.id, { limit: 1000 });
  const files = new Set([
    ...(photos ?? []),
    ...(folder ?? []).map((file) => `${user.id}/${file.name}`),
  ]);
  if (files.size > 0) await bucket.remove([...files]);

  // The UPI QR code: the file, and the profile's link to it.
  const qrBucket = admin.storage.from("payment-qr");
  const { data: qrFolder } = await qrBucket.list(user.id, { limit: 100 });
  if (qrFolder && qrFolder.length > 0) {
    await qrBucket.remove(qrFolder.map((file) => `${user.id}/${file.name}`));
  }
  await admin.from("users").update({ upi_qr_path: null }).eq("id", user.id);

  // The sign-in account. Deleted outright when nothing points at the person; otherwise (they
  // have ride history) a soft delete, which scrubs the email and Google link so it no longer
  // identifies anyone but keeps the id that history refers to.
  const hard = await admin.auth.admin.deleteUser(user.id);
  if (hard.error) {
    const soft = await admin.auth.admin.deleteUser(user.id, true);
    if (soft.error) {
      return { error: "Couldn't delete your account. Please try again." };
    }
  }

  // The session is no longer valid; just clear the cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=account-deleted");
}
