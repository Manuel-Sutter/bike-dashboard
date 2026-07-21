import { describe, expect, it } from "vitest";
import { generateWorkout } from "./workout";
import type { ReadinessResult } from "./readiness";
import type { DailyTss } from "./pmc";

function readiness(
  recommendation: ReadinessResult["recommendation"],
  tsb: number | null = 0
): ReadinessResult {
  return {
    recommendation,
    signals: {
      tsb,
      tsbCategory: "neutral",
      garminReadinessScore: null,
      garminReadinessCategory: "unknown",
      stillRecovering: false,
    },
  };
}

// 28 days of low, steady load (well under both the acute and chronic
// average, so ACWR stays near 1 and never triggers the danger-zone cap) -
// a neutral baseline recentDailyTss for tests that aren't about ACWR itself.
function neutralHistory(days = 28): DailyTss[] {
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    tss: 50,
  }));
}

describe("generateWorkout", () => {
  it("prescribes rest when readiness says rest, regardless of knee or time", () => {
    const plan = generateWorkout({
      availableMinutes: 120,
      kneeStatus: 1,
      readiness: readiness("rest"),
      ftp: 250,
    });
    expect(plan.type).toBe("rest");
    expect(plan.totalDurationMinutes).toBe(0);
    expect(plan.segments).toEqual([]);
  });

  it("caps to recovery when the knee is flagged sore, even on a great readiness day", () => {
    const plan = generateWorkout({
      availableMinutes: 120,
      kneeStatus: 4,
      readiness: readiness("hard_ok"),
      ftp: 250,
    });
    expect(plan.type).toBe("recovery");
    expect(plan.reasoning.some((r) => r.includes("Capped by knee status"))).toBe(true);
  });

  it("caps to endurance when the knee is mildly irritated", () => {
    const plan = generateWorkout({
      availableMinutes: 120,
      kneeStatus: 3,
      readiness: readiness("moderate"),
      ftp: 250,
    });
    expect(plan.type).toBe("endurance");
  });

  it("does not cap intensity when the knee is fine", () => {
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("hard_ok"),
      ftp: 250,
    });
    // 90 min is enough for a full 2x20 threshold session, which is
    // preferred over a shorter VO2max block - see the vo2max-specific test
    // for that preference logic. The point here is just that knee=1 doesn't
    // cap it down to something easier.
    expect(plan.type).toBe("threshold");
  });

  it("downgrades a structured workout when there isn't enough time for it", () => {
    const plan = generateWorkout({
      availableMinutes: 35,
      kneeStatus: 1,
      readiness: readiness("moderate"), // ceiling: sweet_spot, needs 45+ min
      ftp: 250,
    });
    expect(plan.type).toBe("endurance");
    expect(plan.reasoning.some((r) => r.includes("downgrading"))).toBe(true);
  });

  it("caps duration at the type's realistic maximum even with lots of time available", () => {
    const plan = generateWorkout({
      availableMinutes: 240,
      kneeStatus: 1,
      readiness: readiness("moderate"),
      ftp: 250,
    });
    expect(plan.type).toBe("sweet_spot");
    expect(plan.totalDurationMinutes).toBeLessThanOrEqual(90);
  });

  it("omits power targets when FTP is unknown", () => {
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("moderate"),
      ftp: null,
    });
    expect(plan.segments.every((s) => s.powerLowW === null && s.powerHighW === null)).toBe(true);
  });

  it("builds a sweet spot session as warmup + reps + cooldown, matching the researched 12min/5min structure", () => {
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("moderate"), // sweet_spot: 88-94% FTP
      ftp: 250,
    });
    expect(plan.segments[0]).toMatchObject({ label: "Warmup", durationMinutes: 15 });
    expect(plan.segments.at(-1)).toMatchObject({ label: "Cooldown", durationMinutes: 10 });

    const intervals = plan.segments.filter((s) => s.label.startsWith("Interval"));
    expect(intervals.length).toBeGreaterThanOrEqual(1);
    for (const interval of intervals) {
      expect(interval.durationMinutes).toBe(12);
      expect(interval.powerLowW).toBe(220); // 250 * 0.88
      expect(interval.powerHighW).toBe(235); // 250 * 0.94
    }

    const recoveries = plan.segments.filter((s) => s.label === "Recovery");
    expect(recoveries.length).toBe(intervals.length - 1);
    for (const recovery of recoveries) {
      expect(recovery.durationMinutes).toBe(5);
    }
  });

  it("builds a threshold session as 2x20min with 5min recovery when there's enough time", () => {
    const plan = generateWorkout({
      availableMinutes: 75,
      kneeStatus: 1,
      readiness: readiness("hard_ok"),
      ftp: 250,
    });
    expect(plan.type).toBe("threshold");
    const intervals = plan.segments.filter((s) => s.label.startsWith("Interval"));
    expect(intervals.length).toBe(2);
    expect(intervals[0].durationMinutes).toBe(20);
    expect(intervals[0].powerLowW).toBe(238); // 250 * 0.95, rounded
  });

  it("builds a vo2max session using a 2:1 work:recovery ratio (4min/2min)", () => {
    const plan = generateWorkout({
      availableMinutes: 60,
      kneeStatus: 1,
      readiness: readiness("hard_ok"),
      ftp: 250,
    });
    expect(plan.type).toBe("vo2max");
    const intervals = plan.segments.filter((s) => s.label.startsWith("Interval"));
    const recoveries = plan.segments.filter((s) => s.label === "Recovery");
    expect(intervals[0].durationMinutes).toBe(4);
    expect(recoveries[0]?.durationMinutes).toBe(2);
  });

  it("caps intensity when ACWR is above the 1.5 danger threshold, even on a great readiness day", () => {
    // 28 days at TSS 50 (chronic avg 50), then a sharp final week at TSS 130
    // (acute avg 130) -> ACWR = 130/50 = 2.6, well above 1.5.
    const history: DailyTss[] = [
      ...Array.from({ length: 21 }, (_, i) => ({ date: `d${i}`, tss: 50 })),
      ...Array.from({ length: 7 }, (_, i) => ({ date: `d${21 + i}`, tss: 130 })),
    ];
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("hard_ok"),
      ftp: 250,
      recentDailyTss: history,
    });
    expect(plan.type).toBe("endurance");
    expect(plan.reasoning.some((r) => r.includes("Capped by high ACWR"))).toBe(true);
  });

  it("does not cap intensity when ACWR is within the sweet spot", () => {
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("hard_ok"),
      ftp: 250,
      recentDailyTss: neutralHistory(),
    });
    // 90 min prefers the full threshold session over VO2max - see comment
    // in the knee test above.
    expect(plan.type).toBe("threshold");
  });

  it("skips ACWR when there isn't enough history yet", () => {
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("hard_ok"),
      ftp: 250,
      recentDailyTss: neutralHistory(10),
    });
    expect(plan.reasoning.some((r) => r.includes("Not enough training history"))).toBe(true);
    expect(plan.type).toBe("threshold");
  });

  it("surfaces wellness context KPIs in the reasoning, flagging low values", () => {
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("moderate"),
      ftp: 250,
      context: { hrvStatus: "UNBALANCED", bodyBatteryLow: 15, sleepScore: 45, vo2max: 52 },
    });
    expect(plan.reasoning.some((r) => r.includes("HRV status: UNBALANCED"))).toBe(true);
    expect(plan.reasoning.some((r) => r.includes("Body battery low today: 15 (low)"))).toBe(true);
    expect(plan.reasoning.some((r) => r.includes("Sleep score: 45 (poor)"))).toBe(true);
    expect(plan.reasoning.some((r) => r.includes("VO2max: 52"))).toBe(true);
  });

  it("includes a recent-load summary in the reasoning when history is provided", () => {
    const plan = generateWorkout({
      availableMinutes: 90,
      kneeStatus: 1,
      readiness: readiness("moderate"),
      ftp: 250,
      recentDailyTss: [
        { date: "2026-07-18", tss: 0 },
        { date: "2026-07-19", tss: 65 },
      ],
    });
    expect(plan.reasoning.some((r) => r.startsWith("Recent days"))).toBe(true);
  });
});
