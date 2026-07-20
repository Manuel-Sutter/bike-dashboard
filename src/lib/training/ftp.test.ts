import { describe, expect, it } from "vitest";
import { estimateFTP } from "./ftp";

describe("estimateFTP", () => {
  it("is 95% of the best 20-minute power", () => {
    const watts = Array(1200).fill(250);
    expect(estimateFTP(watts)).toBeCloseTo(250 * 0.95, 5);
  });

  it("picks the best 20-minute window, not the overall average", () => {
    const watts = [...Array(1200).fill(100), ...Array(1200).fill(300)];
    expect(estimateFTP(watts)).toBeCloseTo(300 * 0.95, 5);
  });

  it("returns null when the ride is shorter than 20 minutes", () => {
    expect(estimateFTP(Array(600).fill(250))).toBeNull();
  });
});
