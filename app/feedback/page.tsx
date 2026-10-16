import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import {
  arrangeFeedback,
  FEEDBACK_SORTS,
  feedbackSort,
  KIND_LABEL,
  STATUS_LABEL,
} from "@/lib/feedback";
import { dayLabel, indiaDate } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./feedback-form";
import { VoteButton } from "./vote-button";

export const metadata: Metadata = { title: "Feedback · CorporatePool" };

export default function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Tell us what isn&apos;t working or what you&apos;d like next, and
            upvote the ideas you want most. The most wanted get looked at first.
            Other members see what you write, but not that it was you.
          </p>
        </div>
        <FeedbackForm />
        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <FeedbackList searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

// Everything members have sent: what's still open (most wanted or newest first), then what's
// done or not planned.
async function FeedbackList({
  searchParams,
}: {
  searchParams: PageProps<"/feedback">["searchParams"];
}) {
  const [params] = await Promise.all([searchParams, getCurrentUser()]);
  const sort = feedbackSort(params.sort);
  const supabase = await createClient();
  const { data: items, error } = await supabase.rpc("list_feedback");
  if (error) return <p role="alert">Couldn&apos;t load the feedback.</p>;
  const { open, closed } = arrangeFeedback(items, sort);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Open <span className="text-neutral-500">({open.length})</span>
          </h2>
          <nav aria-label="Order" className="flex gap-1">
            {FEEDBACK_SORTS.map((s) => (
              <Link
                key={s.key}
                href={`/feedback?sort=${s.key}`}
                aria-current={s.key === sort ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-sm whitespace-nowrap ${
                  s.key === sort
                    ? "border-neutral-900 font-medium dark:border-white"
                    : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
        {open.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nothing yet. Be the first to send an idea.
          </p>
        )}
        <ul className="space-y-3">
          {open.map((f) => (
            <li
              key={f.id}
              className="flex gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <VoteButton
                id={f.id}
                title={f.title}
                votes={f.votes}
                voted={f.voted}
              />
              <Details item={f} />
            </li>
          ))}
        </ul>
      </section>

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Done or not planned</h2>
          <ul className="space-y-3">
            {closed.map((f) => (
              <li
                key={f.id}
                className="flex gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <span className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-500 tabular-nums dark:bg-neutral-800">
                  <span aria-hidden className="text-xs leading-none">
                    ▲
                  </span>
                  {f.votes}
                </span>
                <Details item={f} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Details({
  item: f,
}: {
  item: {
    kind: string;
    title: string;
    details: string | null;
    status: string;
    admin_reply: string | null;
    created_at: string;
    mine: boolean;
  };
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <p className="font-medium break-words">{f.title}</p>
      <p className="text-xs text-neutral-500">
        {KIND_LABEL[f.kind]} · {dayLabel(indiaDate(new Date(f.created_at)))}
        {f.mine && " · yours"}
        {f.status !== "OPEN" && (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 font-medium ${
              f.status === "DECLINED"
                ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
            }`}
          >
            {STATUS_LABEL[f.status]}
          </span>
        )}
      </p>
      {f.details && (
        <p className="text-sm break-words whitespace-pre-line text-neutral-700 dark:text-neutral-300">
          {f.details}
        </p>
      )}
      {f.admin_reply && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm break-words whitespace-pre-line dark:bg-neutral-900">
          <span className="font-medium">Admin:</span> {f.admin_reply}
        </p>
      )}
    </div>
  );
}
