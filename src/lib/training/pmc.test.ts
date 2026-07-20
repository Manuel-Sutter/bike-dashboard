import { describe, expect, it } from "vitest";
import { computeTrainingLoad } from "./pmc";

describe("computeTrainingLoad", () => {
  it("computes the first day's ctl/atl straight from the seed and today's tss", () => {
    const [day1] = computeTrainingLoad([{ date: "2026-01-01", tss: 100 }]);
    expect(day1.tsb).toBeCloseTo(0, 5); // seed ctl - seed atl
    expect(day1.ctl).toBeCloseTo(100 / 42, 5);
    expect(day1.atl).toBeCloseTo(100 / 7, 5);
  });

  it("converges ctl and atl toward a sustained daily tss", () => {
    const days = Array.from({ length: 300 }, (_, i) => ({
      date: `day-${i}`,
      tss: 50,
    }));
    const result = computeTrainingLoad(days);
    const last = result[result.length - 1];
    expect(last.ctl).toBeCloseTo(50, 1);
    expect(last.atl).toBeCloseTo(50, 1);
    expect(last.tsb).toBeCloseTo(0, 1);
  });

  it("drops tsb during a hard block after an easy period", () => {
    const easy = Array.from({ length: 60 }, (_, i) => ({
      date: `easy-${i}`,
      tss: 40,
    }));
    const hard = Array.from({ length: 5 }, (_, i) => ({
      date: `hard-${i}`,
      tss: 150,
    }));
    const result = computeTrainingLoad([...easy, ...hard]);
    const beforeHardBlock = result[59].tsb;
    const afterHardBlock = result[result.length - 1].tsb;
    expect(afterHardBlock).toBeLessThan(beforeHardBlock);
  });
});
