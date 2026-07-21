import { getSupabaseServerClient } from "./supabase";

export interface WellnessDay {
  date: string;
  vo2maxCycling: number | null;
  trainingStatus: string | null;
  hrvStatus: string | null;
  hrvWeeklyAvgMs: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  sleepScore: number | null;
  recoveryTimeMinutes: number | null;
  garminReadinessScore: number | null;
}

export async function getWellnessHistory(days: number): Promise<WellnessDay[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("daily_wellness")
    .select(
      "date, vo2max_cycling, training_status, hrv_status, hrv_weekly_avg_ms, body_battery_high, body_battery_low, sleep_score, recovery_time_minutes, readiness_score"
    )
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    date: row.date,
    vo2maxCycling: row.vo2max_cycling,
    trainingStatus: row.training_status,
    hrvStatus: row.hrv_status,
    hrvWeeklyAvgMs: row.hrv_weekly_avg_ms,
    bodyBatteryHigh: row.body_battery_high,
    bodyBatteryLow: row.body_battery_low,
    sleepScore: row.sleep_score,
    recoveryTimeMinutes: row.recovery_time_minutes,
    garminReadinessScore: row.readiness_score,
  }));
}
