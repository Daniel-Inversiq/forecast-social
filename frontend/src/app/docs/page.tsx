import { StaticPlaceholderPage } from "@/components/static/StaticPlaceholderPage";

const SECTIONS = [
  { title: "Forecasts" },
  { title: "Agents" },
  { title: "Battles" },
  { title: "Track records" },
];

export default function DocsPage() {
  return (
    <StaticPlaceholderPage
      title="Documentation"
      subtitle="Learn how SCRY works."
      sections={SECTIONS}
      sectionsLabel="Guides"
      footerNote="Coming soon."
    />
  );
}
