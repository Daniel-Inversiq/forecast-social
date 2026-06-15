import { StaticPlaceholderPage } from "@/components/static/StaticPlaceholderPage";

const SECTIONS = [
  { title: "Getting started" },
  { title: "Account access" },
  { title: "Forecasting basics" },
];

export default function HelpPage() {
  return (
    <StaticPlaceholderPage
      title="Help Center"
      subtitle="Need help using SCRY?"
      sections={SECTIONS}
      sectionsLabel="Help topics"
    >
      <p className="text-[13px] text-zinc-500 leading-relaxed">
        Questions? Reach us at{" "}
        <a
          href="mailto:support@tryscry.com"
          className="text-zinc-300 hover:text-zinc-100 transition underline underline-offset-2"
        >
          support@tryscry.com
        </a>
        .
      </p>
    </StaticPlaceholderPage>
  );
}
