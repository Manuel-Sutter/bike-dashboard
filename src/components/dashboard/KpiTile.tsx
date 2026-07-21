import type { LucideIcon } from "lucide-react";
import type { Trend } from "@/lib/dashboard-data";
import styles from "./KpiTile.module.css";

export interface KpiTileProps {
  label: string;
  value: string | number | null;
  unit?: string;
  subLabel?: string;
  icon?: LucideIcon;
  accent?: string;
  trend?: Trend | null;
}

const TREND_ARROW: Record<Trend["direction"], string> = {
  up: "▲",
  down: "▼",
  flat: "•",
};

export function KpiTile({
  label,
  value,
  unit,
  subLabel,
  icon: Icon,
  accent = "var(--moderate)",
  trend,
}: KpiTileProps) {
  return (
    <div className={styles.tile}>
      <div className={styles.header}>
        {Icon && (
          <span
            className={styles.iconBadge}
            style={{
              background: `color-mix(in srgb, ${accent} 22%, transparent)`,
              color: accent,
            }}
          >
            <Icon size={18} strokeWidth={2.25} />
          </span>
        )}
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.valueRow}>
        <span className={typeof value === "string" && value.length > 7 ? styles.valueText : styles.value}>
          {value ?? "—"}
        </span>
        {unit && value !== null && <span className={styles.unit}>{unit}</span>}
      </div>
      {subLabel && <span className={styles.subLabel}>{subLabel}</span>}
      {trend && (
        <span className={`${styles.trend} ${styles[trend.direction]}`}>
          {TREND_ARROW[trend.direction]} {trend.changeText}
        </span>
      )}
    </div>
  );
}
