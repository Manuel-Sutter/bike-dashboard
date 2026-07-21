// Garmin's activity-details response is a sparse, irregularly-sampled
// "metrics matrix": metricDescriptors maps a metric key (e.g. "directPower")
// to a column index, and activityDetailMetrics is a list of rows sampled at
// whatever interval Garmin's downsampling picked (observed ~7s on longer
// rides, not a clean 1-per-second series). The training engine's power
// functions (power.ts) assume one sample per second, so this resamples via
// forward-fill: carry the last known watts forward until the next sample.
interface MetricDescriptor {
  key: string;
  metricsIndex: number;
}

interface MetricRow {
  metrics: number[];
}

interface ActivityStreams {
  metricDescriptors?: MetricDescriptor[];
  activityDetailMetrics?: MetricRow[];
}

export function extractPowerSeries(streams: unknown): number[] | null {
  if (!streams || typeof streams !== "object") return null;
  const s = streams as ActivityStreams;
  const descriptors = s.metricDescriptors;
  const rows = s.activityDetailMetrics;
  if (!Array.isArray(descriptors) || !Array.isArray(rows)) return null;

  const powerDescriptor = descriptors.find((d) => d.key === "directPower");
  const durationDescriptor = descriptors.find((d) => d.key === "sumDuration");
  if (!powerDescriptor || !durationDescriptor) return null;

  const powerIdx = powerDescriptor.metricsIndex;
  const durationIdx = durationDescriptor.metricsIndex;

  const samples: { t: number; watts: number }[] = [];
  for (const row of rows) {
    const arr = row?.metrics;
    if (!Array.isArray(arr)) continue;
    const t = arr[durationIdx];
    const watts = arr[powerIdx];
    if (typeof t === "number" && typeof watts === "number" && Number.isFinite(t) && Number.isFinite(watts)) {
      samples.push({ t: Math.round(t), watts });
    }
  }
  if (samples.length === 0) return null;

  samples.sort((a, b) => a.t - b.t);
  const maxT = samples.at(-1)!.t;
  if (maxT <= 0) return null;

  const series = new Array<number>(maxT + 1).fill(0);
  let sampleIdx = 0;
  let lastWatts = 0;
  for (let t = 0; t <= maxT; t++) {
    while (sampleIdx < samples.length && samples[sampleIdx].t <= t) {
      lastWatts = samples[sampleIdx].watts;
      sampleIdx++;
    }
    series[t] = lastWatts;
  }
  return series;
}
