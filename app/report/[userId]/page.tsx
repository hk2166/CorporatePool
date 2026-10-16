import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BlockForm, ReportForm } from "./report-forms";

export const metadata: Metadata = { title: "Report or block · CorporatePool" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ReportPage({
  params,
  searchParams,
}: PageProps<"/report/[userId]">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="h-80 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Report params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

// Report someone to the admins, block them, or both (F-F8).
async function Report({
  params,
  searchParams,
}: {
  params: PageProps<"/report/[userId]">["params"];
  searchParams: PageProps<"/report/[userId]">["searchParams"];
}) {
  const [{ userId }, { ride }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!UUID.test(userId) || userId === user.id) notFound();

  const supabase = await createClient();
  const [{ data: person }, { data: block }] = await Promise.all([
    supabase.from("users").select("name").eq("id", userId).maybeSingle(),
    supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", userId)
      .maybeSingle(),
  ]);
  if (!person) notFound();
  const firstName = person.name.split(" ")[0];
  const rideId = typeof ride === "string" && UUID.test(ride) ? ride : undefined;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{person.name}</h1>
      <section className="space-y-3">
        <h2 className="font-semibold">Report to the admins</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          For anything unsafe, rude or dishonest. Admins can remove people from
          CorporatePool.
        </p>
        <ReportForm aboutUser={userId} rideId={rideId} firstName={firstName} />
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Block</h2>
        <BlockForm
          aboutUser={userId}
          firstName={firstName}
          blocked={Boolean(block)}
        />
      </section>
    </div>
  );
}
