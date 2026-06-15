export type TradeSide = "YES" | "NO";

export type MarketPrices = {
  yesCents: number;
  noCents: number;
  yesProbability: number;
};

/** Implied market prices from YES probability (Polymarket-style cents). */
export function marketPricesFromProbability(yesProbability: number): MarketPrices {
  const yesCents = Math.max(1, Math.min(99, Math.round(yesProbability)));
  const noCents = 100 - yesCents;
  return { yesCents, noCents, yesProbability: yesCents };
}

export function formatPriceCents(cents: number): string {
  return `${cents}¢`;
}

export function priceDecimalForSide(prices: MarketPrices, side: TradeSide): number {
  const cents = side === "YES" ? prices.yesCents : prices.noCents;
  return cents / 100;
}

/** Shares bought at price P with $amount: payout if correct = amount / P. */
export function tradePayoutPreview(amount: number, side: TradeSide, prices: MarketPrices) {
  const priceCents = side === "YES" ? prices.yesCents : prices.noCents;
  const price = priceCents / 100;
  const payout = price > 0 ? amount / price : 0;
  const profit = payout - amount;
  return {
    side,
    priceCents,
    amount,
    payout: Math.round(payout * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  };
}

export function formatUsd(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (Number.isInteger(value)) return `$${value}`;
  return `$${value.toFixed(2)}`;
}

export function formatUsdSigned(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(value))}`;
}
