/**
 * Single source of truth for Agent Studio revenue & audience economics.
 * MRR is always derived from plan counts — never stored independently.
 */

import {
  betaFollowerCount,
  betaSupporterMetrics,
  isCoreAgentSlug,
} from "@/lib/betaNetworkScale";
import { PLAN_PRICES } from "@/lib/forecasterSubscriptions";

export type AgentRevenueMetrics = {
  followers: number;
  payingSupporters: number;
  proSupporters: number;
  premiumSupporters: number;
  mrr: number;
  arr: number;
};

function resolveBetaFollowers(forecasterId: string, followerCount: number): number {
  const slug = forecasterId.replace(/^agent-/, "");
  if (followerCount <= 0 && !isCoreAgentSlug(slug)) return 0;
  if (isCoreAgentSlug(slug) || followerCount > 200) {
    return betaFollowerCount(slug, { isCreator: !isCoreAgentSlug(slug) });
  }
  return Math.min(followerCount, 25);
}

/** MRR = (pro × $9) + (premium × $29) */
export function computeAgentMrr(
  proSupporters: number,
  premiumSupporters: number,
): number {
  return proSupporters * PLAN_PRICES.pro + premiumSupporters * PLAN_PRICES.premium;
}

export function buildAgentRevenueMetrics(params: {
  forecasterId: string;
  followerCount?: number;
}): AgentRevenueMetrics {
  const { forecasterId, followerCount = 0 } = params;
  const slug = forecasterId.replace(/^agent-/, "");
  const followers = resolveBetaFollowers(forecasterId, followerCount);
  const { payingSupporters, proSupporters, premiumSupporters } =
    betaSupporterMetrics(slug);
  const mrr = computeAgentMrr(proSupporters, premiumSupporters);

  return {
    followers,
    payingSupporters,
    proSupporters,
    premiumSupporters,
    mrr,
    arr: mrr * 12,
  };
}

export function conversionPctFromMetrics(metrics: AgentRevenueMetrics): number {
  if (metrics.followers <= 0) return 0;
  return Math.round((metrics.payingSupporters / metrics.followers) * 1000) / 10;
}

export function topPlanFromMetrics(
  metrics: AgentRevenueMetrics,
): "pro" | "premium" {
  return metrics.proSupporters >= metrics.premiumSupporters ? "pro" : "premium";
}
