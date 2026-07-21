import { describe, expect, it } from "vitest";
import { classifyRide } from "./classify";

const FTP = 250;

describe("classifyRide", () => {
  it("gives a dedicated threshold workout both primary and no separate hard effort", () => {
    // Short warmup/cooldown relative to the interval, so whole-ride NP
    // stays dominated by the hard block - a real "this was a threshold
    // workout" session, not a long ride that happened to include one.
    const watts = Array(21 * 60).fill(150);
    for (let i = 30; i < 30 + 20 * 60; i++) watts[i] = 245; // 20min @ 98% FTP
    const result = classifyRide(watts, FTP);
    expect(result.primary).toBe("threshold");
    expect(result.hardEffort).toBeNull();
  });

  it("tags a long easy ride with one hard climb as endurance primary + vo2max hard effort", () => {
    const watts = Array(60 * 60).fill(140); // an hour, mostly easy -> low NP overall
    for (let i = 20 * 60; i < 20 * 60 + 4 * 60; i++) watts[i] = 280; // 4min @ 112% FTP
    const result = classifyRide(watts, FTP);
    expect(result.primary).toBe("endurance");
    expect(result.hardEffort).toBe("vo2max");
  });

  it("tags a dedicated sweet-spot workout as sweet_spot primary with no separate hard effort", () => {
    const watts = Array(25 * 60).fill(150);
    for (let i = 30; i < 30 + 24 * 60; i++) watts[i] = 225; // 24min @ 90% FTP dominates NP
    const result = classifyRide(watts, FTP);
    expect(result.primary).toBe("sweet_spot");
    expect(result.hardEffort).toBeNull();
  });

  it("surfaces the single hardest effort, not every qualifying zone", () => {
    const watts = Array(60 * 60).fill(150);
    for (let i = 5 * 60; i < 17 * 60; i++) watts[i] = 225; // 12min sweet spot
    for (let i = 30 * 60; i < 30 * 60 + 4 * 60; i++) watts[i] = 280; // 4min vo2max
    const result = classifyRide(watts, FTP);
    expect(result.hardEffort).toBe("vo2max");
  });

  it("tags a steady ride with no hard efforts as endurance with no hard effort noted", () => {
    const watts = Array(60 * 60).fill(165); // steady 66% FTP
    const result = classifyRide(watts, FTP);
    expect(result.primary).toBe("endurance");
    expect(result.hardEffort).toBeNull();
  });

  it("tags a genuinely easy ride as recovery", () => {
    const watts = Array(40 * 60).fill(120); // 48% FTP
    const result = classifyRide(watts, FTP);
    expect(result.primary).toBe("recovery");
    expect(result.hardEffort).toBeNull();
  });

  it("doesn't credit a hard effort too short for the harder zones' duration checks", () => {
    const watts = Array(5 * 60).fill(240); // 5min hard, too short for the 20min threshold check
    const result = classifyRide(watts, FTP);
    expect(result.hardEffort).not.toBe("threshold");
  });
});
