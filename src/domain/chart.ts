import { parseISO, startOfDay, subDays, subMonths } from 'date-fns';

import type { ChartRange, WeightPoint } from '../types/checkin';
import { formatDecimal, formatShortIsoDate } from '../utils/format';

export const CHART_RANGES: readonly { value: ChartRange; label: string; description: string }[] = [
  { value: 'W', label: 'W', description: 'Past week' },
  { value: 'M', label: 'M', description: 'Past month' },
  { value: '6M', label: '6M', description: 'Past 6 months' },
  { value: 'All', label: 'All', description: 'All time' },
];

/** Keeps the points that fall inside the range, counted back from `now` (the start day is included). */
export function filterByRange(history: readonly WeightPoint[], range: ChartRange, now: Date): WeightPoint[] {
  if (range === 'All') return [...history];
  const start = startOfDay(
    range === 'W' ? subDays(now, 6) : range === 'M' ? subMonths(now, 1) : subMonths(now, 6),
  );
  return history.filter((point) => parseISO(point.date).getTime() >= start.getTime());
}

export interface ChartBox {
  width: number;
  height: number;
  /** Space kept free on every side so dots and the highlight ring are never clipped. */
  padding: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  date: string;
  weightKg: number;
}

export interface ChartGeometry {
  points: ChartPoint[];
  minKg: number;
  maxKg: number;
  /** SVG path of the smooth line. Empty for a single point (nothing to connect). */
  linePath: string;
  /** The same line closed down to the bottom edge, for the light area fill. Empty for a single point. */
  areaPath: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Turns weight history (oldest first) into pixel positions and SVG paths. Pure, so it is easy to test.
 * - x follows real time, so a gap of three weeks looks like a gap. If every point shares one timestamp it
 *   falls back to even spacing.
 * - y runs from the lowest weight (bottom) to the highest (top). When all weights are equal the line is centred.
 * - The line is a chain of cubic curves with horizontal tangents at each point: smooth, and it never
 *   overshoots above the max or below the min the way spline fitting can.
 */
export function buildChartGeometry(history: readonly WeightPoint[], box: ChartBox): ChartGeometry | null {
  if (history.length === 0) return null;

  const weights = history.map((p) => p.weightKg);
  const minKg = Math.min(...weights);
  const maxKg = Math.max(...weights);
  const times = history.map((p) => parseISO(p.date).getTime());
  const firstTime = times[0];
  const timeSpan = times[times.length - 1] - firstTime;

  const innerWidth = box.width - box.padding * 2;
  const innerHeight = box.height - box.padding * 2;

  const points: ChartPoint[] = history.map((point, index) => {
    let x: number;
    if (history.length === 1) x = box.width / 2;
    else if (timeSpan > 0) x = box.padding + ((times[index] - firstTime) / timeSpan) * innerWidth;
    else x = box.padding + (index / (history.length - 1)) * innerWidth;

    const y =
      maxKg === minKg
        ? box.height / 2
        : box.padding + ((maxKg - point.weightKg) / (maxKg - minKg)) * innerHeight;

    return { x: round2(x), y: round2(y), date: point.date, weightKg: point.weightKg };
  });

  if (points.length < 2) return { points, minKg, maxKg, linePath: '', areaPath: '' };

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const midX = round2((from.x + to.x) / 2);
    linePath += ` C ${midX} ${from.y} ${midX} ${to.y} ${to.x} ${to.y}`;
  }
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x} ${box.height} L ${points[0].x} ${box.height} Z`;

  return { points, minKg, maxKg, linePath, areaPath };
}

/** What a screen reader says for the chart, e.g. "Weight chart, past month. 6 check-ins. From 76.3 ...". */
export function describeChart(points: readonly WeightPoint[], range: ChartRange): string {
  const period = (CHART_RANGES.find((r) => r.value === range)?.description ?? '').toLowerCase();
  const intro = `Weight chart, ${period}.`;
  if (points.length === 0) return `${intro} No check-ins in this period.`;

  const first = points[0];
  const last = points[points.length - 1];
  if (points.length === 1) {
    return `${intro} One check-in: ${formatDecimal(first.weightKg)} kilograms on ${formatShortIsoDate(first.date)}.`;
  }

  const weights = points.map((p) => p.weightKg);
  const change = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  const direction =
    change === 0 ? 'no change' : `${change < 0 ? 'down' : 'up'} ${formatDecimal(Math.abs(change))} kilograms`;

  return (
    `${intro} ${points.length} check-ins. ` +
    `From ${formatDecimal(first.weightKg)} kilograms on ${formatShortIsoDate(first.date)} ` +
    `to ${formatDecimal(last.weightKg)} kilograms on ${formatShortIsoDate(last.date)}, ${direction}. ` +
    `Lowest ${formatDecimal(Math.min(...weights))}, highest ${formatDecimal(Math.max(...weights))}.`
  );
}
