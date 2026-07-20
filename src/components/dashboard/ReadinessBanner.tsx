import type { ReadinessResult } from "@/lib/training";
import styles from "./ReadinessBanner.module.css";

const HEADLINES: Record<ReadinessResult["recommendation"], string> = {
  rest: "Rest day",
  easy: "Easy day",
  moderate: "Moderate load is fine",
  hard_ok: "Green light for a hard session",
};

export function ReadinessBanner({ recommendation, signals }: ReadinessResult) {
  return (
    <div className={`${styles.banner} ${styles[recommendation]}`}>
      <span className={styles.headline}>{HEADLINES[recommendation]}</span>
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
    </div>
  );
}
