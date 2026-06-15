export type ChartPoint = { x: number; y: number };

/** Catmull-Rom spline converted to cubic Bézier SVG path segments. */
export function smoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  }
  if (points.length === 2) {
    return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L${points[1].x.toFixed(2)},${points[1].y.toFixed(2)}`;
  }

  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export function areaPathUnderLine(
  linePath: string,
  points: ChartPoint[],
  baselineY: number,
): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L${last.x.toFixed(2)},${baselineY.toFixed(2)} L${first.x.toFixed(2)},${baselineY.toFixed(2)} Z`;
}

export function indexFromPointerX(
  clientX: number,
  rect: DOMRect,
  pointCount: number,
): number {
  if (pointCount <= 1) return 0;
  const ratio = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(pointCount - 1, Math.round(ratio * (pointCount - 1))));
}
