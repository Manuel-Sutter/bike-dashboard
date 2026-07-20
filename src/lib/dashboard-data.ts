import { computeReadiness, type DailyTrainingLoad, type ReadinessResult } from "./training";
import {
  getMockFtp,
  getMockPmcHistory,
  getMockWellnessHistory,
  type MockWellnessDay,
} from "./mock-data";

export interface Trend {
  changeText: string;
  direction: "up" | "down" | "flat";
}

export interface DashboardData {
  isMock: boolean;
  ftp: number | null;
  pmcHistory: DailyTrainingLoad[];
  latestPmc: DailyTrainingLoad | null;
  wellnessToday: MockWellnessDay;
  readiness: ReadinessResult;
  trends: {
    vo2max: Trend | null;
    hrv: Trend | null;
    bodyBattery: Trend | null;
    sleep: Trend | null;
    ctl: Trend | null;
    atl: Trend | null;
    tsb: Trend | null;
  };
}

function percentChange(current: number, past: number): number | null {
  if (past === 0) return null;
  return Math.round(((current - past) / Math.abs(past)) * 100);
}

function trendFromPercent(current: number, past: number): Trend {
  const pct = percentChange(current, past);
  if (pct === null) return { changeText: "vs 7d ago: —", direction: "flat" };
  const direction = pct > 1 ? "up" : pct < -1 ? "down" : "flat";
  const sign = pct > 0 ? "+" : "";
  return { changeText: `${sign}${pct}% vs 7d ago`, direction };
}

// TSB can cross zero, where a percent change is meaningless (-5 -> +5 isn't
// "+200%") - show the point change instead.
function trendFromDelta(current: number, past: number): Trend {
  const delta = Math.round((current - past) * 10) / 10;
  const direction = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const sign = delta > 0 ? "+" : "";
  return { changeText: `${sign}${delta} vs 7d ago`, direction };
}

// Mock-backed for now - swap the body for a Supabase query once the first
// real Garmin sync lands data. Callers already await this so that swap
// won't touch anything upstream.
export async function getDashboardData(): Promise<DashboardData> {
  const pmcHistory = getMockPmcHistory();
  const latestPmc = pmcHistory.at(-1) ?? null;
  const pmcWeekAgo = pmcHistory.at(-8) ?? null;
  const ftp = getMockFtp();

  const wellnessHistory = getMockWellnessHistory(14);
  const wellnessToday = wellnessHistory.at(-1)!;
  const wellnessWeekAgo = wellnessHistory.at(-8) ?? wellnessHistory[0];

  const readiness = computeReadiness({
    tsb: latestPmc?.tsb ?? null,
    garminReadinessScore: wellnessToday.garminReadinessScore,
    recoveryTimeMinutes: wellnessToday.recoveryTimeMinutes,
  });

  return {
    isMock: true,
    ftp,
    pmcHistory,
    latestPmc,
    wellnessToday,
    readiness,
    trends: {
      vo2max: trendFromPercent(wellnessToday.vo2maxCycling, wellnessWeekAgo.vo2maxCycling),
      hrv: trendFromPercent(wellnessToday.hrvWeeklyAvgMs, wellnessWeekAgo.hrvWeeklyAvgMs),
      bodyBattery: trendFromPercent(
        wellnessToday.bodyBatteryHigh,
        wellnessWeekAgo.bodyBatteryHigh
      ),
      sleep: trendFromPercent(wellnessToday.sleepScore, wellnessWeekAgo.sleepScore),
      ctl: latestPmc && pmcWeekAgo ? trendFromPercent(latestPmc.ctl, pmcWeekAgo.ctl) : null,
      atl: latestPmc && pmcWeekAgo ? trendFromPercent(latestPmc.atl, pmcWeekAgo.atl) : null,
      tsb: latestPmc && pmcWeekAgo ? trendFromDelta(latestPmc.tsb, pmcWeekAgo.tsb) : null,
    },
  };
}
