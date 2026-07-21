import type { ReadinessResult } from "@/lib/training";
import styles from "./ReadinessBanner.module.css";

const HEADLINES: Record<ReadinessResult["recommendation"], string> = {
  rest: "Rest day",
  easy: "Easy day",
  moderate: "Moderate load is fine",
  hard_ok: "Green light for a hard session",
};

function explainRecommendation(
  recommendation: ReadinessResult["recommendation"],
  signals: ReadinessResult["signals"]
): string {
  switch (recommendation) {
    case "rest":
      if (signals.garminReadinessCategory === "low") {
        return (
          "Both your TSB and Garmin's readiness score point to fatigue" +
          (signals.stillRecovering ? ", and Garmin still has recovery time counting down" : "") +
          " — today's the day to skip structured training."
        );
      }
      return "Your TSB points to fatigue, and Garmin still has recovery time counting down — today's the day to skip structured training.";
    case "easy":
      return signals.stillRecovering
        ? "Garmin still has recovery time counting down, so keep today light."
        : "One of your signals (TSB or Garmin readiness) is showing fatigue, so keep today light even though the other looks fine.";
    case "hard_ok":
      return "TSB is fresh and Garmin's readiness score doesn't disagree — a good day to go hard if you want to.";
    case "moderate":
      return "Nothing is flagging fatigue, but you're not clearly fresh either — moderate load is the sensible default today.";
  }
}

export interface ReadinessBannerContext {
  hrvStatus: string | null;
  bodyBatteryLow: number | null;
  sleepScore: number | null;
}

export interface ReadinessBannerProps extends ReadinessResult {
  context?: ReadinessBannerContext;
}

export function ReadinessBanner({ recommendation, signals, context }: ReadinessBannerProps) {
  return (
    <div className={`${styles.banner} ${styles[recommendation]}`}>
      <span className={styles.headline}>{HEADLINES[recommendation]}</span>
      <p className={styles.explanation}>{explainRecommendation(recommendation, signals)}</p>

      <div className={styles.signals}>
        <span>
          TSB: {signals.tsb !== null ? Math.round(signals.tsb) : "—"} (
          {signals.tsbCategory})
        </span>
        <span>
          Garmin readiness:{" "}
          {signals.garminReadinessScore ?? "—"} ({signals.garminReadinessCategory})
        </span>
        {signals.stillRecovering && <span>Recovery time still running</span>}
      </div>

      {context && (context.hrvStatus || context.bodyBatteryLow !== null || context.sleepScore !== null) && (
        <div className={styles.context}>
          {context.hrvStatus && <span>HRV: {context.hrvStatus}</span>}
          {context.bodyBatteryLow !== null && <span>Body battery low: {context.bodyBatteryLow}</span>}
          {context.sleepScore !== null && <span>Sleep score: {context.sleepScore}</span>}
        </div>
      )}
    </div>
  );
}
