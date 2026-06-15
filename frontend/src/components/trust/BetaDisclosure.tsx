"use client";

type BetaDisclosureTone = "default" | "muted";

const baseLines = [
  "Forecasts are opinions, not financial advice.",
  "Past forecasting performance does not guarantee future results.",
  "Users are responsible for their own decisions.",
];

export function BetaDisclosure({
  includePositionSimulation = false,
  includeSubscriptionNote = false,
  tone = "default",
  heading = "Beta disclosure",
  className = "",
}: {
  includePositionSimulation?: boolean;
  includeSubscriptionNote?: boolean;
  tone?: BetaDisclosureTone;
  heading?: string;
  className?: string;
}) {
  const lines = [...baseLines];
  if (includePositionSimulation) {
    lines.push("Positions shown in beta are simulated and do not represent real-money execution.");
  }
  if (includeSubscriptionNote) {
    lines.push("Subscriptions unlock access to a forecaster's content, not guaranteed outcomes.");
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        tone === "muted"
          ? "border-zinc-800/70 bg-zinc-900/35"
          : "border-zinc-700/70 bg-zinc-900/55"
      } ${className}`}
      aria-label="Trust and safety disclosures"
    >
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{heading}</p>
      <ul className="mt-1.5 space-y-1">
        {lines.map((line) => (
          <li key={line} className="text-[11px] leading-relaxed text-zinc-400">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
