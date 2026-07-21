import { BedDouble, Bike, Flame, Gauge, type LucideIcon, Wind, Zap } from "lucide-react";
import type { WorkoutType } from "@/lib/training";

export const WORKOUT_TYPE_STYLE: Record<WorkoutType, { icon: LucideIcon; accent: string; label: string }> = {
  rest: { icon: BedDouble, accent: "#64748b", label: "Rest" },
  recovery: { icon: Wind, accent: "#4fd1c5", label: "Recovery" },
  endurance: { icon: Bike, accent: "#7c9eff", label: "Endurance" },
  sweet_spot: { icon: Gauge, accent: "#f59e0b", label: "Sweet spot" },
  threshold: { icon: Flame, accent: "#f97316", label: "Threshold" },
  vo2max: { icon: Zap, accent: "#ef4444", label: "VO2max" },
};
