import { computeReadiness, computeTrainingLoad, type DailyTrainingLoad, type ReadinessResult } from "./training";
import {
  getMockFtp,
  getMockGymDays,
  getMockPmcHistory,
  getMockWellnessHistory,
} from "./mock-data";
import { getRecentCheckins, getTodayCheckin } from "./checkins";
import { buildDailyTssSeries, estimateFtpFromRides, getRecentGymDays, getRecentRides } from "./activities";
import { getWellnessHistory, type WellnessDay } from "./wellness";

const PMC_HISTORY_DAYS = 90;
const WELLNESS_HISTORY_DAYS = 14;
const KNEE_CORRELATION_DAYS = 30;

export interface Trend {
  changeText: string;
  direction: "up" | "down" | "flat";
}

export interface KneeCorrelationPoint {
  date: string;
  atl: number;
  isGymDay: boolean;
  kneeStatus: number | null;
}

export interface DashboardData {
  isMock: boolean;
  ftp: number | null;
  pmcHistory: DailyTrainingLoad[];
  latestPmc: DailyTrainingLoad | null;
  wellnessToday: WellnessDay;
  readiness: ReadinessResult;
  todayKneeStatus: number | null;
  kneeCorrelation: KneeCorrelationPoint[];
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

const EMPTY_WELLNESS: WellnessDay = {
  date: new Date().toISOString().slice(0, 10),
  vo2maxCycling: null,
  trainingStatus: null,
  hrvStatus: null,
  hrvWeeklyAvgMs: null,
  bodyBatteryHigh: null,
  bodyBatteryLow: null,
  sleepScore: null,
  recoveryTimeMinutes: null,
  garminReadinessScore: null,
};

function percentChange(current: number, past: number): number | null {
  if (past === 0) return null;
  return Math.round(((current - past) / Math.abs(past)) * 100);
}

function trendFromPercent(current: number | null, past: number | null): Trend | null {
  if (current === null || past === null) return null;
  const pct = percentChange(current, past);
  if (pct === null) return { changeText: "vs 7d ago: —", direction: "flat" };
  const direction = pct > 1 ? "up" : pct < -1 ? "down" : "flat";
  const sign = pct > 0 ? "+" : "";
  return { changeText: `${sign}${pct}% vs 7d ago`, direction };
}

// TSB can cross zero, where a percent change is meaningless (-5 -> +5 isn't
// "+200%") - show the point change instead.
function trendFromDelta(current: number | null, past: number | null): Trend | null {
  if (current === null || past === null) return null;
  const delta = Math.round((current - past) * 10) / 10;
  const direction = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const sign = delta > 0 ? "+" : "";
  return { changeText: `${sign}${delta} vs 7d ago`, direction };
}

function daysAgoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// checkins are real Supabase data from day one (they're logged through our
// own UI, not sourced from Garmin) - unlike the rest of this file, don't
// fall back to mock data on success. Only swallow errors from the table not
// existing yet (schema migration not run), so a missing checkins table
// doesn't take down the whole dashboard.
async function getCheckinsSafely(): Promise<{
  today: number | null;
  recent: Awaited<ReturnType<typeof getRecentCheckins>>;
}> {
  try {
    const [today, recent] = await Promise.all([getTodayCheckin(), getRecentCheckins(30)]);
    return { today: today?.kneeStatus ?? null, recent };
  } catch (err) {
    console.error("Could not load checkins (has the migration been run?):", err);
    return { today: null, recent: [] };
  }
}

function buildKneeCorrelation(
  pmcHistory: DailyTrainingLoad[],
  gymDays: Set<string>,
  recentCheckins: { date: string; kneeStatus: number }[]
): KneeCorrelationPoint[] {
  const kneeByDate = new Map(recentCheckins.map((c) => [c.date, c.kneeStatus]));
  return pmcHistory.slice(-KNEE_CORRELATION_DAYS).map((day) => ({
    date: day.date,
    atl: Math.round(day.atl * 10) / 10,
    isGymDay: gymDays.has(day.date),
    kneeStatus: kneeByDate.get(day.date) ?? null,
  }));
}

async function getMockDashboardData(): Promise<DashboardData> {
  const pmcHistory = getMockPmcHistory();
  const latestPmc = pmcHistory.at(-1) ?? null;
  const pmcWeekAgo = pmcHistory.at(-8) ?? null;
  const ftp = getMockFtp();

  const wellnessHistory = getMockWellnessHistory(WELLNESS_HISTORY_DAYS);
  const wellnessToday = wellnessHistory.at(-1) ?? EMPTY_WELLNESS;
  const wellnessWeekAgo = wellnessHistory.at(-8) ?? wellnessHistory[0] ?? EMPTY_WELLNESS;

  const readiness = computeReadiness({
    tsb: latestPmc?.tsb ?? null,
    garminReadinessScore: wellnessToday.garminReadinessScore,
    recoveryTimeMinutes: wellnessToday.recoveryTimeMinutes,
  });

  const { today: todayKneeStatus, recent: recentCheckins } = await getCheckinsSafely();
  const gymDays = new Set(getMockGymDays(KNEE_CORRELATION_DAYS).filter((d) => d.isGymDay).map((d) => d.date));
  const kneeCorrelation = buildKneeCorrelation(pmcHistory, gymDays, recentCheckins);

  return {
    isMock: true,
    ftp,
    pmcHistory,
    latestPmc,
    wellnessToday,
    readiness,
    todayKneeStatus,
    kneeCorrelation,
    trends: {
      vo2max: trendFromPercent(wellnessToday.vo2maxCycling, wellnessWeekAgo.vo2maxCycling),
      hrv: trendFromPercent(wellnessToday.hrvWeeklyAvgMs, wellnessWeekAgo.hrvWeeklyAvgMs),
      bodyBattery: trendFromPercent(wellnessToday.bodyBatteryHigh, wellnessWeekAgo.bodyBatteryHigh),
      sleep: trendFromPercent(wellnessToday.sleepScore, wellnessWeekAgo.sleepScore),
      ctl: trendFromPercent(latestPmc?.ctl ?? null, pmcWeekAgo?.ctl ?? null),
      atl: trendFromPercent(latestPmc?.atl ?? null, pmcWeekAgo?.atl ?? null),
      tsb: trendFromDelta(latestPmc?.tsb ?? null, pmcWeekAgo?.tsb ?? null),
    },
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const rides = await getRecentRides(PMC_HISTORY_DAYS);
  if (rides.length === 0) {
    // No real rides synced yet - mock keeps the dashboard demoable/testable
    // rather than showing an empty page.
    return getMockDashboardData();
  }

  const [gymDays, wellnessHistory, { today: todayKneeStatus, recent: recentCheckins }] = await Promise.all([
    getRecentGymDays(KNEE_CORRELATION_DAYS),
    getWellnessHistory(WELLNESS_HISTORY_DAYS),
    getCheckinsSafely(),
  ]);

  const ftp = estimateFtpFromRides(rides);
  const dailyTss = buildDailyTssSeries(rides, ftp, PMC_HISTORY_DAYS);
  const pmcHistory = computeTrainingLoad(dailyTss);
  const latestPmc = pmcHistory.at(-1) ?? null;
  const pmcWeekAgo = pmcHistory.at(-8) ?? null;

  const wellnessByDate = new Map(wellnessHistory.map((w) => [w.date, w]));
  const wellnessToday = wellnessByDate.get(daysAgoDate(0)) ?? wellnessHistory.at(-1) ?? EMPTY_WELLNESS;
  const wellnessWeekAgo = wellnessByDate.get(daysAgoDate(7)) ?? null;

  const readiness = computeReadiness({
    tsb: latestPmc?.tsb ?? null,
    garminReadinessScore: wellnessToday.garminReadinessScore,
    recoveryTimeMinutes: wellnessToday.recoveryTimeMinutes,
  });

  const kneeCorrelation = buildKneeCorrelation(pmcHistory, gymDays, recentCheckins);

  return {
    isMock: false,
    ftp,
    pmcHistory,
    latestPmc,
    wellnessToday,
    readiness,
    todayKneeStatus,
    kneeCorrelation,
    trends: {
      vo2max: trendFromPercent(wellnessToday.vo2maxCycling, wellnessWeekAgo?.vo2maxCycling ?? null),
      hrv: trendFromPercent(wellnessToday.hrvWeeklyAvgMs, wellnessWeekAgo?.hrvWeeklyAvgMs ?? null),
      bodyBattery: trendFromPercent(wellnessToday.bodyBatteryHigh, wellnessWeekAgo?.bodyBatteryHigh ?? null),
      sleep: trendFromPercent(wellnessToday.sleepScore, wellnessWeekAgo?.sleepScore ?? null),
      ctl: trendFromPercent(latestPmc?.ctl ?? null, pmcWeekAgo?.ctl ?? null),
      atl: trendFromPercent(latestPmc?.atl ?? null, pmcWeekAgo?.atl ?? null),
      tsb: trendFromDelta(latestPmc?.tsb ?? null, pmcWeekAgo?.tsb ?? null),
    },
  };
}
