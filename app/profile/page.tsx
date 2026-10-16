import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { DeleteAccount } from "./delete-account";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile · CorporatePool" };

export default function ProfilePage({ searchParams }: PageProps<"/profile">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-64 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <ProfileSection searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function ProfileSection({
  searchParams,
}: {
  searchParams: PageProps<"/profile">["searchParams"];
}) {
  const { welcome } = await searchParams;
  const isWelcome = welcome === "1";
  await getCurrentUser();

  const supabase = await createClient();
  const [{ data: profile }, { data: places }] = await Promise.all([
    supabase.rpc("get_my_profile").single(),
    // In route order (south to north), like the corridor itself.
    supabase.rpc("list_places"),
  ]);
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isWelcome ? "Welcome! One more step" : "Your profile"}
        </h1>
        {isWelcome && (
          <p className="text-neutral-600 dark:text-neutral-400">
            Add your mobile number so the person you ride with can reach you. It
            stays hidden until a seat is confirmed.
          </p>
        )}
      </div>
      <ProfileForm
        welcome={isWelcome}
        places={(places ?? []).map((p) => ({ id: p.id, name: p.name }))}
        profile={{
          name: profile.name,
          phone: profile.phone,
          upiId: profile.upi_vpa,
          homePlaceId: profile.home_place_id,
          workPlaceId: profile.work_place_id,
        }}
      />
      {!isWelcome && (
        <>
          <SignOutButton />
          <DeleteAccount />
        </>
      )}
    </div>
  );
}
