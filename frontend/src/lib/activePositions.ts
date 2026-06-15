import type { PositionsPayload } from "@/components/positions/types";

/** Active open positions from ledger payload or profile snapshot. */
export function countActivePositions(
  positions: PositionsPayload | null,
  profilePositionCount = 0,
): number {
  const fromPayload = positions?.active_positions?.length ?? 0;
  if (fromPayload > 0) return fromPayload;
  const fromStats = positions?.stats?.active_count ?? 0;
  if (fromStats > 0) return fromStats;
  return profilePositionCount;
}

export function hasActivePositions(
  positions: PositionsPayload | null,
  profilePositionCount = 0,
): boolean {
  return countActivePositions(positions, profilePositionCount) > 0;
}
