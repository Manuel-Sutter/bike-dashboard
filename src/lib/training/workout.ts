import type { ReadinessResult } from "./readiness";
import type { DailyTss } from "./pmc";

// Ordered low -> high; index doubles as an intensity rank for capping logic.
const LADDER = [
  "rest",
  "recovery",
  "endurance",
  "sweet_spot",
  "threshold",
  "vo2max",
] as const;

export type WorkoutType = (typeof LADDER)[number];

export interface WorkoutContext {
  hrvStatus: string | null;
  bodyBatteryLow: number | null;
  sleepScore: number | null;
  vo2max: number | null;
}

export interface WorkoutInput {
  availableMinutes: number;
  /** 1 = no issue, 5 = significant pain. */
  kneeStatus: number;
  readiness: ReadinessResult;
  ftp: number | null;
  /** Days strictly before today, oldest first. Want 28+ for a real ACWR. */
  recentDailyTss?: DailyTss[];
  context?: WorkoutContext;
}

export interface WorkoutSegment {
  label: string;
  durationMinutes: number;
  powerLowW: number | null;
  powerHighW: number | null;
}

export interface WorkoutPlan {
  type: WorkoutType;
  title: string;
  totalDurationMinutes: number;
  segments: WorkoutSegment[];
  guidance: string;
  description: string;
  reasoning: string[];
}

const TITLE: Record<WorkoutType, string> = {
  rest: "Rest day",
  recovery: "Recovery spin",
  endurance: "Endurance ride",
  sweet_spot: "Sweet spot intervals",
  threshold: "Threshold intervals",
  vo2max: "VO2max intervals",
};

// % of FTP, Coggan/Allen zones. Interval structure (rep count/duration/
// recovery) below is separately researched per zone - see INTERVAL_UNIT.
const FTP_PERCENT: Record<WorkoutType, [number, number] | null> = {
  rest: null,
  recovery: [0.5, 0.6],
  endurance: [0.6, 0.75],
  sweet_spot: [0.88, 0.94],
  threshold: [0.95, 1.05],
  vo2max: [1.06, 1.2],
};

// Minimum minutes needed for the type's structure (warmup + main set +
// cooldown) to make sense at all. No entry for rest/recovery - both fit in
// any amount of time.
const MIN_DURATION_MIN: Partial<Record<WorkoutType, number>> = {
  endurance: 30,
  sweet_spot: 45,
  threshold: 50,
  vo2max: 40,
};

const MAX_DURATION_MIN: Partial<Record<WorkoutType, number>> = {
  recovery: 60,
  endurance: 180,
  sweet_spot: 90,
  threshold: 75,
  vo2max: 75,
};

const READINESS_CEILING: Record<ReadinessResult["recommendation"], WorkoutType> = {
  rest: "rest",
  easy: "endurance",
  moderate: "sweet_spot",
  hard_ok: "vo2max",
};

// Rep/work/recovery structure per zone. Researched 2026-07 via direct web
// search (not the full adversarial-verification workflow - re-check against
// primary sources if this ever matters a lot):
// - Sweet spot: most riders run 8-20 min reps (commonly 10-15), classic
//   session "3x12 min or 2x20 min" with short recoveries. Using 12/5 as the
//   base unit and scaling rep count to available time.
// - Threshold: repeatedly-cited standard is 2x20 min @ 95-105% FTP, 5 min
//   easy between, 15 min warmup first (TrainerRoad, Friel's Training Bible).
// - VO2max: a cycling-specific self-paced-interval study found a 2:1
//   work:recovery ratio (4 min/2 min or 8 min/4 min) maximized time spent
//   near VO2max; that lines up with running-literature rep counts of 4-6
//   reps at ~4 min work. Using 4/2 as the base unit.
const WARMUP_MINUTES = 15;
const COOLDOWN_MINUTES = 10;
const INTERVAL_UNIT: Partial<Record<WorkoutType, { work: number; recovery: number }>> = {
  sweet_spot: { work: 12, recovery: 5 },
  threshold: { work: 20, recovery: 5 },
  vo2max: { work: 4, recovery: 2 },
};

// Gabbett's Acute:Chronic Workload Ratio (BJSM 2016): 7-day acute load over
// 28-day chronic load. 0.8-1.3 is the widely-cited "sweet spot", >1.5 the
// "danger zone" for injury risk. IMPORTANT: this is a contested metric -
// Impellizzeri, Windt and others have shown the acute window is
// mathematically a subset of the chronic one, which inflates the
// correlation ("mathematical coupling"), and some re-analyses find a
// randomly-generated chronic load predicts injury just as well. Treat the
// threshold below as a rough flag worth surfacing, not a validated
// diagnosis - the reasoning text says so explicitly rather than presenting
// it as settled science.
const ACWR_ACUTE_DAYS = 7;
const ACWR_CHRONIC_DAYS = 28;
const ACWR_DANGER_THRESHOLD = 1.5;
const ACWR_UNDERTRAINED_THRESHOLD = 0.8;
const ACWR_CAP: WorkoutType = "endurance";

