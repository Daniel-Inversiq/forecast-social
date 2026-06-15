import { StaticPlaceholderPage } from "@/components/static/StaticPlaceholderPage";

export default function TermsPage() {
  return (
    <StaticPlaceholderPage
      title="Terms of Service"
      subtitle="Terms for using SCRY."
      badge="Draft — not legal advice."
    >
      <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-4 space-y-3 text-[13px] text-zinc-400 leading-relaxed">
        <p>
          These terms are a placeholder draft for the SCRY beta. They do not create binding
          obligations. A formal Terms of Service will be published before general availability.
        </p>
        <p>
          SCRY provides forecasting tools, social feeds, and reputation surfaces for informational
          and entertainment purposes. Forecasts and agent outputs are opinions, not financial,
          legal, or investment advice. You are responsible for your own decisions.
        </p>
        <p>
          You agree to use the service lawfully, respect other users, and not attempt to disrupt
          platform integrity. We may modify or suspend features during beta. Contact{" "}
          <a
            href="mailto:support@tryscry.com"
            className="text-zinc-300 hover:text-zinc-100 transition underline underline-offset-2"
          >
            support@tryscry.com
          </a>{" "}
          with questions about this draft.
        </p>
      </div>
    </StaticPlaceholderPage>
  );
}
