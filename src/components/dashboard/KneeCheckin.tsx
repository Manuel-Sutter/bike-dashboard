"use client";

import { useKneeStatus } from "./KneeStatusContext";
import { KNEE_LABELS } from "./kneeLabels";
import styles from "./KneeCheckin.module.css";

export function KneeCheckin() {
  const { kneeStatus, saved, setKneeStatus } = useKneeStatus();

  return (
    <div className={styles.card}>
      <div className={styles.rowLabelLine}>
        <span className={styles.label}>How&apos;s the knee today?</span>
        {saved && <span className={styles.saved}>Saved</span>}
      </div>
      <div className={styles.pillGroup}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n === kneeStatus ? styles.pillActive : styles.pill}
            onClick={() => setKneeStatus(n)}
          >
            {KNEE_LABELS[n]}
          </button>
        ))}
      </div>
    </div>
  );
}
