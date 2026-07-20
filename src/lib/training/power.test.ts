import { describe, expect, it } from "vitest";
import {
  bestAveragePower,
  normalizedPower,
  powerDurationCurve,
  rollingAverage,
} from "./power";

describe("rollingAverage", () => {
  it("returns one value per window position", () => {
    const result = rollingAverage([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([1.5, 2.5, 3.5, 4.5]);
  });

  it("returns an empty array when the stream is shorter than the window", () => {
    expect(rollingAverage([1, 2], 5)).toEqual([]);
  });
});

describe("normalizedPower", () => {
  it("equals the average for constant power", () => {
    const watts = Array(1800).fill(200);
    expect(normalizedPower(watts)).toBeCloseTo(200, 5);
  });

  it("weights variable efforts above the plain average", () => {
    const watts = [
      ...Array(900).fill(100),
      ...Array(900).fill(300),
    ];
    const np = normalizedPower(watts)!;
    const plainAverage = 200;
    expect(np).toBeGreaterThan(plainAverage);
  });

  it("returns null for a stream shorter than the 30s window", () => {
    expect(normalizedPower(Array(10).fill(200))).toBeNull();
  });
});

describe("bestAveragePower", () => {
  it("finds the highest window in a variable stream", () => {
    const watts = [
      ...Array(60).fill(100),
      ...Array(60).fill(300),
      ...Array(60).fill(100),
    ];
    expect(bestAveragePower(watts, 60)).toBeCloseTo(300, 5);
  });
});

describe("powerDurationCurve", () => {
  it("only includes durations the stream is long enough to cover", () => {
    const watts = Array(120).fill(250);
    const curve = powerDurationCurve(watts, [5, 60, 1200]);
    expect(curve.map((p) => p.durationSeconds)).toEqual([5, 60]);
    expect(curve.every((p) => p.watts === 250)).toBe(true);
  });
});
