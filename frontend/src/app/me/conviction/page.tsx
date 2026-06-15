"use client";

import { useEffect, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { apiFetch } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type ConvictionBalance = {
  available_balance: number;
  locked_balance: number;
  total_exposure: number;
  global_exposure_cap: number;
  remaining_exposure: number;
  currency: string;
  wallet_address: string | null;
  has_verified_wallet: boolean;
};

type LedgerEntry = {
  type: string;
  amount: number;
  currency: string;
  market: string | null;
  created_at: string | null;
  available_balance_after: number;
  locked_balance_after: number;
  total_exposure_after: number;
  metadata?: Record<string, unknown> | null;
};

type ConvictionPosition = {
  market: string;
  side: "YES" | "NO";
  amount: number;
  status: string;
  opened_at: string | null;
  resolved_at: string | null;
  payout_amount: number | null;
  outcome: "YES" | "NO" | null;
  reputation_impact: number | null;
};

type DepositRequest = {
  id: number;
  wallet_address: string;
  chain: string;
  expected_token: string;
  treasury_address: string | null;
  status: string;
  tx_hash: string | null;
  amount: number;
  detected_at: string | null;
  confirmed_at: string | null;
  created_at: string | null;
};

type WithdrawalRequest = {
  id: number;
  amount: number;
  chain: string;
  destination_wallet: string;
  status: string;
  requested_at: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  tx_hash: string | null;
  note?: string | null;
};

export default function ConvictionCapitalPage() {
  const { user, loading: authLoading } = useRequireAuth("/me/conviction");
  const [balance, setBalance] = useState<ConvictionBalance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [openPositions, setOpenPositions] = useState<ConvictionPosition[]>([]);
  const [resolvedPositions, setResolvedPositions] = useState<ConvictionPosition[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("25");
  const [selectedChain, setSelectedChain] = useState("base");
  const [destinationWallet, setDestinationWallet] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [b, l, p, d, w] = await Promise.all([
        apiFetch("/me/conviction-balance"),
        apiFetch("/me/conviction-ledger"),
        apiFetch("/me/conviction-positions"),
        apiFetch("/me/deposits"),
        apiFetch("/me/withdrawals"),
      ]);
      if (b.ok) setBalance((await b.json()) as ConvictionBalance);
      if (l.ok) setLedger((await l.json()) as LedgerEntry[]);
      if (p.ok) {
        const payload = (await p.json()) as {
          open_positions: ConvictionPosition[];
          resolved_positions: ConvictionPosition[];
        };
        setOpenPositions(payload.open_positions ?? []);
        setResolvedPositions(payload.resolved_positions ?? []);
      }
      if (d.ok) setDeposits((await d.json()) as DepositRequest[]);
      if (w.ok) setWithdrawals((await w.json()) as WithdrawalRequest[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    const t = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(t);
  }, [authLoading, user]);

  async function requestDeposit() {
    if (!balance?.has_verified_wallet) {
      setStatus("A verified wallet is required before creating a deposit watch.");
      return;
    }
    setStatus("Creating deposit watch...");
    const res = await apiFetch("/me/deposits/create", {
      method: "POST",
      body: JSON.stringify({
        chain: selectedChain,
      }),
    });
    const detail = await res.json().catch(() => null);
    setStatus(
      res.ok
        ? "Deposit watch created. Send USDC from your verified wallet to treasury."
        : typeof detail?.detail === "string"
          ? detail.detail
          : "Deposit watch creation failed.",
    );
    await loadData();
  }

  async function requestWithdrawal() {
    if (!balance?.has_verified_wallet) {
      setStatus("A verified wallet is required before requesting withdrawal.");
      return;
    }
    if (!destinationWallet) {
      setStatus("Enter a destination wallet address.");
      return;
    }
    setStatus("Submitting withdrawal request...");
    const res = await apiFetch("/me/withdrawals/request", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(withdrawAmount),
        destination_wallet: destinationWallet,
        chain: selectedChain,
      }),
    });
    const detail = await res.json().catch(() => null);
    setStatus(
      res.ok
        ? "Withdrawal request submitted for manual admin processing."
        : typeof detail?.detail === "string"
          ? detail.detail
          : "Withdrawal request failed.",
    );
    await loadData();
  }

  return (
    <FeedShell activeNav="Positions" hideCategoryNav>
      <div className="max-w-5xl space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
          <h1 className="text-base font-semibold text-white">Conviction Capital</h1>
          <p className="mt-1 text-xs text-zinc-500">
            USDC-backed public exposure for your forecasting identity.
          </p>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-500 animate-pulse">Loading Conviction Capital...</p>
        ) : (
          <>
            {balance && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
                <h2 className="text-xs font-semibold text-zinc-200 mb-3">Balance overview</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Cell label="Available USDC balance" value={`${balance.available_balance.toFixed(2)} ${balance.currency}`} />
                  <Cell label="Locked exposure" value={`${balance.locked_balance.toFixed(2)} ${balance.currency}`} />
                  <Cell label="Total public exposure" value={`${balance.total_exposure.toFixed(2)} ${balance.currency}`} />
                </div>
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  <Cell label="Remaining exposure cap" value={`${balance.remaining_exposure.toFixed(2)} ${balance.currency}`} />
                  <Cell label="Global exposure cap" value={`${balance.global_exposure_cap.toFixed(2)} ${balance.currency}`} />
                  <Cell
                    label="Verified wallet status"
                    value={balance.has_verified_wallet ? "Verified" : "Not linked"}
                    sub={balance.wallet_address ?? "Link wallet in Settings"}
                  />
                </div>
              </section>
            )}

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
              <h2 className="text-xs font-semibold text-zinc-200 mb-3">Open conviction exposure</h2>
              {openPositions.length === 0 ? (
                <p className="text-xs text-zinc-500">No open conviction exposure.</p>
              ) : (
                <div className="space-y-2">
                  {openPositions.map((p, i) => (
                    <div key={`${p.market}-${i}`} className="rounded border border-zinc-800 bg-zinc-900/40 p-2.5 text-xs">
                      {p.market} · {p.side} · {p.amount.toFixed(2)} USDC · {p.status}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
              <h2 className="text-xs font-semibold text-zinc-200 mb-3">USDC deposit operations</h2>
              <p className="text-[11px] text-zinc-500 mb-3">
                Base-first USDC treasury detection with transparent confirmation states.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-[11px] text-zinc-400">Chain</label>
                  <select
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                    value={selectedChain}
                    onChange={(e) => setSelectedChain(e.target.value)}
                  >
                    <option value="base">Base</option>
                    <option value="polygon">Polygon</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] text-zinc-400">Treasury address</label>
                  <div className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-300 break-all">
                    {deposits[0]?.treasury_address ?? "Create a deposit watch to load treasury address."}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded bg-violet-600 px-3 py-1.5 text-xs" onClick={requestDeposit}>
                  Create deposit watch
                </button>
                <button
                  className="rounded bg-zinc-800 px-3 py-1.5 text-xs"
                  onClick={async () => {
                    const treasury = deposits[0]?.treasury_address;
                    if (!treasury) return;
                    await navigator.clipboard.writeText(treasury);
                    setStatus("Treasury address copied.");
                  }}
                >
                  Copy treasury
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-zinc-500">Deposit status stream</p>
                {deposits.length === 0 ? (
                  <p className="text-xs text-zinc-500">No deposit watches created yet.</p>
                ) : (
                  deposits.map((d) => (
                    <div key={d.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-[11px]">
                      #{d.id} · {d.chain} · {d.status} · {d.amount.toFixed(2)} USDC {d.tx_hash ? `· ${d.tx_hash}` : ""}
                    </div>
                  ))
                )}
              </div>
              {status && <p className="mt-2 text-[11px] text-zinc-400">{status}</p>}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
              <h2 className="text-xs font-semibold text-zinc-200 mb-3">Withdrawal request</h2>
              <p className="text-[11px] text-zinc-500 mb-3">
                Requests are manually reviewed and sent by admin during this alpha phase.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min={1}
                  placeholder="Amount USDC"
                />
                <input
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                  value={destinationWallet}
                  onChange={(e) => setDestinationWallet(e.target.value)}
                  placeholder="Destination wallet"
                />
                <button className="rounded bg-zinc-800 px-3 py-1.5 text-xs" onClick={requestWithdrawal}>
                  Submit withdrawal
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {withdrawals.length === 0 ? (
                  <p className="text-xs text-zinc-500">No withdrawal requests yet.</p>
                ) : (
                  withdrawals.map((w) => (
                    <div key={w.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-[11px]">
                      #{w.id} · {w.amount.toFixed(2)} USDC · {w.status} · requested {w.requested_at ?? "—"}{" "}
                      {w.completed_at ? `· completed ${w.completed_at}` : ""} {w.tx_hash ? `· ${w.tx_hash}` : ""}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
              <h2 className="text-xs font-semibold text-zinc-200 mb-3">Ledger history</h2>
              <div className="space-y-2">
                {ledger.length === 0 ? (
                  <p className="text-xs text-zinc-500">No ledger activity yet.</p>
                ) : (
                  ledger.map((e, i) => (
                    <div key={`${e.created_at}-${i}`} className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-[11px]">
                      <div className="text-zinc-300">
                        {e.type} · {e.amount.toFixed(2)} {e.currency} {e.market ? `· ${e.market}` : ""}
                      </div>
                      <div className="text-zinc-500">
                        {e.created_at} · avail {e.available_balance_after.toFixed(2)} · locked {e.locked_balance_after.toFixed(2)} · exposure {e.total_exposure_after.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
              <h2 className="text-xs font-semibold text-zinc-200 mb-3">Resolved conviction positions</h2>
              {resolvedPositions.length === 0 ? (
                <p className="text-xs text-zinc-500">No resolved positions yet.</p>
              ) : (
                <div className="space-y-2">
                  {resolvedPositions.map((p, i) => (
                    <div key={`${p.market}-${i}`} className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-[11px]">
                      {p.market} · {p.side} · {p.status} · payout {Number(p.payout_amount ?? 0).toFixed(2)} · outcome {p.outcome ?? "—"} · rep impact {p.reputation_impact ?? "—"}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </FeedShell>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2.5">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-200 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}
