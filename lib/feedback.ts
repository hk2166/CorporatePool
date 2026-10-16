// Feedback (app/feedback, app/admin/feedback): what members asked for, in order.

export const KIND_LABEL: Record<string, string> = {
  IDEA: "Idea",
  PROBLEM: "Problem",
};

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  PLANNED: "Planned",
  DONE: "Done",
  DECLINED: "Not planned",
};

export const FEEDBACK_SORTS = [
  { key: "top", label: "Most wanted" },
  { key: "new", label: "Newest" },
] as const;
export type FeedbackSort = (typeof FEEDBACK_SORTS)[number]["key"];

export function feedbackSort(
  value: string | string[] | undefined,
): FeedbackSort {
  return value === "new" ? "new" : "top";
}

type Item = { status: string; votes: number; created_at: string };

// Items still taking votes (open or planned), in the chosen order, and the finished ones (done
// or not planned), newest first. "Most wanted" breaks ties by the newest.
export function arrangeFeedback<T extends Item>(
  items: readonly T[],
  sort: FeedbackSort,
): { open: T[]; closed: T[] } {
  const newest = (a: T, b: T) => b.created_at.localeCompare(a.created_at);
  const live = (i: T) => i.status === "OPEN" || i.status === "PLANNED";
  return {
    open: items
      .filter(live)
      .sort(
        sort === "top" ? (a, b) => b.votes - a.votes || newest(a, b) : newest,
      ),
    closed: items.filter((i) => !live(i)).sort(newest),
  };
}
