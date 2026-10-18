import type { Metadata } from "next";
import Link from "next/link";
import { PolicySection, PublicPage } from "@/components/public-page";
import { LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service · CorporatePool",
  description: "The rules for using CorporatePool, for riders and drivers.",
};

// The terms of service, in plain language, matching how the app works (docs/features.md,
// docs/lld.md). Change them when the rules change.
export default function TermsPage() {
  return (
    <PublicPage>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 pt-6 pb-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Terms of service
          </h1>
          <p className="text-sm text-neutral-500">
            Last updated {LEGAL_UPDATED}
          </p>
          <p className="text-neutral-700 dark:text-neutral-300">
            By using CorporatePool you agree to these terms. They&apos;re short
            and in plain language; please read them.
          </p>
        </header>

        <PolicySection title="What CorporatePool is">
          <p>
            CorporatePool is a free tool that helps members of a commuting group
            share rides to work: people who drive anyway offer their empty
            seats, and people going the same way book them and share the cost.
          </p>
          <p>
            CorporatePool is not a taxi or transport company. It doesn&apos;t
            provide rides, employ or vet drivers, or take any part in payments.
            Each ride is an arrangement between the driver and the riders.
          </p>
        </PolicySection>

        <PolicySection title="Your account">
          <ul>
            <li>You must be at least 18.</li>
            <li>
              You sign in with your Google account and join a group through an
              invite link from its admin, or by asking to join and being
              accepted by an admin.
            </li>
            <li>
              Keep your details accurate, including a mobile number you answer:
              the people in your car will call you on it.
            </li>
            <li>One account per person, and don&apos;t share it.</li>
          </ul>
        </PolicySection>

        <PolicySection title="If you drive">
          <ul>
            <li>
              Hold a valid driving licence, and keep your car roadworthy,
              insured and legal for carrying passengers.
            </li>
            <li>
              Offer seats only on trips you&apos;re making anyway. The price is
              a share of your costs, not a fare for profit.
            </li>
            <li>
              Drive safely and follow traffic laws. You&apos;re responsible for
              your car and your driving.
            </li>
            <li>
              Cancel as early as you can. Cancelling a booked ride after 10 pm
              the evening before lowers your reliability score.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="If you ride">
          <ul>
            <li>Be at your pickup stop on time.</li>
            <li>
              Pay the driver the agreed share directly, by UPI or cash.
              CorporatePool doesn&apos;t collect or refund money.
            </li>
            <li>
              Cancel as early as you can. Not turning up, or cancelling a
              confirmed seat late, lowers your reliability score.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Reliability and fair seats">
          <p>
            Free seats go to whoever asks first, and the app moves riders who
            are waiting into other cars with room. The score goes up with
            completed rides and down with no-shows and late cancellations; the
            exact rules are shown to every member in the app. A driver marks who
            turned up. If you think a mark is wrong, tell your group admin.
          </p>
        </PolicySection>

        <PolicySection title="Behaviour">
          <ul>
            <li>
              Be respectful. No harassment, discrimination, threats or unsafe
              behaviour, and no fake rides or accounts.
            </li>
            <li>
              Use phone numbers and other details you see only to arrange the
              ride.
            </li>
            <li>
              You can report or block anyone. A group&apos;s admins can hide
              rides and remove members who break these terms.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Safety and responsibility">
          <p>
            Riding with someone is your own decision. Members are checked only
            through their Google sign-in and their group&apos;s invite, not
            vetted further. CorporatePool is provided free and &ldquo;as
            is&rdquo;, without guarantees that it will always be available or
            error-free. As far as the law allows, CorporatePool and the people
            who run it aren&apos;t liable for what happens on a ride, between
            members, or because the app was unavailable.
          </p>
        </PolicySection>

        <PolicySection title="Ending, and changes">
          <p>
            You can stop using CorporatePool and delete your account at any time
            from your Profile page. We may change these terms or the app; when
            the terms change, the date at the top changes, and continuing to use
            the app means you accept the new terms.
          </p>
        </PolicySection>

        <PolicySection title="Contact">
          <p>
            Questions about these terms:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>
            . How we handle your data is in the{" "}
            <Link href="/privacy" className="underline">
              privacy policy
            </Link>
            .
          </p>
        </PolicySection>
      </main>
    </PublicPage>
  );
}
