import Link from "next/link";
import {
  Activity,
  BatteryMedium,
  Flame,
  Gauge,
  HeartPulse,
  Moon,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import { getDashboardData } from "@/lib/dashboard-data";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ReadinessBanner } from "@/components/dashboard/ReadinessBanner";
import { PmcChart } from "@/components/dashboard/PmcChart";
import { WorkoutGenerator } from "@/components/dashboard/WorkoutGenerator";
import { KneeCorrelationChart } from "@/components/dashboard/KneeCorrelationChart";
import styles from "./page.module.css";

// This shows today's live TSB/ATL/readiness - it must never be frozen as a
// static snapshot from build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const {
    isMock,
    ftp,
    latestPmc,
    pmcHistory,
    wellnessToday,
    readiness,
    trends,
    todayKneeStatus,
    kneeCorrelation,
  } = await getDashboardData();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Today</h1>
        {isMock && <span className={styles.mockBadge}>Mock data — not yet synced</span>}
        <Link href="/rides" className={styles.navLink}>
          Ride history →
        </Link>
      </div>

      <ReadinessBanner
        {...readiness}
        context={{
          hrvStatus: wellnessToday.hrvStatus,
          bodyBatteryLow: wellnessToday.bodyBatteryLow,
          sleepScore: wellnessToday.sleepScore,
        }}
      />

      <div className={styles.kpiGrid}>
        <KpiTile
          label="FTP"
          value={ftp !== null ? Math.round(ftp) : null}
          unit="W"
          subLabel="Highest power you can hold ~1hr"
          icon={Zap}
          accent="#f59e0b"
        />
        <KpiTile
          label="CTL"
          value={latestPmc ? Math.round(latestPmc.ctl) : null}
          subLabel="Fitness — your ~6-week training load"
          icon={TrendingUp}
          accent="#7c9eff"
          trend={trends.ctl}
        />
        <KpiTile
          label="ATL"
          value={latestPmc ? Math.round(latestPmc.atl) : null}
          subLabel="Fatigue — your ~1-week training load"
          icon={Flame}
          accent="#ff9d7a"
          trend={trends.atl}
        />
        <KpiTile
          label="TSB"
          value={latestPmc ? Math.round(latestPmc.tsb) : null}
          subLabel="Form — fitness minus fatigue; negative = tired"
          icon={Gauge}
          accent="#4fd1c5"
          trend={trends.tsb}
        />
        <KpiTile
          label="VO2max"
          value={wellnessToday.vo2maxCycling}
          unit="ml/kg/min"
          subLabel="Aerobic fitness ceiling"
          icon={HeartPulse}
          accent="#8b5cf6"
          trend={trends.vo2max}
        />
        <KpiTile
          label="Training status"
          value={wellnessToday.trainingStatus}
          subLabel="Garmin's read on your load trend"
          icon={Activity}
          accent="#0ea5e9"
        />
        <KpiTile
          label="HRV status"
          value={wellnessToday.hrvStatus}
          subLabel={
            wellnessToday.hrvWeeklyAvgMs !== null
              ? `Recovery trend · ${wellnessToday.hrvWeeklyAvgMs}ms avg (Garmin watch)`
              : "Recovery trend (Garmin watch)"
          }
          icon={Waves}
          accent="#14b8a6"
          trend={trends.hrv}
        />
        <KpiTile
          label="Body battery"
          value={
            wellnessToday.bodyBatteryLow !== null && wellnessToday.bodyBatteryHigh !== null
              ? `${wellnessToday.bodyBatteryLow}–${wellnessToday.bodyBatteryHigh}`
              : null
          }
          subLabel="Today's energy reserve range (Garmin watch)"
          icon={BatteryMedium}
          accent="#22c55e"
          trend={trends.bodyBattery}
        />
        <KpiTile
          label="Sleep score"
          value={wellnessToday.sleepScore}
          subLabel="Last night's sleep quality (Garmin watch)"
          icon={Moon}
          accent="#6366f1"
          trend={trends.sleep}
        />
      </div>

      <WorkoutGenerator
        readiness={readiness}
        ftp={ftp}
        initialKneeStatus={todayKneeStatus}
        recentDailyTss={pmcHistory.slice(-29, -1)}
        context={{
          hrvStatus: wellnessToday.hrvStatus,
          bodyBatteryLow: wellnessToday.bodyBatteryLow,
          sleepScore: wellnessToday.sleepScore,
          vo2max: wellnessToday.vo2maxCycling,
        }}
      />

      <PmcChart history={pmcHistory} />
      <KneeCorrelationChart data={kneeCorrelation} />
    </div>
  );
}
