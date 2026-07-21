"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyTrainingLoad } from "@/lib/training";
import styles from "./PmcChart.module.css";

export interface PmcChartProps {
  history: DailyTrainingLoad[];
}

const COLORS = {
  ctl: "#7c9eff", // soft indigo - fitness
  atl: "#ff9d7a", // soft coral - fatigue
  tsb: "#4fd1c5", // soft teal - form
};

export function PmcChart({ history }: PmcChartProps) {
  const data = history.map((day) => ({
    date: day.date,
    CTL: Math.round(day.ctl * 10) / 10,
    ATL: Math.round(day.atl * 10) / 10,
    TSB: Math.round(day.tsb * 10) / 10,
  }));

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.title}>Fitness / Fatigue / Form (90 days)</span>
          <span className={styles.subtitle}>
            CTL = fitness (6-week load), ATL = fatigue (1-week load), TSB = CTL minus ATL — your form
          </span>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ background: COLORS.ctl }} /> CTL (fitness)
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ background: COLORS.atl }} /> ATL (fatigue)
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ background: COLORS.tsb }} /> TSB (form)
          </span>
        </div>
      </div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
            <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
            <YAxis width={44} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
              }}
            />
            <Line
              type="monotone"
              dataKey="CTL"
              stroke={COLORS.ctl}
              dot={false}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <Line
              type="monotone"
              dataKey="ATL"
              stroke={COLORS.atl}
              dot={false}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Line
              type="monotone"
              dataKey="TSB"
              stroke={COLORS.tsb}
              dot={false}
              strokeWidth={1.75}
              strokeDasharray="5 3"
              strokeLinecap="round"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
