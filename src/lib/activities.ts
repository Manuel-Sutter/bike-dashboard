import { getSupabaseServerClient } from "./supabase";
import { computeTSS, estimateFTP, type DailyTss } from "./training";

export interface RideRecord {
  id: number;
  garminActivityId: number;
  name: string | null;
  date: string; // YYYY-MM-DD, derived from started_at
  startedAt: string;
  durationS: number | null;
  avgPowerW: number | null;
  watts: number[] | null;
}

// Every cycling-flavored typeKey Garmin uses - see scripts/garmin_sync.py's
// matching allowlist.
const CYCLING_TYPE_KEYS = [
  "cycling",
  "road_biking",
  "gravel_cycling",
  "mountain_biking",
  "virtual_ride",
  "indoor_cycling",
  "cyclocross",
  "track_cycling",
];

export async function getRecentRides(days: number): Promise<RideRecord[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("activities")
    // Never select `streams` here - it's the full raw Garmin blob (GPS
    // trace + everything else), often 1MB+ per ride. power_series is the
    // compact derived column (see scripts/garmin_sync.py) - selecting
    // streams for a 90-day window was taking 5+ seconds and ~30MB for less
    // than 40 rides.
    .select("id, garmin_activity_id, name, started_at, duration_s, avg_power_w, power_series")
    .in("activity_type", CYCLING_TYPE_KEYS)
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    garminActivityId: row.garmin_activity_id,
    name: row.name,
    date: row.started_at.slice(0, 10),
    startedAt: row.started_at,
    durationS: row.duration_s,
    avgPowerW: row.avg_power_w,
    watts: row.power_series,
  }));
}

export async function getRecentGymDays(days: number): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("activities")
    .select("started_at")
    .eq("activity_type", "strength_training")
    .gte("started_at", since.toISOString());

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.started_at.slice(0, 10)));
}

// Best (highest) 20-minute-power-based FTP estimate across all recent rides
// with a real power stream - a single ride's best effort represents FTP
// better than averaging across rides of very different intensity.
export function estimateFtpFromRides(rides: RideRecord[]): number | null {
  let best: number | null = null;
  for (const ride of rides) {
    if (!ride.watts) continue;
    const est = estimateFTP(ride.watts);
    if (est !== null && (best === null || est > best)) best = est;
  }
  return best;
}

// Builds a contiguous daily series (rest days included as tss: 0) for the
// PMC engine (computeTrainingLoad), summing same-day rides' TSS together.
export function buildDailyTssSeries(rides: RideRecord[], ftp: number | null, days: number): DailyTss[] {
  const tssByDate = new Map<string, number>();
  if (ftp !== null) {
    for (const ride of rides) {
      if (!ride.watts) continue;
      const tss = computeTSS({ watts: ride.watts, ftp });
      if (tss === null) continue;
      tssByDate.set(ride.date, (tssByDate.get(ride.date) ?? 0) + tss);
    }
  }

  const today = new Date();
  const series: DailyTss[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    series.push({ date, tss: tssByDate.get(date) ?? 0 });
  }
  return series;
}
