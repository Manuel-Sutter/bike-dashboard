const CTL_TIME_CONSTANT_DAYS = 42;
const ATL_TIME_CONSTANT_DAYS = 7;

export interface DailyTss {
  date: string; // YYYY-MM-DD, one entry per calendar day, 0 for rest days
  tss: number;
}

export interface DailyTrainingLoad extends DailyTss {
  ctl: number;
  atl: number;
  tsb: number; // form entering the day, i.e. before today's tss is applied
}

// Coggan's Performance Management Chart: CTL/ATL are exponentially weighted
// moving averages of daily TSS (42-day and 7-day time constants), TSB is
// yesterday's CTL minus yesterday's ATL — the form you had going into today,
// before today's session could affect it.
export function computeTrainingLoad(
  dailyTss: DailyTss[],
  seed: { ctl: number; atl: number } = { ctl: 0, atl: 0 }
): DailyTrainingLoad[] {
  const result: DailyTrainingLoad[] = [];
  let ctl = seed.ctl;
  let atl = seed.atl;

  for (const { date, tss } of dailyTss) {
    const tsb = ctl - atl;
    ctl = ctl + (tss - ctl) / CTL_TIME_CONSTANT_DAYS;
    atl = atl + (tss - atl) / ATL_TIME_CONSTANT_DAYS;
    result.push({ date, tss, ctl, atl, tsb });
  }

  return result;
}
