import { bestAveragePower, normalizedPower } from "./power";
import type { WorkoutType } from "./workout";

export type RideClassification = Exclude<WorkoutType, "rest">;

const ORDER: RideClassification[] = ["recovery", "endurance", "sweet_spot", "threshold", "vo2max"];

// Whole-ride NP relative to FTP describes the ride's overall character -
// what kind of session was this. A ride can't sustain vo2max-level NP for
// its entire duration (that zone is fundamentally interval-only), so it's
// not a possible primary classification.
const PRIMARY_THRESHOLDS: { type: RideClassification; minPercentFtp: number }[] = [
  { type: "threshold", minPercentFtp: 0.95 },
  { type: "sweet_spot", minPercentFtp: 0.88 },
  { type: "endurance", minPercentFtp: 0.6 },
];

// Same characteristic duration + %FTP as generateWorkout's zone definitions
// - checked hardest-first so the first match is the single hardest thing
// that happened in the ride, independent of its overall character (e.g. a
// long endurance ride that included one hard climb).
const HARD_EFFORT_THRESHOLDS: { type: RideClassification; durationSeconds: number; minPercentFtp: number }[] = [
  { type: "vo2max", durationSeconds: 4 * 60, minPercentFtp: 1.06 },
  { type: "threshold", durationSeconds: 20 * 60, minPercentFtp: 0.95 },
  { type: "sweet_spot", durationSeconds: 12 * 60, minPercentFtp: 0.88 },
];

export interface RideAnalysis {
  /** Overall character of the ride, from whole-ride normalized power. */
  primary: RideClassification;
  /** The single hardest qualifying effort found, if harder than `primary` - e.g. a hard climb during an otherwise easy ride. Null if nothing exceeded the ride's own overall character. */
  hardEffort: RideClassification | null;
}

function primaryFromNp(np: number, ftp: number): RideClassification {
  for (const { type, minPercentFtp } of PRIMARY_THRESHOLDS) {
    if (np >= ftp * minPercentFtp) return type;
  }
  return "recovery";
}

export function classifyRide(watts: number[], ftp: number): RideAnalysis {
  const np = normalizedPower(watts) ?? 0;
  const primary = primaryFromNp(np, ftp);
  const primaryRank = ORDER.indexOf(primary);

  let hardEffort: RideClassification | null = null;
  for (const { type, durationSeconds, minPercentFtp } of HARD_EFFORT_THRESHOLDS) {
    if (ORDER.indexOf(type) <= primaryRank) continue;
    const best = bestAveragePower(watts, durationSeconds);
    if (best !== null && best >= ftp * minPercentFtp) {
      hardEffort = type;
      break;
    }
  }

  return { primary, hardEffort };
}
