// A plain form POST to /auth/signout: works without JavaScript and can't be triggered by a
// link or a prefetch.
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        Sign out
      </button>
    </form>
  );
}
