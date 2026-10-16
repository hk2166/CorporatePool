import type { Metadata } from "next";
import Link from "next/link";
import { PolicySection, PublicPage } from "@/components/public-page";
import { LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy · CorporatePool",
  description:
    "What CorporatePool stores about you, who sees it, and how to delete it.",
};

// The privacy policy, in plain language, matching what the app actually does (the access
// rules in supabase/migrations and docs/lld.md). Change it when they change.
export default function PrivacyPage() {
  return (
    <PublicPage>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 pt-6 pb-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Privacy policy
          </h1>
          <p className="text-sm text-neutral-500">
            Last updated {LEGAL_UPDATED}
          </p>
          <p className="text-neutral-700 dark:text-neutral-300">
            CorporatePool helps people who drive to work share their empty seats
            with people going the same way. This page explains what we store
            about you, who can see it, and how to delete it. We don&apos;t sell
            your data, we don&apos;t show ads, and we don&apos;t use any outside
            analytics or tracking tools.
          </p>
        </header>

        <PolicySection title="What we store">
          <p>
            <strong>From your Google account</strong>, when you sign in: your
            name, email address and profile photo. We don&apos;t get your Google
            password or access to anything else in your Google account.
          </p>
          <p>
            <strong>What you add:</strong>
          </p>
          <ul>
            <li>your mobile number (needed to book or offer rides);</li>
            <li>
              optionally, your gender (only to allow women-only rides) and a UPI
              ID (so riders can pay you);
            </li>
            <li>your usual home and work stops;</li>
            <li>
              if you drive: your car&apos;s model, colour, number plate, seats
              and photos, and your usual route, departure time and price.
            </li>
          </ul>
          <p>
            <strong>What the app records as you use it:</strong> the rides you
            offer, the seats you request and what happened to them (confirmed,
            waitlisted, cancelled, completed or missed), your reliability score
            and the events behind it, reports you file, people you block, the
            days you open the app (just the date, to count daily users; not
            times or pages), and, if you turn on notifications, the browser
            address notifications are sent to.
          </p>
          <p>
            <strong>If you ask to join</strong> without an invite link: your
            name, email address and photo from Google, and the note you write.
            The group&apos;s admins see them to decide. If you&apos;re turned
            down, we keep the request so the decision sticks; email us (below)
            to have it deleted.
          </p>
          <p>
            <strong>Cookies:</strong> one sign-in cookie that keeps you logged
            in. Your browser also remembers a few settings on your device, such
            as whether you dismissed the install prompt.
          </p>
        </PolicySection>

        <PolicySection title="Who can see what">
          <ul>
            <li>
              <strong>Other members</strong> see your name and photo, the rides
              you offer (route, times, seats left, price) and your car&apos;s
              model and colour.
            </li>
            <li>
              <strong>Your phone number and UPI ID</strong> are shown only to
              the other person in a confirmed booking (the driver and the
              rider), until a day after the ride.
            </li>
            <li>
              <strong>Your number plate and car photos</strong> are shown only
              to riders with a confirmed seat in your car.
            </li>
            <li>
              <strong>Anyone with a ride&apos;s share link</strong>, without
              signing in, sees that ride&apos;s route, time, price, seats left
              and the driver&apos;s first name. Nothing that identifies or
              contacts anyone.
            </li>
            <li>
              <strong>Your reliability score and its history</strong> are
              visible to you and to your group&apos;s admins.
            </li>
            <li>
              <strong>Your group&apos;s admins</strong> can also see your email
              address and phone number, your usual stops, car and usual ride,
              the rides you offer and seats you ask for, the days you used the
              app, and reports about you. They use this only to run the group:
              to see how it&apos;s used, sort out problems, and remove members
              who break the rules.
            </li>
            <li>
              <strong>Blocks</strong> are visible only to the person who made
              them.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="How we use it">
          <ul>
            <li>
              to match riders with cars going their way, and run bookings;
            </li>
            <li>
              to hand out seats fairly: when seats are short, riders with a
              better reliability record get them first;
            </li>
            <li>
              to send you notifications you turned on (seat confirmed,
              reminders, ride changes);
            </li>
            <li>
              to let admins run the group and keep it safe (usage numbers,
              reports, removals).
            </li>
          </ul>
          <p>
            CorporatePool never handles money. &ldquo;Pay by UPI&rdquo; only
            opens your own UPI app with the driver&apos;s UPI ID and the amount
            filled in.
          </p>
        </PolicySection>

        <PolicySection title="Services we rely on">
          <ul>
            <li>
              <strong>Google</strong>, for signing in.
            </li>
            <li>
              <strong>Supabase</strong>, which stores the data and runs sign-in
              sessions.
            </li>
            <li>
              <strong>Vercel</strong>, which hosts the app.
            </li>
            <li>
              Your browser&apos;s <strong>push service</strong> (from Google,
              Apple or Mozilla, depending on the browser), which delivers
              notifications if you turn them on.
            </li>
          </ul>
          <p>
            They process data only to provide those services. We don&apos;t
            share your data with anyone else, unless the law requires it.
          </p>
        </PolicySection>

        <PolicySection title="Keeping and deleting your data">
          <p>
            Your data stays while your account exists. You can delete your
            account at any time from your Profile page (after cancelling any
            upcoming rides or seats). Deleting it removes your name, photo,
            phone number, gender, UPI ID, saved stops, car photos and number
            plate, notification settings and blocks, and your Google sign-in
            link. Past rides stay in other people&apos;s history under
            &ldquo;Deleted user&rdquo;, so their records still make sense, but
            they no longer point to you.
          </p>
          <p>
            You can see and change your details on your Profile page at any
            time, and your reliability history on the Reliability page.
          </p>
        </PolicySection>

        <PolicySection title="Contact">
          <p>
            Questions, or a request about your data:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>
            . If this policy changes, the date at the top changes. See also our{" "}
            <Link href="/terms" className="underline">
              terms
            </Link>
            .
          </p>
        </PolicySection>
      </main>
    </PublicPage>
  );
}
