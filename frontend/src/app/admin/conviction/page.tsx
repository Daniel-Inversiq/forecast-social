"use client";

import { useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { API_BASE, apiFetch } from "@/lib/api";

type DepositRow = {
  id: number;
  user_id: number;
  chain: string;
  status: string;
  amount: number;
  tx_hash: string | null;
};

type WithdrawalRow = {
  id: number;
  user_id: number;
  amount: number;
  chain: string;
  destination_wallet: string;
  status: string;
};

export default function ConvictionAdminPage() {
  const [userId, setUserId] = useState("1");
  const [amount, setAmount] = useState("25");
  const [marketSlug, setMarketSlug] = useState("");
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [ledger, setLedger] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);

  async function creditBalance() {
    setStatus("Crediting user balance...");
    const res = await apiFetch(`/admin/users/${userId}/credit-balance`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(amount), note: "Admin credit" }),
    });
    setStatus(res.ok ? "Balance credited." : "Credit failed.");
  }

  async function resolveMarket() {
    setStatus("Resolving market...");
    const res = await apiFetch(`/markets/${marketSlug}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    });
    setStatus(res.ok ? "Market resolved and payouts settled." : "Resolve failed.");
  }

  async function loadLedger() {
    setStatus("Loading ledger...");
    const res = await fetch(`${API_BASE}/admin/ledger?limit=100`);
    if (!res.ok) {
      setStatus("Ledger load failed.");
      return;
    }
    const data = await res.json();
    setLedger(JSON.stringify(data, null, 2));
    setStatus("Ledger loaded.");
  }

  async function loadExposure() {
    setStatus("Loading exposure concentration...");
    const res = await fetch(`${API_BASE}/admin/exposure-concentration`);
    if (!res.ok) {
      setStatus("Exposure load failed.");
      return;
    }
    const data = await res.json();
    setLedger(JSON.stringify(data, null, 2));
    setStatus("Exposure loaded.");
  }

  async function syncDeposits() {
    setStatus("Syncing Base USDC deposits...");
    const res = await apiFetch("/admin/deposits/sync", { method: "POST" });
    setStatus(res.ok ? "Deposit sync complete." : "Deposit sync failed.");
    await loadDeposits();
  }

  async function loadDeposits() {
    const res = await apiFetch("/admin/deposits");
    if (!res.ok) return;
    setDeposits((await res.json()) as DepositRow[]);
  }

  async function loadWithdrawals() {
    const res = await apiFetch("/admin/withdrawals");
    if (!res.ok) return;
    setWithdrawals((await res.json()) as WithdrawalRow[]);
  }

  async function markSent(id: number) {
    const txHash = window.prompt("Enter on-chain tx hash");
    if (!txHash) return;
    const res = await apiFetch(`/admin/withdrawals/${id}/mark-sent`, {
      method: "POST",
      body: JSON.stringify({ tx_hash: txHash }),
    });
    setStatus(res.ok ? `Withdrawal #${id} marked sent.` : `Failed to mark #${id} sent.`);
    await loadWithdrawals();
  }

  async function rejectWithdrawal(id: number) {
    const reason = window.prompt("Optional rejection note") ?? "";
    const res = await apiFetch(`/admin/withdrawals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note: reason }),
    });
    setStatus(res.ok ? `Withdrawal #${id} rejected.` : `Failed to reject #${id}.`);
    await loadWithdrawals();
  }

  return (
    <FeedShell activeNav="Markets" hideCategoryNav>
      <div className="max-w-4xl space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
          <h1 className="text-sm font-semibold text-white">Conviction Ledger Admin</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Manual alpha controls for crediting balances, settlement, and ledger inspection.{" "}
            <a href="/admin/agents" className="text-violet-400 hover:text-violet-300">
              Agent roster →
            </a>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
            <p className="text-xs text-zinc-300 font-medium">Credit user balance</p>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
            />
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="USDC amount"
            />
            <button className="rounded bg-violet-600 px-3 py-1.5 text-xs" onClick={creditBalance}>
              Credit balance
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
            <p className="text-xs text-zinc-300 font-medium">Resolve market and settle payouts</p>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              value={marketSlug}
              onChange={(e) => setMarketSlug(e.target.value)}
              placeholder="Market slug"
            />
            <div className="flex gap-2">
              <button
                className={`rounded px-3 py-1.5 text-xs ${outcome === "YES" ? "bg-violet-600" : "bg-zinc-800"}`}
                onClick={() => setOutcome("YES")}
              >
                YES
              </button>
              <button
                className={`rounded px-3 py-1.5 text-xs ${outcome === "NO" ? "bg-violet-600" : "bg-zinc-800"}`}
                onClick={() => setOutcome("NO")}
              >
                NO
              </button>
            </div>
            <button className="rounded bg-violet-600 px-3 py-1.5 text-xs" onClick={resolveMarket}>
              Resolve + settle
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-3">
          <div className="flex gap-2">
            <button className="rounded bg-violet-700 px-3 py-1.5 text-xs" onClick={syncDeposits}>
              Sync deposits
            </button>
            <button className="rounded bg-zinc-800 px-3 py-1.5 text-xs" onClick={loadDeposits}>
              Pending deposits
            </button>
            <button className="rounded bg-zinc-800 px-3 py-1.5 text-xs" onClick={loadWithdrawals}>
              Withdrawal queue
            </button>
            <button className="rounded bg-zinc-800 px-3 py-1.5 text-xs" onClick={loadLedger}>
              Inspect ledger
            </button>
            <button className="rounded bg-zinc-800 px-3 py-1.5 text-xs" onClick={loadExposure}>
              Inspect exposure concentration
            </button>
          </div>
          <p className="text-xs text-zinc-500">{status}</p>
          <pre className="max-h-[420px] overflow-auto rounded bg-black/30 p-3 text-[11px] text-zinc-300">
            {ledger || "No data loaded yet."}
          </pre>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
          <p className="text-xs font-medium text-zinc-300">Deposit queue</p>
          {deposits.slice(0, 20).map((d) => (
            <div key={d.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-[11px]">
              #{d.id} · user {d.user_id} · {d.chain} · {d.status} · {d.amount.toFixed(2)} USDC{" "}
              {d.tx_hash ? `· ${d.tx_hash}` : ""}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
          <p className="text-xs font-medium text-zinc-300">Withdrawal queue</p>
          {withdrawals.slice(0, 20).map((w) => (
            <div key={w.id} className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-[11px]">
              #{w.id} · user {w.user_id} · {w.amount.toFixed(2)} USDC · {w.status} · {w.destination_wallet}
              <div className="mt-2 flex gap-2">
                <button className="rounded bg-violet-700 px-2 py-1 text-[10px]" onClick={() => markSent(w.id)}>
                  Mark sent
                </button>
                <button className="rounded bg-zinc-800 px-2 py-1 text-[10px]" onClick={() => rejectWithdrawal(w.id)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeedShell>
  );
}
