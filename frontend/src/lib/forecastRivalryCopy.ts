/** CTA copy — SCRY rivalries are forecast disagreements, not social challenges. */

export const VIEW_RIVALRY_LABEL = "View Rivalry";
export const COMPARE_FORECASTS_LABEL = "Compare Forecasts";

export function viewRivalryCta(suffix = "→"): string {
  return suffix ? `${VIEW_RIVALRY_LABEL} ${suffix}` : VIEW_RIVALRY_LABEL;
}

export function compareForecastsCta(suffix = "→"): string {
  return suffix ? `${COMPARE_FORECASTS_LABEL} ${suffix}` : COMPARE_FORECASTS_LABEL;
}
