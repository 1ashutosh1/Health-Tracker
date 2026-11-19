import type { WeightPoint } from '../types/checkin';
import { buildChartGeometry, describeChart, filterByRange } from './chart';

const NOW = new Date(2026, 10, 19, 15, 0); // Thu Nov 19 2026, 3pm local

const point = (date: string, weightKg: number): WeightPoint => ({ date, weightKg });

const HISTORY: WeightPoint[] = [
  point('2026-04-01', 80), // ~7.5 months ago
  point('2026-06-10', 79), // ~5 months ago
  point('2026-10-25', 78), // ~3.5 weeks ago
  point('2026-11-10', 77), // 9 days ago
  point('2026-11-13', 76.5), // 6 days ago
  point('2026-11-19', 76), // today
];

describe('filterByRange', () => {
  it('All keeps everything (as a copy)', () => {
    const result = filterByRange(HISTORY, 'All', NOW);
    expect(result).toEqual(HISTORY);
    expect(result).not.toBe(HISTORY);
  });

  it('W keeps the last 7 days including today', () => {
    expect(filterByRange(HISTORY, 'W', NOW).map((p) => p.date)).toEqual(['2026-11-13', '2026-11-19']);
  });

  it('M keeps the last month', () => {
    expect(filterByRange(HISTORY, 'M', NOW).map((p) => p.date)).toEqual([
      '2026-10-25',
      '2026-11-10',
      '2026-11-13',
      '2026-11-19',
    ]);
  });

  it('6M keeps the last six months', () => {
    expect(filterByRange(HISTORY, '6M', NOW).map((p) => p.date)).toEqual([
      '2026-06-10',
      '2026-10-25',
      '2026-11-10',
      '2026-11-13',
      '2026-11-19',
    ]);
  });

  it('includes a check-in that falls exactly on the first day of the window', () => {
    expect(filterByRange([point('2026-11-13', 70)], 'W', NOW)).toHaveLength(1);
    expect(filterByRange([point('2026-11-12', 70)], 'W', NOW)).toHaveLength(0);
  });

  it('returns an empty list for empty history or when nothing is recent enough', () => {
    expect(filterByRange([], 'W', NOW)).toEqual([]);
    expect(filterByRange([point('2026-01-01', 70)], 'M', NOW)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const copy = [...HISTORY];
    filterByRange(HISTORY, 'W', NOW);
    expect(HISTORY).toEqual(copy);
  });
});

describe('buildChartGeometry', () => {
  const box = { width: 300, height: 100, padding: 10 };

  it('returns null for no points', () => {
    expect(buildChartGeometry([], box)).toBeNull();
  });

  it('puts a single point in the horizontal centre with no line to draw', () => {
    const geometry = buildChartGeometry([point('2026-11-19', 74)], box)!;
    expect(geometry.points).toEqual([{ x: 150, y: 50, date: '2026-11-19', weightKg: 74 }]);
    expect(geometry.linePath).toBe('');
    expect(geometry.areaPath).toBe('');
  });

  it('maps the lowest weight to the bottom and the highest to the top (inside the padding)', () => {
    const geometry = buildChartGeometry([point('2026-11-01', 80), point('2026-11-11', 70)], box)!;
    expect(geometry.maxKg).toBe(80);
    expect(geometry.minKg).toBe(70);
    expect(geometry.points[0]).toMatchObject({ x: 10, y: 10 }); // heaviest, first day: top left
    expect(geometry.points[1]).toMatchObject({ x: 290, y: 90 }); // lightest, last day: bottom right
  });

  it('spaces points by real time, not by index', () => {
    const geometry = buildChartGeometry(
      [point('2026-11-01', 70), point('2026-11-02', 71), point('2026-11-11', 72)],
      box,
    )!;
    // Day 1 of a 10 day span is 10% of the inner width (280px).
    expect(geometry.points[1].x).toBeCloseTo(10 + 28, 1);
    expect(geometry.points[2].x).toBe(290);
  });

  it('centres a flat line vertically instead of dividing by zero', () => {
    const geometry = buildChartGeometry([point('2026-11-01', 72), point('2026-11-05', 72)], box)!;
    expect(geometry.points.map((p) => p.y)).toEqual([50, 50]);
    expect(geometry.linePath).not.toMatch(/NaN|Infinity/);
  });

  it('spaces points evenly when they all share one timestamp', () => {
    const geometry = buildChartGeometry(
      [point('2026-11-01', 70), point('2026-11-01', 72), point('2026-11-01', 71)],
      box,
    )!;
    expect(geometry.points.map((p) => p.x)).toEqual([10, 150, 290]);
    expect(geometry.linePath).not.toMatch(/NaN|Infinity/);
  });

  it('builds a smooth path through every point and closes the area to the bottom edge', () => {
    const geometry = buildChartGeometry(
      [point('2026-11-01', 80), point('2026-11-06', 75), point('2026-11-11', 70)],
      box,
    )!;
    expect(geometry.linePath.startsWith('M 10 10')).toBe(true);
    expect(geometry.linePath.match(/ C /g)).toHaveLength(2); // one curve per segment
    expect(geometry.areaPath.startsWith(geometry.linePath)).toBe(true);
    expect(geometry.areaPath.endsWith('L 290 100 L 10 100 Z')).toBe(true);
  });

  it('never draws outside the box', () => {
    const geometry = buildChartGeometry(HISTORY, box)!;
    for (const p of geometry.points) {
      expect(p.x).toBeGreaterThanOrEqual(box.padding);
      expect(p.x).toBeLessThanOrEqual(box.width - box.padding);
      expect(p.y).toBeGreaterThanOrEqual(box.padding);
      expect(p.y).toBeLessThanOrEqual(box.height - box.padding);
    }
  });
});

describe('describeChart', () => {
  it('says there is nothing to show for an empty range', () => {
    expect(describeChart([], 'W')).toBe('Weight chart, past week. No check-ins in this period.');
  });

  it('describes a single check-in', () => {
    expect(describeChart([point('2026-11-19', 74)], 'M')).toBe(
      'Weight chart, past month. One check-in: 74 kilograms on Nov 19.',
    );
  });

  it('summarizes the start, the end, the direction and the extremes', () => {
    const label = describeChart(
      [point('2026-11-01', 76.3), point('2026-11-10', 77), point('2026-11-19', 74)],
      'All',
    );
    expect(label).toContain('all time');
    expect(label).toContain('3 check-ins');
    expect(label).toContain('From 76.3 kilograms on Nov 1 to 74 kilograms on Nov 19, down 2.3 kilograms.');
    expect(label).toContain('Lowest 74, highest 77.');
  });

  it('says "up" for a gain and "no change" for equal weights', () => {
    expect(describeChart([point('2026-11-01', 70), point('2026-11-02', 71.2)], 'W')).toContain(
      'up 1.2 kilograms',
    );
    expect(describeChart([point('2026-11-01', 70), point('2026-11-02', 70)], 'W')).toContain('no change');
  });
});
