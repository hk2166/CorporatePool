import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { arrangeFeedback, KIND_LABEL } from "@/lib/feedback";
import { dayLabel, indiaDate } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { StatusForm } from "./status-form";

export const metadata: Metadata = {
  title: "Feedback · Admin · CorporatePool",
};

export default function AdminFeedbackPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <AdminNav current="/admin/feedback" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Feedback />
        </Suspense>
      </main>
    </>
  );
}

// What members asked for, most votes first, with who sent it. Mark each planned, done or not
// planned, and reply; members see the status and reply on /feedback.
async function Feedback() {
  await getCurrentAdmin();
  const supabase = await createClient();
  const { data: items, error } = await supabase.rpc("list_feedback");
  if (error) return <p role="alert">Couldn&apos;t load the feedback.</p>;
  const { open, closed } = arrangeFeedback(items, "top");
  const votes = items.reduce((n, f) => n + f.votes, 0);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-sm text-neutral-500">
          {items.length} sent, {votes} upvotes. Members see everything here
          except who sent it.{" "}
          <Link href="/feedback" className="underline">
            See it as a member
          </Link>
        </p>
      </section>
      {[
        { title: `Open (${open.length})`, list: open },
        { title: `Done or not planned (${closed.length})`, list: closed },
      ].map(
        (group) =>
          group.list.length > 0 && (
            <section key={group.title} className="space-y-3">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <ol className="space-y-3">
                {group.list.map((f) => (
                  <li
                    key={f.id}
                    className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
                  >
                    <div className="flex gap-3">
                      <span className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-800 tabular-nums dark:bg-emerald-950 dark:text-emerald-200">
                        <span aria-hidden className="text-xs leading-none">
                          ▲
                        </span>
                        {f.votes}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium break-words">{f.title}</p>
                        <p className="text-xs text-neutral-500">
                          {KIND_LABEL[f.kind]} ·{" "}
                          {dayLabel(indiaDate(new Date(f.created_at)))} ·{" "}
                          {f.author_id ? (
                            <Link
                              href={`/admin/members/${f.author_id}`}
                              className="underline"
                            >
                              {f.author_name}
                            </Link>
                          ) : (
                            "a deleted user"
                          )}
                        </p>
                        {f.details && (
                          <p className="text-sm break-words whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                            {f.details}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusForm
                      id={f.id}
                      title={f.title}
                      status={f.status}
                      reply={f.admin_reply}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ),
      )}
      {items.length === 0 && (
        <p className="text-sm text-neutral-500">
          No feedback yet. Members send it from the Feedback page, linked on
          their home page.
        </p>
      )}
    </div>
  );
}
