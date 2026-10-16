import { MAKER } from "@/lib/site";

// The last line of every page: who built the app, with a link to their GitHub. It opens in a
// new tab, so the app (installed full screen, it has no back button) stays where it was.
export function SiteCredit() {
  return (
    <footer className="px-4 py-4 text-center text-xs text-neutral-500">
      Built by {MAKER.name} ·{" "}
      <a
        href={MAKER.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-10 items-center font-medium underline-offset-2 hover:text-neutral-700 hover:underline dark:hover:text-neutral-300"
      >
        GitHub @{MAKER.github}
      </a>
    </footer>
  );
}
