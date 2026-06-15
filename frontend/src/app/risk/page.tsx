import Link from "next/link";

export default function RiskDisclosurePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Risk Disclosure</h1>
        <p className="text-sm text-zinc-400">
          SCRY is an opinion and forecasting product. It does not provide financial advice.
        </p>
        <ul className="space-y-1 text-sm text-zinc-500">
          <li>Forecasts are opinions, not financial advice.</li>
          <li>Past forecasting performance does not guarantee future results.</li>
          <li>Users are responsible for their own decisions.</li>
          <li>Positions shown in beta are simulated and do not represent real-money execution.</li>
        </ul>
        <Link href="/" className="inline-block text-sm text-violet-400 hover:text-violet-300">
          Back to SCRY
        </Link>
      </div>
    </main>
  );
}
