import { describe, expect, it } from "vitest";
import { computeReadiness } from "./readiness";

describe("computeReadiness", () => {
  it("recommends rest when both signals agree the rider is fatigued", () => {
    const result = computeReadiness({ tsb: -35, garminReadinessScore: 30 });
    expect(result.recommendation).toBe("rest");
  });

  it("recommends rest when tsb is fatigued and Garmin recovery time is still running", () => {
    const result = computeReadiness({
      tsb: -35,
      garminReadinessScore: 60,
      recoveryTimeMinutes: 120,
    });
    expect(result.recommendation).toBe("rest");
  });

  it("only downgrades to easy when just one signal is low", () => {
    const result = computeReadiness({ tsb: -35, garminReadinessScore: 80 });
    expect(result.recommendation).toBe("easy");
  });

  it("recommends hard_ok when fresh and Garmin doesn't disagree", () => {
    const result = computeReadiness({ tsb: 15, garminReadinessScore: 85 });
    expect(result.recommendation).toBe("hard_ok");
  });

  it("caps a fresh tsb at moderate when Garmin readiness is only moderate", () => {
    const result = computeReadiness({ tsb: 15, garminReadinessScore: 55 });
    expect(result.recommendation).toBe("moderate");
  });

  it("falls back to tsb alone when no Garmin watch data is available", () => {
    const fresh = computeReadiness({ tsb: 15 });
    expect(fresh.recommendation).toBe("hard_ok");
    expect(fresh.signals.garminReadinessCategory).toBe("unknown");

    const fatigued = computeReadiness({ tsb: -35 });
    expect(fatigued.recommendation).toBe("easy");
  });

  it("defaults to moderate when nothing is known", () => {
    const result = computeReadiness({ tsb: null });
    expect(result.recommendation).toBe("moderate");
  });
});
