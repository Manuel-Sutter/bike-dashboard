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
import styles from "./page.module.css";

export default async function Home() {
  const { isMock, ftp, latestPmc, pmcHistory, wellnessToday, readiness, trends } =
    await getDashboardData();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Today</h1>
        {isMock && <span className={styles.mockBadge}>Mock data — not yet synced</span>}
      </div>

      <ReadinessBanner {...readiness} />

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
          subLabel={`Recovery trend · ${wellnessToday.hrvWeeklyAvgMs}ms avg (Garmin watch)`}
          icon={Waves}
          accent="#14b8a6"
          trend={trends.hrv}
        />
        <KpiTile
          label="Body battery"
          value={`${wellnessToday.bodyBatteryLow}–${wellnessToday.bodyBatteryHigh}`}
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

      <PmcChart history={pmcHistory} />
    </div>
  );
}