function kneeCeiling(kneeStatus: number): WorkoutType {
  if (kneeStatus >= 4) return "recovery"; // floor here, never forces a full rest day by itself
  if (kneeStatus === 3) return "endurance";
  return "vo2max"; // no cap
}

function kneeGuidance(kneeStatus: number): string {
  if (kneeStatus >= 4) {
    return "Knee flagged sore (4-5/5): stay seated, cadence 85+ rpm, no standing climbs or hard torque.";
  }
  if (kneeStatus === 3) {
    return "Knee mildly irritated (3/5): cadence 80+ rpm, avoid standing climbs.";
  }
  return "Cadence in your normal range is fine.";
}

function computeAcwr(recentDailyTss: DailyTss[]): number | null {
  if (recentDailyTss.length < ACWR_CHRONIC_DAYS) return null;
  const chronic = recentDailyTss.slice(-ACWR_CHRONIC_DAYS);
  const acute = recentDailyTss.slice(-ACWR_ACUTE_DAYS);
  const chronicAvg = chronic.reduce((sum, d) => sum + d.tss, 0) / chronic.length;
  const acuteAvg = acute.reduce((sum, d) => sum + d.tss, 0) / acute.length;
  if (chronicAvg === 0) return null;
  return acuteAvg / chronicAvg;
}

function relativeDayLabel(daysAgo: number): string {
  return daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
}

function recentLoadSummary(recentDailyTss: DailyTss[]): string | null {
  const lastDays = recentDailyTss.slice(-3);
  if (lastDays.length === 0) return null;

  const parts = lastDays.map((d, i) => {
    const daysAgo = lastDays.length - i;
    const tssLabel = d.tss === 0 ? "rest" : `${Math.round(d.tss)} TSS`;
    return `${relativeDayLabel(daysAgo)}: ${tssLabel}`;
  });
  return `Recent days — ${parts.join(", ")}`;
}

function powerRange(type: WorkoutType, ftp: number | null): [number | null, number | null] {
  const pct = FTP_PERCENT[type];
  if (!pct || !ftp) return [null, null];
  return [Math.round(ftp * pct[0]), Math.round(ftp * pct[1])];
}

function buildSegments(type: WorkoutType, durationMinutes: number, ftp: number | null): WorkoutSegment[] {
  if (type === "rest") return [];

  const [powerLowW, powerHighW] = powerRange(type, ftp);
  const unit = INTERVAL_UNIT[type];

  if (!unit) {
    // Recovery / endurance: continuous ride, no interval structure.
    return [{ label: TITLE[type], durationMinutes, powerLowW, powerHighW }];
  }

  const mainSetBudget = Math.max(0, durationMinutes - WARMUP_MINUTES - COOLDOWN_MINUTES);
  const reps = Math.max(1, Math.floor((mainSetBudget + unit.recovery) / (unit.work + unit.recovery)));

  const [warmupLowW, warmupHighW] = powerRange("endurance", ftp);
  const [recoveryLowW, recoveryHighW] = powerRange("recovery", ftp);

  const segments: WorkoutSegment[] = [
    { label: "Warmup", durationMinutes: WARMUP_MINUTES, powerLowW: warmupLowW, powerHighW: warmupHighW },
  ];
  for (let i = 0; i < reps; i++) {
    segments.push({ label: `Interval ${i + 1}`, durationMinutes: unit.work, powerLowW, powerHighW });
    if (i < reps - 1) {
      segments.push({
        label: "Recovery",
        durationMinutes: unit.recovery,
        powerLowW: recoveryLowW,
        powerHighW: recoveryHighW,
      });
    }
  }
  segments.push({
    label: "Cooldown",
    durationMinutes: COOLDOWN_MINUTES,
    powerLowW: recoveryLowW,
    powerHighW: recoveryHighW,
  });

  return segments;
}

