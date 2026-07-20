import { describe, expect, it } from "vitest";
import { computeTSS } from "./tss";

describe("computeTSS", () => {
  it("is 100 for one hour exactly at FTP", () => {
    const watts = Array(3600).fill(200);
    expect(computeTSS({ watts, ftp: 200 })).toBeCloseTo(100, 3);
  });

  it("scales with duration at a fixed intensity", () => {
    const watts = Array(1800).fill(200);
    expect(computeTSS({ watts, ftp: 200 })).toBeCloseTo(50, 3);
  });

  it("grows faster than linearly as intensity rises above FTP", () => {
    const oneHourAtFtp = computeTSS({ watts: Array(3600).fill(200), ftp: 200 })!;
    const oneHourAbove = computeTSS({ watts: Array(3600).fill(240), ftp: 200 })!;
    expect(oneHourAbove).toBeGreaterThan(oneHourAtFtp * 1.2);
  });

  it("returns null for an empty stream", () => {
    expect(computeTSS({ watts: [], ftp: 200 })).toBeNull();
  });
});
