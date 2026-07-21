"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  TooltipContentProps,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { KneeCorrelationPoint } from "@/lib/dashboard-data";
import styles from "./KneeCorrelationChart.module.css";

export interface KneeCorrelationChartProps {
  data: KneeCorrelationPoint[];
}

const ATL_COLOR = "#ff9d7a";
const KNEE_COLOR = "#ef4444";
const GYM_COLOR = "#8b5cf6";

function CorrelationTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as (KneeCorrelationPoint & { gymBarValue: number }) | undefined;
  if (!point) return null;

  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipDate}>{label}</span>
      <span style={{ color: ATL_COLOR }}>ATL: {point.atl}</span>
      {point.kneeStatus !== null && (
        <span style={{ color: KNEE_COLOR }}>Knee: {point.kneeStatus}/5</span>
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
  }));

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.title}>Knee vs. training load (30 days)</span>
          <span className={styles.subtitle}>
            ATL = your recent training fatigue (rolling ~7-day load, same number as the ATL tile
            above)
          </span>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ background: ATL_COLOR }} /> ATL
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ background: KNEE_COLOR }} /> Knee (1-5)
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
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
            <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="atl"
              width={38}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis yAxisId="knee" domain={[0, 5]} hide />
            <Tooltip content={(props) => <CorrelationTooltip {...props} />} />
            <Bar yAxisId="knee" dataKey="gymBarValue" fill={GYM_COLOR} barSize={4} opacity={0.6} />
            <Line
              yAxisId="atl"
              type="monotone"
              dataKey="atl"
              stroke={ATL_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
            />
            <Line
              yAxisId="knee"
              type="monotone"
              dataKey="kneeStatus"
              stroke="none"
              dot={{ stroke: KNEE_COLOR, fill: KNEE_COLOR, r: 4 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
