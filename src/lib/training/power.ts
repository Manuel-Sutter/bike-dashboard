export function rollingAverage(watts: number[], windowSeconds: number): number[] {
  if (watts.length < windowSeconds) return [];

  const result: number[] = [];
  let windowSum = 0;
  for (let i = 0; i < watts.length; i++) {
    windowSum += watts[i];
    if (i >= windowSeconds) {
      windowSum -= watts[i - windowSeconds];
    }
    if (i >= windowSeconds - 1) {
      result.push(windowSum / windowSeconds);
    }
  }
  return result;
}

// Coggan's normalized power: 30s rolling average, raised to the 4th power,
// averaged, then take the 4th root — weights sustained efforts more than a
// plain average would, matching how the body actually experiences load.
export function normalizedPower(watts: number[]): number | null {
  const rolling = rollingAverage(watts, 30);
  if (rolling.length === 0) return null;

  const meanFourthPower =
    rolling.reduce((sum, w) => sum + w ** 4, 0) / rolling.length;
  return meanFourthPower ** 0.25;
}

export function bestAveragePower(
  watts: number[],
  durationSeconds: number
): number | null {
  const rolling = rollingAverage(watts, durationSeconds);
  if (rolling.length === 0) return null;
  return Math.max(...rolling);
}

export const STANDARD_POWER_CURVE_DURATIONS_S = [
  5, 10, 30, 60, 300, 600, 1200, 1800, 3600,
];

export interface PowerCurvePoint {
  durationSeconds: number;
  watts: number;
}

export function powerDurationCurve(
  watts: number[],
  durations: number[] = STANDARD_POWER_CURVE_DURATIONS_S
): PowerCurvePoint[] {
  const points: PowerCurvePoint[] = [];
  for (const durationSeconds of durations) {
    const best = bestAveragePower(watts, durationSeconds);
    if (best !== null) {
      points.push({ durationSeconds, watts: best });
    }
  }
  return points;
}
