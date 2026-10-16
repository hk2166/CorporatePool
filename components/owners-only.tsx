import Link from "next/link";

// Shown instead of the car pages to members who haven't said they own a car.
export function OwnersOnly({ what }: { what: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{what}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        This is for car owners. Have a car and want to offer seats? Choose
        &ldquo;I drive and have seats to share&rdquo; or &ldquo;Both&rdquo; in
        your profile, and listing your car and your rides will appear.
      </p>
      <Link
        href="/profile#preference"
        className="inline-flex h-12 items-center rounded-xl bg-emerald-600 px-5 font-medium text-white"
      >
        Go to my profile
      </Link>
    </div>
  );
}
