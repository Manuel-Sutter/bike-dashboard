"use client";

import { useState } from "react";
import {
  generateWorkout,
  type DailyTss,
  type ReadinessResult,
  type WorkoutContext,
  type WorkoutPlan,
} from "@/lib/training";
import { useKneeStatus } from "./KneeStatusContext";
import { KNEE_LABELS } from "./kneeLabels";
import { WORKOUT_TYPE_STYLE } from "./workoutTypeStyle";
import styles from "./WorkoutGenerator.module.css";

const TIME_PRESETS = [30, 45, 60, 75, 90, 120];

export interface WorkoutGeneratorProps {
  readiness: ReadinessResult;
  ftp: number | null;
  recentDailyTss: DailyTss[];
  context: WorkoutContext;
}

export function WorkoutGenerator({ readiness, ftp, recentDailyTss, context }: WorkoutGeneratorProps) {
  const { kneeStatus } = useKneeStatus();
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);

  function handleGenerate() {
    if (availableMinutes === null) return;
    setPlan(generateWorkout({ availableMinutes, kneeStatus, readiness, ftp, recentDailyTss, context }));
  }

  const style = plan ? WORKOUT_TYPE_STYLE[plan.type] : null;
  const Icon = style?.icon;

  return (
    <div className={styles.card}>
      <span className={styles.title}>Generate today&apos;s workout</span>

      <div className={styles.rowLabelLine}>
        <span className={styles.rowLabel}>
          Knee today: <strong>{KNEE_LABELS[kneeStatus]}</strong>
        </span>
        <span className={styles.rowLabel}>change above ↑</span>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Time available</span>
        <div className={styles.pillGroup}>
          {TIME_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={minutes === availableMinutes ? styles.pillActive : styles.pill}
              onClick={() => setAvailableMinutes(minutes)}
            >
              {minutes}m
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={styles.generateButton}
        disabled={availableMinutes === null}
        onClick={handleGenerate}
      >
        Generate
      </button>

      {plan && style && Icon && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <span
              className={styles.resultIcon}
              style={{
                background: `color-mix(in srgb, ${style.accent} 18%, transparent)`,
                color: style.accent,
              }}
            >
              <Icon size={20} strokeWidth={2} />
            </span>
            <span className={styles.resultTitle}>{plan.title}</span>
          </div>

          {plan.totalDurationMinutes > 0 && (
            <div className={styles.badgeRow}>
              <span className={styles.badge}>{plan.totalDurationMinutes} min total</span>
            </div>
          )}

          {plan.segments.length > 0 && (
            <ul className={styles.segmentList}>
              {plan.segments.map((s, i) => (
                <li key={`${s.label}-${i}`} className={styles.segmentRow}>
                  <span className={styles.segmentLabel}>{s.label}</span>
                  <span className={styles.segmentDetail}>
                    {s.durationMinutes} min
                    {s.powerLowW && s.powerHighW ? ` · ${s.powerLowW}–${s.powerHighW} W` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <span className={styles.guidance}>{plan.guidance}</span>

          <div className={styles.why}>
            <span className={styles.whyTitle}>Why this workout</span>
            <ul className={styles.reasoning}>
              {plan.reasoning.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
