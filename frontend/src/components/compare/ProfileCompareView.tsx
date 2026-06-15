"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AgentFollowButton } from "@/components/agents/AgentFollowButton";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { Avatar, RankMotion } from "@/components/feed/shared";
import { CompareKnowledgeSection } from "@/components/compare/CompareKnowledgeSection";
import {
  credibilityFor,
  buildTrackStatsPair,
  duelBarWidth,
  formatStatValue,
  getCommonBattles,
  getCommonReceiptPairs,
  profileHref,
  rankContextForProfile,
  resolvedCount,
  statDelta,
  statWinner,
  type CompareTrackStat,
  type CommonReceiptPair,
} from "@/components/compare/compareStats";
import { CompareRankStrip } from "@/components/reputation/RankContextDisplay";
import { viewRivalryCta } from "@/lib/forecastRivalryCopy";
import { outcomeIcon, outcomeTone, shortTitle } from "@/components/users/profile/reputation/receiptUi";
import { receiptDetailPath } from "@/lib/receiptIds";
import {
  fetchFollowStatus,
  followAgent,
  unfollowAgent,
} from "@/lib/agentFollow";
import { isAuthRequiredError, redirectToLogin } from "@/lib/authRedirect";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/80 to-transparent" />
      <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500 shrink-0">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/80 to-transparent" />
    </div>
  );
}

