// Coggan's own published TSB bands (via TrainingPeaks "Applying the Numbers"
// and multiple corroborating coaching sources, checked 2026-07): racing/peak
// readiness sits at TSB 0 to +25; normal in-training fatigue is -10 to -30;
// below -30 is where fatigue outpaces recovery capacity (overtraining risk).
// Sourced via direct web search, not the full adversarial verification
// workflow - re-check against primary sources if this ever matters a lot.
const TSB_FRESH_THRESHOLD = 0;
const TSB_FATIGUED_THRESHOLD = -30;
const GARMIN_READINESS_GOOD_THRESHOLD = 70;
const GARMIN_READINESS_LOW_THRESHOLD = 40;

export type TsbCategory = "fresh" | "neutral" | "fatigued" | "unknown";
export type GarminReadinessCategory = "good" | "moderate" | "low" | "unknown";
export type ReadinessRecommendation = "rest" | "easy" | "moderate" | "hard_ok";

export interface ReadinessInput {
  /** Our own TSB (CTL - ATL) from the power-based training engine. */
  tsb: number | null;
  /** Garmin's own 0-100 training readiness score, if a watch is synced. */
  garminReadinessScore?: number | null;
  /** Minutes of recovery Garmin's watch still has the rider logged as needing. */
  recoveryTimeMinutes?: number | null;
}

export interface ReadinessResult {
  recommendation: ReadinessRecommendation;
  signals: {
    tsb: number | null;
    tsbCategory: TsbCategory;
    garminReadinessScore: number | null;
    garminReadinessCategory: GarminReadinessCategory;
    stillRecovering: boolean;
  };
}

function categorizeTsb(tsb: number | null): TsbCategory {
  if (tsb === null) return "unknown";
  if (tsb >= TSB_FRESH_THRESHOLD) return "fresh";
  if (tsb <= TSB_FATIGUED_THRESHOLD) return "fatigued";
  return "neutral";
}

function categorizeGarminReadiness(
  score: number | null | undefined
): GarminReadinessCategory {
  if (score === null || score === undefined) return "unknown";
  if (score >= GARMIN_READINESS_GOOD_THRESHOLD) return "good";
  if (score < GARMIN_READINESS_LOW_THRESHOLD) return "low";
  return "moderate";
}

// Two independent signals (our power-based TSB, Garmin's own sensor-based
// readiness score) generally agree; this only escalates to "rest" when both
// point the same way, or when Garmin's watch says recovery time is still
// running on top of a fatigued TSB AND Garmin's own composite score isn't
// already "good" - recoveryTime is itself one of the inputs Garmin's score
// is built from, so if the score still came out "good" despite recovery
// time running, Garmin's own algorithm already decided that's fine; letting
// stillRecovering override that verdict was double-counting the same
// signal against Garmin's own conclusion. A single signal alone just
// downgrades to "easy" rather than overriding a workout entirely.
export function computeReadiness({
  tsb,
  garminReadinessScore = null,
  recoveryTimeMinutes = null,
}: ReadinessInput): ReadinessResult {
  const tsbCategory = categorizeTsb(tsb);
  const garminReadinessCategory = categorizeGarminReadiness(garminReadinessScore);
  const stillRecovering = (recoveryTimeMinutes ?? 0) > 0;

  const signals = {
    tsb,
    tsbCategory,
    garminReadinessScore,
    garminReadinessCategory,
    stillRecovering,
  };

  const eitherLowSignal =
    tsbCategory === "fatigued" || garminReadinessCategory === "low";

  if (
    tsbCategory === "fatigued" &&
    garminReadinessCategory !== "good" &&
    (garminReadinessCategory === "low" || stillRecovering)
  ) {
    return { recommendation: "rest", signals };
  }

  if (eitherLowSignal || stillRecovering) {
    return { recommendation: "easy", signals };
  }

  if (tsbCategory === "fresh" && garminReadinessCategory !== "moderate") {
    return { recommendation: "hard_ok", signals };
  }

  return { recommendation: "moderate", signals };
}
