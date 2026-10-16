"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  cleanName,
  isUpiId,
  normalizeIndianMobile,
} from "@/lib/profile-fields";
import { createClient } from "@/lib/supabase/server";

export type ProfileField =
  "name" | "phone" | "upi" | "upi_qr" | "home" | "work";

export type ProfileFormState = {
  errors: Partial<Record<ProfileField | "form", string>>;
  saved: boolean;
  // What was submitted. React resets a form after its action runs, so the form shows these
  // again instead of losing what the person typed when something needs fixing.
  values?: Partial<Record<ProfileField, string>>;
};

// Saves the signed-in person's profile (F-A2, F-A5, F-A6).
export async function saveProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  // Server Actions can be called by a direct POST, so check who's asking every time.
  const user = await getCurrentUser();
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const errors: ProfileFormState["errors"] = {};
  const values = {
    name: text("name"),
    phone: text("phone"),
    upi: text("upi"),
    home: text("home"),
    work: text("work"),
  };

  const name = cleanName(text("name"));
  if (!name) errors.name = "Enter your name (up to 80 characters).";

  // Required: it's how riders and owners reach each other once a seat is confirmed (F-A2).
  const phone = normalizeIndianMobile(text("phone"));
  if (!phone) errors.phone = "Enter a 10-digit Indian mobile number.";

  // Optional: only car owners need it, for the Pay by UPI button (F-A5).
  const upi = text("upi");
  if (upi && !isUpiId(upi)) errors.upi = "A UPI ID looks like name@okaxis.";

  // Optional, owners only: their UPI QR code, already uploaded into their own folder of the
  // payment-qr bucket. Riders' forms don't have it: leave theirs as it was.
  const upiQr = formData.has("upi_qr") ? text("upi_qr") || null : undefined;
  if (upiQr && !qrPathOf(user.id).test(upiQr)) {
    errors.upi_qr = "The QR code couldn't be saved. Please add it again.";
  }

  const home = text("home") || null;
  const work = text("work") || null;
  if (home && work && home === work) {
    errors.work = "Your office can't be the same stop as your home.";
  }

  // (The name and phone checks repeat the ones above so TypeScript knows they're set.)
  if (Object.keys(errors).length > 0 || !name || !phone) {
    return { errors, saved: false, values };
  }

  // As the signed-in person: the access rules (T-1.3) only let them change these columns of
  // their own row.
  const supabase = await createClient();
  // The QR code saved before, so its file can go once a new one (or none) is saved.
  const { data: before } =
    upiQr === undefined
      ? { data: null }
      : await supabase.rpc("get_my_profile").maybeSingle();
  const { error } = await supabase
    .from("users")
    .update({
      name,
      phone,
      // Riders' forms have no UPI field: leave theirs as it was.
      ...(formData.has("upi") ? { upi_vpa: upi || null } : {}),
      ...(upiQr === undefined ? {} : { upi_qr_path: upiQr }),
      home_place_id: home,
      work_place_id: work,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return {
        errors: { phone: "Another member already uses this number." },
        saved: false,
        values,
      };
    }
    if (error.code === "23503") {
      return {
        errors: {
          form: "One of those stops no longer exists. Please pick again.",
        },
        saved: false,
        values,
      };
    }
    return {
      errors: { form: "Couldn't save. Please try again." },
      saved: false,
      values,
    };
  }

  // Best effort: a file left behind is only wasted space, never visible to anyone.
  if (before?.upi_qr_path && before.upi_qr_path !== upiQr) {
    await supabase.storage.from("payment-qr").remove([before.upi_qr_path]);
  }

  // New members finishing sign-up go on to the app.
  // Drivers go on to their car and rides; everyone else to the app.
  if (formData.get("welcome") === "1") {
    redirect(
      user.ridePreference === "DRIVER" || user.ridePreference === "BOTH"
        ? "/car?welcome=1"
        : "/",
    );
  }
  return { errors: {}, saved: true };
}

// <the person's id>/<random id>.jpg, as the QR field names its uploads.
function qrPathOf(userId: string): RegExp {
  return new RegExp(`^${userId}/[0-9a-f-]{36}\\.jpg$`);
}