function WinnerBadge({ side }: { side: "a" | "b" }) {
  return (
    <span
      className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
        side === "a"
          ? "text-violet-200 border-violet-500/40 bg-violet-500/15"
          : "text-rose-200 border-rose-500/40 bg-rose-500/15"
      }`}
    >
      Lead
    </span>
  );
}

function DuelBar({
  valueA,
  valueB,
  winner,
}: {
  valueA: number;
  valueB: number;
  winner: "a" | "b" | "tie";
}) {
  const widthA = duelBarWidth(valueA, valueB);
  const widthB = 100 - widthA;
  return (
    <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-zinc-900/80 border border-zinc-800/60">
      <div
        className={`h-full transition-all duration-500 ${
          winner === "a"
            ? "bg-gradient-to-r from-violet-600 to-violet-400"
            : winner === "tie"
              ? "bg-gradient-to-r from-zinc-600 to-zinc-500"
              : "bg-zinc-700/80"
        }`}
        style={{ width: `${widthA}%` }}
      />
      <div
        className={`h-full transition-all duration-500 ${
          winner === "b"
            ? "bg-gradient-to-l from-rose-600 to-rose-400"
            : winner === "tie"
              ? "bg-gradient-to-l from-zinc-600 to-zinc-500"
              : "bg-zinc-700/80"
        }`}
        style={{ width: `${widthB}%` }}
      />
    </div>
  );
}

function TrackStatRow({
  stat,
  nameA,
  nameB,
}: {
  stat: CompareTrackStat;
  nameA: string;
  nameB: string;
}) {
  const winner = statWinner(stat);
  const delta = statDelta(stat);
  const deltaLabel =
    stat.format === "percent" ? `${delta}pt` : stat.format === "count" ? String(delta) : String(delta);

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-3 feed-hover-lift">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`text-lg font-bold tabular-nums leading-none ${
              winner === "a" ? "text-violet-200" : winner === "tie" ? "text-zinc-300" : "text-zinc-500"
            }`}
          >
            {formatStatValue(stat.valueA, stat.format)}
          </span>
          {winner === "a" && <WinnerBadge side="a" />}
        </div>
        <div className="text-center shrink-0 px-1">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">{stat.label}</p>
          {delta > 0 && winner !== "tie" && (
            <p className="text-[9px] text-amber-400/90 tabular-nums font-semibold mt-0.5">Δ {deltaLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          {winner === "b" && <WinnerBadge side="b" />}
          <span
            className={`text-lg font-bold tabular-nums leading-none ${
              winner === "b" ? "text-rose-200" : winner === "tie" ? "text-zinc-300" : "text-zinc-500"
            }`}
          >
            {formatStatValue(stat.valueB, stat.format)}
          </span>
        </div>
      </div>
      <DuelBar valueA={stat.valueA} valueB={stat.valueB} winner={winner} />
      <div className="flex justify-between mt-1.5 text-[8px] text-zinc-600 truncate">
        <span className="max-w-[40%] truncate">{nameA.split(" ")[0]}</span>
        <span className="max-w-[40%] truncate text-right">{nameB.split(" ")[0]}</span>
      </div>
    </div>
  );
}

function CredibilityHeadline({
  scoreA,
  scoreB,
  nameA,
  nameB,
  rankA,
  rankB,
  labelA,
  labelB,
}: {
  scoreA: number;
  scoreB: number;
  nameA: string;
  nameB: string;
  rankA: number;
  rankB: number;
  labelA: string;
  labelB: string;
}) {
  const winner = scoreA === scoreB ? "tie" : scoreA > scoreB ? "a" : "b";
  const gap = Math.abs(scoreA - scoreB);
  const widthA = duelBarWidth(scoreA, scoreB);

  return (
    <section className="relative rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-zinc-950 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08),transparent_55%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-violet-600/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-rose-600/5 to-transparent pointer-events-none" />

      <div className="relative px-4 sm:px-6 pt-5 pb-4">
        <SectionLabel>Headline</SectionLabel>
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-3 mb-4">
          Credibility
        </p>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-6">
          <div className={`text-center sm:text-left ${winner === "a" ? "" : "opacity-70"}`}>
            {winner === "a" && (
              <span className="inline-block text-[8px] font-black uppercase tracking-widest text-violet-300 mb-1">
                On top
              </span>
            )}
            <p
              className={`text-4xl sm:text-5xl font-black tabular-nums leading-none tracking-tight ${
                winner === "a" ? "text-white" : "text-zinc-400"
              }`}
            >
              {scoreA}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1.5 flex flex-col items-center sm:items-start gap-0.5">
              <span className="text-violet-200/90 font-semibold tabular-nums">#{rankA}</span>
              <span className="text-[9px] text-violet-300/75">{labelA}</span>
              {scoreA > scoreB && <RankMotion delta={Math.min(99, Math.round(gap / 10))} />}
            </p>
          </div>

          <div className="flex flex-col items-center pb-1">
            <span className="text-[11px] font-black text-zinc-500">VS</span>
            {gap > 0 && (
              <span className="text-[9px] text-amber-400/90 font-semibold tabular-nums mt-1">+{gap} gap</span>
            )}
          </div>

          <div className={`text-center sm:text-right ${winner === "b" ? "" : "opacity-70"}`}>
            {winner === "b" && (
              <span className="inline-block text-[8px] font-black uppercase tracking-widest text-rose-300 mb-1">
                On top
              </span>
            )}
            <p
              className={`text-4xl sm:text-5xl font-black tabular-nums leading-none tracking-tight ${
                winner === "b" ? "text-white" : "text-zinc-400"
              }`}
            >
              {scoreB}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1.5 flex flex-col items-center sm:items-end gap-0.5">
              <span className="text-violet-200/90 font-semibold tabular-nums">#{rankB}</span>
              <span className="text-[9px] text-violet-300/75">{labelB}</span>
              {scoreB > scoreA && <RankMotion delta={Math.min(99, Math.round(gap / 10))} />}
            </p>
          </div>
        </div>

        <div className="mt-5 flex h-3 rounded-full overflow-hidden border border-zinc-800/60 bg-zinc-900/80">
          <div
            className="h-full bg-gradient-to-r from-violet-600 via-violet-500 to-violet-400/80 transition-all duration-700"
            style={{ width: `${widthA}%` }}
          />
          <div className="w-0.5 bg-zinc-950 shrink-0" />
          <div
            className="h-full bg-gradient-to-l from-rose-600 via-rose-500 to-rose-400/80 flex-1 transition-all duration-700"
          />
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-zinc-600">
          <span className="truncate max-w-[45%]">{nameA}</span>
          <span className="truncate max-w-[45%] text-right">{nameB}</span>
        </div>
      </div>
    </section>
  );
}

function CommonBattleCard({
  battle,
  profileA,
  profileB,
}: {
  battle: import("@/components/agents/profile/types").BattleRecord;
  profileA: EnrichedAgentProfile;
  profileB: EnrichedAgentProfile;
}) {
  const battleId = [profileA.slug, profileB.slug].sort().join("-");
  return (
    <Link
      href={`/battles/${battleId}`}
      className="block rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-950/40 via-zinc-950 to-zinc-950 p-3 feed-hover-lift group"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
            battle.status === "active"
              ? "text-rose-300 border-rose-500/35 bg-rose-500/10"
              : battle.status === "won"
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                : "text-zinc-400 border-zinc-600"
          }`}
        >
          {battle.status === "active" ? "Live" : battle.status === "won" ? "Settled" : "Lost"}
        </span>
        <span className="text-[10px] text-rose-300/90 font-bold tabular-nums">{battle.spread}pt spread</span>
      </div>
      <p className="text-[11px] text-zinc-300 font-medium truncate group-hover:text-white transition">
        {battle.market}
      </p>
      <div className="flex items-center justify-between mt-3 text-[11px]">
        <span className="text-violet-200 font-semibold">{profileA.name}</span>
        <span className="text-[9px] text-rose-500 font-black">VS</span>
        <span className="text-rose-200 font-semibold">{profileB.name}</span>
      </div>
      {battle.winner && (
        <p className="text-[9px] text-emerald-400/90 mt-2">Winner on record · {battle.winner}</p>
      )}
      <p className="text-[10px] font-semibold text-rose-300/90 mt-2 group-hover:text-rose-200">
        {viewRivalryCta("→")}
      </p>
    </Link>
  );
}

