import type { EnrichedBattle } from "./types";

export type BackedAgent = "a" | "b";

export type BattlePrices = {
  agentACents: number;
  agentBCents: number;
};

/** Implied back prices from crowd alignment (Polymarket-style cents). */
export function battlePricesFromCrowd(battle: EnrichedBattle): BattlePrices {
  const { crowd_alignment: crowd } = battle;
  const aIsFavored = crowd.favored_slug === battle.agent_a.slug;
  const favoredCents = Math.max(1, Math.min(99, Math.round(crowd.favored_pct)));
  const contrarianCents = 100 - favoredCents;
  return {
    agentACents: aIsFavored ? favoredCents : contrarianCents,
    agentBCents: aIsFavored ? contrarianCents : favoredCents,
  };
}

export function priceCentsForBacked(
  prices: BattlePrices,
  backed: BackedAgent,
): number {
  return backed === "a" ? prices.agentACents : prices.agentBCents;
}

export function battleBackPayoutPreview(
  amount: number,
  backed: BackedAgent,
  prices: BattlePrices,
) {
  const priceCents = priceCentsForBacked(prices, backed);
  const price = priceCents / 100;
  const payout = price > 0 ? amount / price : 0;
  const profit = payout - amount;
  return {
    backed,
    priceCents,
    amount,
    payout: Math.round(payout * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  };
}

export {
  formatPriceCents,
  formatUsd,
  formatUsdSigned,
} from "@/components/markets/detail/marketTradeMath";
