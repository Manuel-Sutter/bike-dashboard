import { normalizedPower } from "./power";

export interface ComputeTssInput {
  watts: number[];
  ftp: number;
}

// Coggan TSS: 100 = one hour at FTP. IF (intensity factor) is NP relative to
// FTP; TSS scales that by how long the effort lasted.
export function computeTSS({ watts, ftp }: ComputeTssInput): number | null {
  const np = normalizedPower(watts);
  if (np === null || ftp <= 0) return null;

  const durationSeconds = watts.length;
  const intensityFactor = np / ftp;
  return ((durationSeconds * np * intensityFactor) / (ftp * 3600)) * 100;
}