function CommonReceiptCard({ pair, nameA, nameB }: { pair: CommonReceiptPair; nameA: string; nameB: string }) {
  const toneA = outcomeTone(pair.receiptA.outcome);
  const toneB = outcomeTone(pair.receiptB.outcome);
  const spread = Math.abs(pair.receiptA.calledProbability - pair.receiptB.calledProbability);

  return (
    <article className="rounded-xl border border-zinc-800/70 bg-zinc-950/80 p-3 feed-hover-lift">
      <p className="text-[11px] font-semibold text-zinc-200 mb-3">{shortTitle(pair.marketTitle, 56)}</p>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={receiptDetailPath(pair.receiptA.id)}
          className={`rounded-lg border px-2.5 py-2 ${toneA.border} bg-zinc-900/50 hover:bg-zinc-900 transition`}
        >
          <p className="text-[8px] uppercase text-violet-400/80 mb-1 truncate">{nameA}</p>
          <p className="text-sm font-bold text-white tabular-nums">{pair.receiptA.calledProbability}%</p>
          <p className={`text-[9px] mt-1 ${toneA.text}`}>
            {outcomeIcon(pair.receiptA.outcome)} {pair.receiptA.side}
          </p>
        </Link>
        <Link
          href={receiptDetailPath(pair.receiptB.id)}
          className={`rounded-lg border px-2.5 py-2 ${toneB.border} bg-zinc-900/50 hover:bg-zinc-900 transition`}
        >
          <p className="text-[8px] uppercase text-rose-400/80 mb-1 truncate text-right">{nameB}</p>
          <p className="text-sm font-bold text-white tabular-nums text-right">{pair.receiptB.calledProbability}%</p>
          <p className={`text-[9px] mt-1 text-right ${toneB.text}`}>
            {outcomeIcon(pair.receiptB.outcome)} {pair.receiptB.side}
          </p>
        </Link>
      </div>
      {spread >= 8 && (
        <p className="text-[9px] text-amber-400/85 mt-2 text-center font-semibold">{spread}pt disagreement on this call</p>
      )}
    </article>
  );
}

