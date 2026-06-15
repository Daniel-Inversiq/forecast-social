"use client";

import Link from "next/link";
import { useState } from "react";
import { isWalletStackEnabled } from "@/context/WalletProvider";
import { useWalletActions } from "@/hooks/useWalletActions";

export function WalletConnectButton({
  mode = "login",
  variant = "default",
  className = "",
}: {
  mode?: "login" | "register";
  variant?: "default" | "loginEntry";
  className?: string;
}) {
  if (!isWalletStackEnabled()) return null;
  return <WalletConnectButtonInner mode={mode} variant={variant} className={className} />;
}

function WalletConnectButtonInner({
  mode,
  variant,
  className,
}: {
  mode: "login" | "register";
  variant: "default" | "loginEntry";
  className: string;
}) {
  const { loginWithWallet, registerWithWallet, state, error, connectWallet, hasConnectedWallet } =
    useWalletActions();
  const [username, setUsername] = useState("");
  const [showRegister, setShowRegister] = useState(mode === "register");
  const busy = state === "connecting" || state === "signing" || state === "linking";

  async function handleLogin() {
    try {
      await loginWithWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("not linked") || message.includes("404")) {
        setShowRegister(true);
      }
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    await registerWithWallet(username.trim());
  }

  if (variant === "loginEntry") {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative flex items-center gap-2">
          <div className="flex-1 h-px bg-zinc-800/80" />
          <span className="text-[9px] uppercase tracking-wider text-zinc-600">or</span>
          <div className="flex-1 h-px bg-zinc-800/80" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => handleLogin().catch(() => {})}
          className="w-full text-sm py-2 rounded-lg border border-zinc-700/80 text-zinc-300 hover:border-violet-500/40 hover:text-violet-200 transition disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Connect Wallet"}
        </button>
        <p className="text-center text-[11px] text-zinc-600">
          New to SCRY?{" "}
          <Link
            href="/register"
            className="text-zinc-400 hover:text-violet-300 transition underline-offset-2 hover:underline"
          >
            Join the waitlist →
          </Link>
        </p>

        {error && <p className="text-[11px] text-rose-400 text-center">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">or wallet</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {!showRegister ? (
        <div className="space-y-2">
          {!hasConnectedWallet && (
            <button
              type="button"
              disabled={busy}
              onClick={() => connectWallet().catch(() => {})}
              className="w-full text-sm py-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-violet-500/40 hover:text-violet-200 transition disabled:opacity-50"
            >
              {busy ? "Connecting…" : "Connect wallet"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleLogin()}
            className="w-full text-sm font-medium py-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15 transition disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Sign in with wallet"}
          </button>
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition"
          >
            New to Scry? Register with wallet
          </button>
        </div>
      ) : (
        <form onSubmit={handleRegister} className="space-y-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose username"
            pattern="[a-zA-Z0-9_-]{3,32}"
            required
            className="w-full text-sm px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
          />
          <button
            type="submit"
            disabled={busy || !username.trim()}
            className="w-full text-sm font-medium py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition disabled:opacity-50"
          >
            {busy ? "Creating account…" : "Register with wallet"}
          </button>
          <button
            type="button"
            onClick={() => setShowRegister(false)}
            className="w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition"
          >
            Back to wallet sign in
          </button>
        </form>
      )}

      {error && <p className="text-[11px] text-rose-400 text-center">{error}</p>}
    </div>
  );
}
