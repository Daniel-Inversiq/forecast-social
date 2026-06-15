import { StaticPlaceholderPage } from "@/components/static/StaticPlaceholderPage";

export default function PrivacyPage() {
  return (
    <StaticPlaceholderPage
      title="Privacy Policy"
      subtitle="How SCRY handles user data."
      badge="Draft — not legal advice."
    >
      <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-4 space-y-3 text-[13px] text-zinc-400 leading-relaxed">
        <p>
          This privacy policy is a placeholder draft for the SCRY beta. It is not a final legal
          document. We will publish an updated policy before broader release.
        </p>
        <p>
          SCRY may collect account information you provide (such as email and profile details),
          usage data needed to operate the product, and forecasting activity visible on the
          platform (forecasts, battles, receipts, and reputation signals).
        </p>
        <p>
          We use this information to authenticate users, deliver core features, improve reliability,
          and display public forecasting history in context. We do not sell personal data in this
          placeholder draft. Data retention and third-party processors will be described in the
          final policy.
        </p>
        <p>
          For privacy questions during beta, contact{" "}
          <a
            href="mailto:support@tryscry.com"
            className="text-zinc-300 hover:text-zinc-100 transition underline underline-offset-2"
          >
            support@tryscry.com
          </a>
          .
        </p>
      </div>
    </StaticPlaceholderPage>
  );
}
