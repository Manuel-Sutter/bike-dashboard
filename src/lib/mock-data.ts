import { estimateFTP, computeTrainingLoad, type DailyTss } from "./training";

// Deterministic PRNG so the mock dashboard looks the same on every
// render/build instead of jittering on each request.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateMockDailyTss(days: number): DailyTss[] {
  const rand = seededRandom(42);
  const today = new Date();
  const result: DailyTss[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    const isRestDay = dayOfWeek === 1; // Monday rest, matches a typical week
    const isLongRideDay = dayOfWeek === 0; // Sunday long ride

    let tss = 0;
    if (!isRestDay) {
      const base = isLongRideDay ? 140 : 60;
      tss = Math.max(0, Math.round(base + (rand() - 0.5) * 40));
    }

    result.push({ date: d.toISOString().slice(0, 10), tss });
  }

  return result;
}

// A single 25-minute mock effort with a hard 20-minute block, just to
// exercise estimateFTP() against something shaped like a real ride. Daily
// TSS above is authored directly rather than derived from per-day power
// streams - computeTSS itself is already covered by its own unit tests.
const MOCK_HARD_EFFORT_WATTS = Array.from({ length: 1500 }, (_, i) =>
  i > 150 && i < 1350 ? 260 + Math.sin(i / 20) * 15 : 150
);

export function getMockPmcHistory() {
  return computeTrainingLoad(generateMockDailyTss(90));
}

export function getMockFtp() {
  return estimateFTP(MOCK_HARD_EFFORT_WATTS);
}

export interface MockWellnessDay {
  date: string;
  vo2maxCycling: number;
  trainingStatus: string;
  hrvStatus: string;
  hrvWeeklyAvgMs: number;
  bodyBatteryHigh: number;
  bodyBatteryLow: number;
  sleepScore: number;
  recoveryTimeMinutes: number;
  garminReadinessScore: number;
}

// 14 days so every KPI on the dashboard can show a week-over-week trend,
// not just the CTL/ATL/TSB series (which already has 90 days from the PMC
// history). Slow upward drift on vo2max mimics a rider getting fitter;
// everything else just wobbles around a baseline.
export function getMockWellnessHistory(days = 14): MockWellnessDay[] {
  const rand = seededRandom(7);
  const today = new Date();
  const result: MockWellnessDay[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const progress = (days - 1 - i) / days;

    result.push({
      date: d.toISOString().slice(0, 10),
      vo2maxCycling: Math.round((51 + progress * 1.5 + (rand() - 0.5)) * 10) / 10,
      trainingStatus: i < 2 ? "PRODUCTIVE" : "MAINTAINING",
      hrvStatus: rand() > 0.15 ? "BALANCED" : "UNBALANCED",
      hrvWeeklyAvgMs: Math.round(46 + (rand() - 0.5) * 6),
      bodyBatteryHigh: Math.round(78 + (rand() - 0.5) * 20),
      bodyBatteryLow: Math.round(22 + (rand() - 0.5) * 14),
      sleepScore: Math.round(72 + (rand() - 0.5) * 20),
      recoveryTimeMinutes: rand() > 0.8 ? Math.round(rand() * 300) : 0,
      garminReadinessScore: Math.round(64 + (rand() - 0.5) * 30),
    });
  }

  return result;
}
