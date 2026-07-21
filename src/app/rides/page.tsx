import Link from "next/link";
import { estimateFtpFromRides, getRecentRides, type RideRecord } from "@/lib/activities";
import { classifyRide, computeTSS, type RideAnalysis } from "@/lib/training";
import { WORKOUT_TYPE_STYLE } from "@/components/dashboard/workoutTypeStyle";
import styles from "./page.module.css";

// Ride history changes with every sync - never freeze it as a build-time
// static snapshot.
export const dynamic = "force-dynamic";

const HISTORY_DAYS = 90;

function formatDuration(durationS: number | null): string {
  if (durationS === null) return "—";
  const h = Math.floor(durationS / 3600);
  const m = Math.round((durationS % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(startedAt: string): string {
  return new Date(startedAt).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

interface RideWithAnalysis extends RideRecord {
  analysis: RideAnalysis | null;
  tss: number | null;
}

function analyzeRides(rides: RideRecord[], ftp: number | null): RideWithAnalysis[] {
  return rides.map((ride) => {
    if (!ride.watts || ftp === null) {
      return { ...ride, analysis: null, tss: null };
    }
    return {
      ...ride,
      analysis: classifyRide(ride.watts, ftp),
      tss: computeTSS({ watts: ride.watts, ftp }),
    };
  });
}

export default async function RidesPage() {
  const rides = await getRecentRides(HISTORY_DAYS);
  const ftp = estimateFtpFromRides(rides);
  const analyzed = analyzeRides(rides, ftp).reverse(); // newest first

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← Today
        </Link>
        <h1 className={styles.title}>Ride history</h1>
        <span className={styles.subtitle}>
          Last {HISTORY_DAYS} days · tagged automatically from each ride&apos;s power data
          {ftp ? ` (FTP ${Math.round(ftp)}W)` : ""}
        </span>
      </div>

      {analyzed.length === 0 && <span className={styles.empty}>No rides synced yet.</span>}

      <ul className={styles.rideList}>
        {analyzed.map((ride) => {
          const primaryStyle = ride.analysis ? WORKOUT_TYPE_STYLE[ride.analysis.primary] : null;
          const hardEffortStyle = ride.analysis?.hardEffort
            ? WORKOUT_TYPE_STYLE[ride.analysis.hardEffort]
            : null;
          const Icon = primaryStyle?.icon;
          return (
            <li key={ride.id} className={styles.rideRow}>
              <div className={styles.rideMain}>
                {Icon && primaryStyle && (
                  <span
                    className={styles.rideIcon}
                    style={{
                      background: `color-mix(in srgb, ${primaryStyle.accent} 18%, transparent)`,
                      color: primaryStyle.accent,
                    }}
                  >
                    <Icon size={18} strokeWidth={2} />
                  </span>
                )}
                <div className={styles.rideInfo}>
                  <span className={styles.rideName}>{ride.name ?? "Ride"}</span>
                  <span className={styles.rideDate}>{formatDate(ride.startedAt)}</span>
                </div>
              </div>

              <div className={styles.rideStats}>
                {primaryStyle && (
                  <span className={styles.tag} style={{ color: primaryStyle.accent }}>
                    {primaryStyle.label}
                    {hardEffortStyle && (
                      <span className={styles.hardEffort} style={{ color: hardEffortStyle.accent }}>
                        {" "}
                        · {hardEffortStyle.label} effort
                      </span>
                    )}
                  </span>
                )}
                <span className={styles.stat}>{formatDuration(ride.durationS)}</span>
                <span className={styles.stat}>{ride.avgPowerW ? `${Math.round(ride.avgPowerW)}W avg` : "—"}</span>
                <span className={styles.stat}>{ride.tss !== null ? `${Math.round(ride.tss)} TSS` : "—"}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
