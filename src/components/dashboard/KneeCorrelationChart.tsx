"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  TooltipContentProps,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { KneeCorrelationPoint } from "@/lib/dashboard-data";
import { KNEE_LABELS } from "./kneeLabels";
import styles from "./KneeCorrelationChart.module.css";

export interface KneeCorrelationChartProps {
  data: KneeCorrelationPoint[];
}

const ATL_COLOR = "#ff9d7a";
const GYM_COLOR = "#8b5cf6";
const NO_DATA_COLOR = "rgba(255, 255, 255, 0.08)";
const KNEE_STRIP_COLORS: Record<number, string> = {
  1: "#34d399",
  2: "#a3d977",
  3: "#ffb020",
  4: "#ff8a5c",
  5: "#ff6b6b",
};
const SYNC_ID = "knee-correlation";

function CorrelationTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as (KneeCorrelationPoint & { gymBarValue: number }) | undefined;
  if (!point) return null;

  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipDate}>{label}</span>
      <span style={{ color: ATL_COLOR }}>ATL: {point.atl}</span>
      {point.kneeStatus !== null && (
        <span style={{ color: KNEE_STRIP_COLORS[point.kneeStatus] }}>
          Knee: {KNEE_LABELS[point.kneeStatus]}
        </span>
      )}
      {point.isGymDay && <span style={{ color: GYM_COLOR }}>Gym day</span>}
    </div>
  );
}

export function KneeCorrelationChart({ data }: KneeCorrelationChartProps) {
  const hasCheckins = data.some((d) => d.kneeStatus !== null);
  const chartData = data.map((d) => ({
    ...d,
    gymBarValue: d.isGymDay ? 0.4 : 0,
    stripValue: 1,
  }));

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.title}>Knee vs. training load (30 days)</span>
          <span className={styles.subtitle}>
            ATL = your recent training fatigue (rolling ~7-day load, same number as the ATL tile
            above). The strip below shows how your knee felt that day.
          </span>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ background: ATL_COLOR }} /> ATL
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ background: GYM_COLOR }} /> Gym day
          </span>
        </div>
      </div>

      {!hasCheckins && (
        <span className={styles.empty}>
          No knee check-ins logged yet - log a few days to see the pattern here.
        </span>
      )}

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} syncId={SYNC_ID} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
            <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
            <YAxis yAxisId="atl" width={38} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="gym" domain={[0, 1]} hide />
            <Tooltip content={(props) => <CorrelationTooltip {...props} />} />
            <Bar yAxisId="gym" dataKey="gymBarValue" fill={GYM_COLOR} barSize={4} opacity={0.6} />
            <Line
              yAxisId="atl"
              type="monotone"
              dataKey="atl"
              stroke={ATL_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <span className={styles.stripCaption}>Knee status</span>
      <div className={styles.stripWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} syncId={SYNC_ID} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis width={38} domain={[0, 1]} hide />
            <Tooltip content={() => null} />
            <Bar dataKey="stripValue" isAnimationActive={false}>
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.kneeStatus !== null ? KNEE_STRIP_COLORS[d.kneeStatus] : NO_DATA_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.stripLegend}>
        <span>Fine</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={styles.swatch} style={{ background: KNEE_STRIP_COLORS[n] }} />
        ))}
        <span>Sore</span>
      </div>
    </div>
  );
}