function FollowDuel({
  profileA,
  profileB,
  slugA,
  slugB,
  usingFallback,
}: {
  profileA: EnrichedAgentProfile;
  profileB: EnrichedAgentProfile;
  slugA: string;
  slugB: string;
  usingFallback: boolean;
}) {
  const router = useRouter();
  const [followingA, setFollowingA] = useState(false);
  const [followingB, setFollowingB] = useState(false);

  useEffect(() => {
    if (usingFallback) return;
    let cancelled = false;
    (async () => {
      try {
        const [fa, fb] = await Promise.all([fetchFollowStatus(slugA), fetchFollowStatus(slugB)]);
        if (!cancelled) {
          setFollowingA(fa);
          setFollowingB(fb);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slugA, slugB, usingFallback]);

  async function toggle(slug: string, wasFollowing: boolean, setFollowing: (v: boolean) => void) {
    setFollowing(!wasFollowing);
    if (usingFallback) return;
    try {
      if (wasFollowing) await unfollowAgent(slug);
      else await followAgent(slug);
    } catch (err) {
      if (isAuthRequiredError(err)) {
        redirectToLogin(router, `/compare/${slugA}/${slugB}`);
        return;
      }
      setFollowing(wasFollowing);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/50 to-zinc-950 p-4 sm:p-5">
      <SectionLabel>Who would you follow?</SectionLabel>
      <p className="text-center text-[11px] text-zinc-500 mt-3 mb-4 max-w-md mx-auto">
        Pick the forecaster you want in your feed — reputation follows the record, not the hype.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4 flex flex-col items-center text-center gap-3">
          <Avatar name={profileA.name} color={profileA.avatar_color} size="lg" />
          <div>
            <p className="text-sm font-semibold text-white">{profileA.name}</p>
            <p className="text-[10px] text-zinc-500">@{profileA.slug}</p>
          </div>
          <AgentFollowButton
            following={followingA}
            onToggle={() => toggle(slugA, followingA, setFollowingA)}
            followHover={`Track ${profileA.name}'s calls before the crowd moves.`}
            whyFollow={profileA.conviction_archetype}
            feedLens="Battles · receipts · conviction shifts"
            disabled={usingFallback}
          />
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 flex flex-col items-center text-center gap-3">
          <Avatar name={profileB.name} color={profileB.avatar_color} size="lg" />
          <div>
            <p className="text-sm font-semibold text-white">{profileB.name}</p>
            <p className="text-[10px] text-zinc-500">@{profileB.slug}</p>
          </div>
          <AgentFollowButton
            following={followingB}
            onToggle={() => toggle(slugB, followingB, setFollowingB)}
            followHover={`Track ${profileB.name}'s calls before the crowd moves.`}
            whyFollow={profileB.conviction_archetype}
            feedLens="Battles · receipts · conviction shifts"
            disabled={usingFallback}
          />
        </div>
      </div>
    </section>
  );
}

export function ProfileCompareView({
  profileA,
  profileB,
  slugA,
  slugB,
  usingFallback = false,
}: {
  profileA: EnrichedAgentProfile;
  profileB: EnrichedAgentProfile;
  slugA: string;
  slugB: string;
  usingFallback?: boolean;
}) {
  const credA = useMemo(() => credibilityFor(profileA), [profileA]);
  const credB = useMemo(() => credibilityFor(profileB), [profileB]);
  const resolvedA = resolvedCount(profileA);
  const resolvedB = resolvedCount(profileB);
  const trackStats = useMemo(
    () => buildTrackStatsPair(profileA, profileB, resolvedA, resolvedB),
    [profileA, profileB, resolvedA, resolvedB],
  );
  const commonBattles = useMemo(() => getCommonBattles(profileA, profileB), [profileA, profileB]);
  const commonReceipts = useMemo(() => getCommonReceiptPairs(profileA, profileB), [profileA, profileB]);
  const rankCtxA = useMemo(() => rankContextForProfile(profileA), [profileA]);
  const rankCtxB = useMemo(() => rankContextForProfile(profileB), [profileB]);

  const winsA = trackStats.filter((s) => statWinner(s) === "a").length;
  const winsB = trackStats.filter((s) => statWinner(s) === "b").length;
  const overallWinner: "a" | "b" | "tie" =
    credA.score === credB.score
      ? winsA === winsB
        ? "tie"
        : winsA > winsB
          ? "a"
          : "b"
      : credA.score > credB.score
        ? "a"
        : "b";

  return (
    <div className="space-y-5">
      {/* Versus banner */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950">
        <div className="absolute inset-0 compare-versus-glow pointer-events-none" />
        <div className="relative px-4 sm:px-6 py-5">
          <SectionLabel>Profile A vs Profile B</SectionLabel>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-4">
            <Link href={profileHref(slugA)} className="flex flex-col items-center sm:items-start gap-2 group min-w-0">
              <Avatar name={profileA.name} color={profileA.avatar_color} size="lg" />
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold text-white truncate group-hover:text-violet-100 transition">
                  {profileA.name}
                </p>
                <p className="text-[10px] text-zinc-500">@{profileA.slug}</p>
                <p className="text-[10px] text-violet-300/85 tabular-nums mt-0.5">
                  #{rankCtxA.rankGlobal} · {rankCtxA.label}
                </p>
                {overallWinner === "a" && (
                  <span className="inline-block mt-1 text-[8px] font-black uppercase tracking-widest text-violet-300">
                    Edge in duel
                  </span>
                )}
              </div>
            </Link>
            <div className="flex flex-col items-center shrink-0">
              <span className="text-2xl sm:text-3xl font-black text-zinc-600 tracking-tighter">VS</span>
              <span className="text-[9px] text-zinc-600 mt-1 tabular-nums">
                {winsA}–{winsB} categories
              </span>
            </div>
            <Link
              href={profileHref(slugB)}
              className="flex flex-col items-center sm:items-end gap-2 group min-w-0"
            >
              <Avatar name={profileB.name} color={profileB.avatar_color} size="lg" />
              <div className="text-center sm:text-right min-w-0">
                <p className="text-base sm:text-lg font-bold text-white truncate group-hover:text-rose-100 transition">
                  {profileB.name}
                </p>
                <p className="text-[10px] text-zinc-500">@{profileB.slug}</p>
                <p className="text-[10px] text-violet-300/85 tabular-nums mt-0.5">
                  #{rankCtxB.rankGlobal} · {rankCtxB.label}
                </p>
                {overallWinner === "b" && (
                  <span className="inline-block mt-1 text-[8px] font-black uppercase tracking-widest text-rose-300">
                    Edge in duel
                  </span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </section>

      <CompareRankStrip
        rankA={rankCtxA}
        rankB={rankCtxB}
        credibilityGap={credB.score - credA.score}
      />

      <CompareKnowledgeSection
        slugA={slugA}
        slugB={slugB}
        nameA={profileA.name}
        nameB={profileB.name}
      />

      <CredibilityHeadline
        scoreA={credA.score}
        scoreB={credB.score}
        nameA={profileA.name}
        nameB={profileB.name}
        rankA={rankCtxA.rankGlobal}
        rankB={rankCtxB.rankGlobal}
        labelA={rankCtxA.label}
        labelB={rankCtxB.label}
      />

      <section>
        <SectionLabel>Track record</SectionLabel>
        <div className="mt-3 space-y-2">
          {trackStats.map((stat) => (
            <TrackStatRow key={stat.id} stat={stat} nameA={profileA.name} nameB={profileB.name} />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Shared forecast rivalries</SectionLabel>
        {commonBattles.length === 0 ? (
          <p className="text-[11px] text-zinc-600 text-center py-6 mt-2 rounded-xl border border-dashed border-zinc-800">
            No shared forecast disagreements on record yet — their theses haven&apos;t crossed on the same market.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {commonBattles.map((b) => (
              <CommonBattleCard key={`${b.market}-${b.spread}`} battle={b} profileA={profileA} profileB={profileB} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel>Common receipts</SectionLabel>
        {commonReceipts.length === 0 ? (
          <p className="text-[11px] text-zinc-600 text-center py-6 mt-2 rounded-xl border border-dashed border-zinc-800">
            No overlapping verified calls yet — different markets, different wars.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {commonReceipts.map((pair) => (
              <CommonReceiptCard key={pair.key} pair={pair} nameA={profileA.name} nameB={profileB.name} />
            ))}
          </div>
        )}
      </section>

      <FollowDuel
        profileA={profileA}
        profileB={profileB}
        slugA={slugA}
        slugB={slugB}
        usingFallback={usingFallback}
      />
    </div>
  );
}
