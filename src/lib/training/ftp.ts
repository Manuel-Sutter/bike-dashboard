import { bestAveragePower } from "./power";

const FTP_ESTIMATE_WINDOW_S = 1200; // 20 minutes
const FTP_ESTIMATE_FACTOR = 0.95;

// Best-20-minute-power * 0.95 is the standard field estimate for FTP absent
// a dedicated test — good enough once we have a handful of hard rides to
// pull the best 20-min effort from.
export function estimateFTP(watts: number[]): number | null {
  const best20min = bestAveragePower(watts, FTP_ESTIMATE_WINDOW_S);
  if (best20min === null) return null;
  return best20min * FTP_ESTIMATE_FACTOR;
}