export function generateWorkout({
  availableMinutes,
  kneeStatus,
  readiness,
  ftp,
  recentDailyTss = [],
  context,
}: WorkoutInput): WorkoutPlan {
  const reasoning: string[] = [];

  const loadSummary = recentLoadSummary(recentDailyTss);
  if (loadSummary) reasoning.push(loadSummary);

  const acwr = computeAcwr(recentDailyTss);
  const acwrCapsIntensity = acwr !== null && acwr > ACWR_DANGER_THRESHOLD;
  if (acwr !== null) {
    reasoning.push(
      `ACWR (7d/28d load ratio): ${acwr.toFixed(2)} — Gabbett's cited danger zone starts above ${ACWR_DANGER_THRESHOLD} (contested metric - treat as a rough flag, not a diagnosis)`
    );
    if (!acwrCapsIntensity && acwr < ACWR_UNDERTRAINED_THRESHOLD) {
      reasoning.push(`ACWR below ${ACWR_UNDERTRAINED_THRESHOLD} suggests undertraining rather than overreaching`);
    }
  } else if (recentDailyTss.length > 0) {
    reasoning.push(`Not enough training history yet (need ${ACWR_CHRONIC_DAYS}d) to compute ACWR`);
  }

  const tsbText = readiness.signals.tsb !== null ? Math.round(readiness.signals.tsb) : "unknown";
  reasoning.push(`Readiness: ${readiness.recommendation} (TSB ${tsbText}, category ${readiness.signals.tsbCategory})`);
  if (readiness.signals.garminReadinessScore !== null) {
    reasoning.push(
      `Garmin readiness score: ${readiness.signals.garminReadinessScore} (${readiness.signals.garminReadinessCategory})`
    );
  }
  if (readiness.signals.stillRecovering) {
    reasoning.push("Garmin recovery time is still running");
  }

  if (context) {
    if (context.hrvStatus) {
      reasoning.push(`HRV status: ${context.hrvStatus}`);
    }
    if (context.bodyBatteryLow !== null) {
      const flag = context.bodyBatteryLow < 30 ? " (low)" : "";
      reasoning.push(`Body battery low today: ${context.bodyBatteryLow}${flag}`);
    }
    if (context.sleepScore !== null) {
      const flag = context.sleepScore < 60 ? " (poor)" : "";
      reasoning.push(`Sleep score: ${context.sleepScore}${flag}`);
    }
    if (context.vo2max !== null) {
      reasoning.push(`VO2max: ${context.vo2max}`);
    }
  }

  reasoning.push(`Knee status: ${kneeStatus}/5`);
  reasoning.push(`Available time: ${availableMinutes} min`);

  const readinessIndex = LADDER.indexOf(READINESS_CEILING[readiness.recommendation]);
  const kneeIndex = LADDER.indexOf(kneeCeiling(kneeStatus));
  const acwrIndex = acwrCapsIntensity ? LADDER.indexOf(ACWR_CAP) : LADDER.length - 1;

  let index = Math.min(readinessIndex, kneeIndex, acwrIndex);
  if (kneeIndex < readinessIndex && kneeIndex <= acwrIndex) {
    reasoning.push(`Capped by knee status (would otherwise be ${LADDER[Math.min(readinessIndex, acwrIndex)]})`);
  } else if (acwrIndex < readinessIndex && acwrIndex < kneeIndex) {
    reasoning.push(`Capped by high ACWR (would otherwise be ${LADDER[readinessIndex]})`);
  }

  // Threshold and VO2max are both "top tier" but serve different purposes,
  // not strictly more/less intense than each other - threshold needs more
  // total time (a full 2x20min session) than VO2max's short, sharp reps do.
  // On an uncapped top-tier day, prefer the full threshold session when
  // there's genuinely enough time for it (2 reps, not just 1); otherwise
  // VO2max's shorter structure makes better use of a tighter slot.
  if (LADDER[index] === "vo2max") {
    const thresholdUnit = INTERVAL_UNIT.threshold!;
    const fullThresholdSessionMinutes =
      WARMUP_MINUTES + 2 * thresholdUnit.work + thresholdUnit.recovery + COOLDOWN_MINUTES;
    if (availableMinutes >= fullThresholdSessionMinutes) {
      index = LADDER.indexOf("threshold");
      reasoning.push(
        `Enough time for a full 2x${thresholdUnit.work}min threshold session (${fullThresholdSessionMinutes}+ min) - preferring that over a shorter VO2max block`
      );
    }
  }

  while (index > 1) {
    const type = LADDER[index];
    const minDuration = MIN_DURATION_MIN[type];
    if (minDuration && availableMinutes < minDuration) {
      reasoning.push(`${TITLE[type]} needs ${minDuration}+ min, only ${availableMinutes} available - downgrading`);
      index--;
    } else {
      break;
    }
  }

  const type = LADDER[index];
  const cappedDuration =
    type === "rest" ? 0 : Math.min(availableMinutes, MAX_DURATION_MIN[type] ?? availableMinutes);

  const segments = buildSegments(type, cappedDuration, ftp);
  const totalDurationMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);

  const guidance = type === "rest" ? "No structured ride today." : kneeGuidance(kneeStatus);

  const [powerLowW, powerHighW] = powerRange(type, ftp);
  const description =
    type === "rest"
      ? "Take a full rest day - no structured ride today."
      : `${totalDurationMinutes} min ${TITLE[type].toLowerCase()}` +
        (powerLowW && powerHighW ? `, ${powerLowW}-${powerHighW}W` : "") +
        `. ${guidance}`;

  return {
    type,
    title: TITLE[type],
    totalDurationMinutes,
    segments,
    guidance,
    description,
    reasoning,
  };
}
