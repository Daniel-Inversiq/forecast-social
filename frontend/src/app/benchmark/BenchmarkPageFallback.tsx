import Link from "next/link";
import { FeedShell } from "@/components/feed/FeedShell";

/** Static shell shown while benchmark client tree suspends (useSearchParams). */
export function BenchmarkPageFallback() {
  return (
    <FeedShell>
      <div className="max-w-2xl mx-auto space-y-4 pb-14 pt-1">
        <nav className="flex items-center gap-2 text-[10px] text-zinc-600">
          <Link href="/" className="hover:text-zinc-400 transition">
            Feed
          </Link>
          <span>/</span>
          <Link href="/leaderboards" className="hover:text-zinc-400 transition">
            Rankings
          </Link>
          <span>/</span>
          <span className="text-zinc-500">Benchmark</span>
        </nav>

        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-zinc-950/90 to-zinc-950 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
            <p className="text-[10px] uppercase tracking-wider text-violet-400/80">
              Loading benchmark
            </p>
          </div>
          <div className="h-6 w-48 rounded-md bg-zinc-800/80 animate-pulse mb-4" />
          <div className="space-y-2.5">
            <div className="h-28 rounded-xl bg-zinc-900/70 animate-pulse border border-zinc-800/60" />
            <div className="h-52 rounded-xl bg-zinc-900/70 animate-pulse border border-zinc-800/60" />
          </div>
        </div>
      </div>
    </FeedShell>
  );
}
