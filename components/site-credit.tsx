import { MAKER } from "@/lib/site";

// The last line of every page: who built the app.
export function SiteCredit() {
  return (
    <footer className="px-4 py-4 text-center text-xs text-neutral-500">
      Built by {MAKER.name}
    </footer>
  );
}
