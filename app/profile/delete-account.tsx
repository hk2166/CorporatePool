"use client";

import { useActionState } from "react";
import {
  deleteAccount,
  type DeleteAccountState,
} from "./delete-account-actions";

const initialState: DeleteAccountState = {};

// The last section of the profile page. Collapsed by default, and the button only works
// after typing DELETE, so it can't be tapped by accident.
export function DeleteAccount() {
  const [state, action, pending] = useActionState(deleteAccount, initialState);

  return (
    <details className="group rounded-xl border border-red-200 p-4 dark:border-red-900">
      <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">
        Delete my account
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          This removes your name, photo, phone number, UPI ID, stops and car
          details, and signs you out. Past rides stay in other people&apos;s
          history as &ldquo;Deleted user&rdquo;. It can&apos;t be undone.
        </p>
        <label htmlFor="confirm" className="block text-sm font-medium">
          Type DELETE to confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          autoComplete="off"
          autoCapitalize="characters"
          className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-xl bg-red-600 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </details>
  );
}
