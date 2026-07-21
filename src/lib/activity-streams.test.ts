import { describe, expect, it } from "vitest";
import { extractPowerSeries } from "./activity-streams";

function makeStreams(rows: { t: number; watts: number }[]) {
  return {
    metricDescriptors: [
      { key: "sumDuration", metricsIndex: 0 },
      { key: "directPower", metricsIndex: 1 },
      { key: "directHeartRate", metricsIndex: 2 },
    ],
    activityDetailMetrics: rows.map((r) => ({ metrics: [r.t, r.watts, 140] })),
  };
}

describe("extractPowerSeries", () => {
  it("forward-fills irregular samples into a dense one-second-per-index series", () => {
    // Real Garmin data samples every ~7s, not every 1s - this mimics that.
    const streams = makeStreams([
      { t: 0, watts: 100 },
      { t: 7, watts: 200 },
      { t: 14, watts: 150 },
    ]);
    const series = extractPowerSeries(streams);
    expect(series).not.toBeNull();
    expect(series!.length).toBe(15); // indices 0..14
    expect(series![0]).toBe(100);
    expect(series![6]).toBe(100); // still holding the t=0 sample right before t=7
    expect(series![7]).toBe(200);
    expect(series![13]).toBe(200); // holding until the t=14 sample
    expect(series![14]).toBe(150);
  });

  it("sorts out-of-order samples before resampling", () => {
    const streams = makeStreams([
      { t: 5, watts: 200 },
      { t: 0, watts: 100 },
    ]);
    const series = extractPowerSeries(streams);
    expect(series![0]).toBe(100);
    expect(series![5]).toBe(200);
  });

  it("returns null when there's no power metric (e.g. a gym session)", () => {
    const streams = {
      metricDescriptors: [{ key: "directHeartRate", metricsIndex: 0 }],
      activityDetailMetrics: [{ metrics: [140] }],
    };
    expect(extractPowerSeries(streams)).toBeNull();
  });

  it("returns null for missing or malformed streams", () => {
    expect(extractPowerSeries(null)).toBeNull();
    expect(extractPowerSeries(undefined)).toBeNull();
    expect(extractPowerSeries({})).toBeNull();
    expect(extractPowerSeries({ metricDescriptors: [], activityDetailMetrics: [] })).toBeNull();
  });
});
