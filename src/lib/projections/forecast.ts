import { addDays, differenceInDays, format } from "date-fns";

export type ProjectionAssumptions = {
  burnRateOverride: number | null; // $/day; null = use computed 30d avg
  contingencyPct: number;          // 0–50
  cashInjection: number;           // one-time addition (e.g. pending contribution)
  horizon: 30 | 60 | 90;
};

export type DailyForecast = {
  date: string;        // "YYYY-MM-DD"
  dayLabel: string;    // "MM-DD"
  projectedSpend: number;
  cumulativeSpend: number;
  cashBalance: number;
  activeTaskCount: number;
  intensityRatio: number;
};

export type HorizonSummary = {
  days: number;
  projectedSpend: number;
  cashBalance: number;
  cashoutDate: string | null; // date cash goes negative, or null
};

/**
 * Schedule-phase-weighted cashflow forecast.
 *
 * Base burn ($/day) × intensity ratio × (1 + contingency) for each future day.
 * Intensity ratio = active task count on that day / avg active tasks/day over horizon.
 * Clamped to [0.5, 1.5] so it moderates but doesn't dominate.
 */
export function buildCashflowForecast(
  cashBalance: number,
  burn30d: number,
  tasks: { startDate: Date | null; endDate: Date | null; status: string }[],
  assumptions: ProjectionAssumptions,
  today: Date = new Date()
): DailyForecast[] {
  const baseBurn = assumptions.burnRateOverride ?? burn30d;
  const mult = 1 + assumptions.contingencyPct / 100;

  const remaining = tasks.filter(
    (t) => t.status !== "DONE" && t.startDate && t.endDate
  );

  // Pre-compute average active tasks per day over the horizon
  let totalTaskDays = 0;
  for (const t of remaining) {
    const start = t.startDate!;
    const end = t.endDate!;
    for (let d = 1; d <= assumptions.horizon; d++) {
      const day = addDays(today, d);
      if (day >= start && day <= end) totalTaskDays++;
    }
  }
  const avgPerDay = totalTaskDays / assumptions.horizon || 1;

  const forecast: DailyForecast[] = [];
  let running = cashBalance + assumptions.cashInjection;
  let cumSpend = 0;

  for (let d = 1; d <= assumptions.horizon; d++) {
    const day = addDays(today, d);
    const active = remaining.filter((t) => day >= t.startDate! && day <= t.endDate!).length;
    const intensityRatio = Math.max(0.5, Math.min(1.5, active / avgPerDay));
    const spend = baseBurn * mult * intensityRatio;
    cumSpend += spend;
    running -= spend;

    forecast.push({
      date: format(day, "yyyy-MM-dd"),
      dayLabel: format(day, "MMM d"),
      projectedSpend: spend,
      cumulativeSpend: cumSpend,
      cashBalance: running,
      activeTaskCount: active,
      intensityRatio,
    });
  }

  return forecast;
}

/** Summarise at 30/60/90-day horizons from a full 90-day forecast array */
export function summariseForecast(forecast: DailyForecast[]): HorizonSummary[] {
  const cashoutDay = forecast.find((r) => r.cashBalance < 0);
  return [30, 60, 90].map((h) => {
    const row = forecast[Math.min(h - 1, forecast.length - 1)];
    return {
      days: h,
      projectedSpend: row?.cumulativeSpend ?? 0,
      cashBalance: row?.cashBalance ?? 0,
      cashoutDate: cashoutDay ? cashoutDay.date : null,
    };
  });
}

/**
 * Completion date forecast using Schedule Performance Index (SPI).
 *
 * SPI = actual_pct_complete / planned_pct_complete
 * forecast_end = today + remaining_days / SPI
 *
 * If SPI ≥ 1: ahead or on schedule.
 * If SPI < 1: behind, completion is later than planned.
 * If SPI = null (no elapsed time yet): return planEnd unchanged.
 */
export function forecastCompletionDate(
  pctComplete: number,
  planStart: Date | null,
  planEnd: Date | null,
  today: Date = new Date()
): { forecastEnd: Date | null; spi: number | null; slipDays: number } {
  if (!planStart || !planEnd || planEnd <= planStart) {
    return { forecastEnd: planEnd, spi: null, slipDays: 0 };
  }

  const totalSpan = differenceInDays(planEnd, planStart);
  const elapsed = Math.max(differenceInDays(today, planStart), 0);
  const plannedPct = Math.min((elapsed / totalSpan) * 100, 100);
  const spi = plannedPct > 0 ? pctComplete / plannedPct : null;

  if (spi === null || spi <= 0) return { forecastEnd: null, spi, slipDays: 0 };
  if (pctComplete >= 100) return { forecastEnd: today, spi, slipDays: 0 };

  const remainingDays = differenceInDays(planEnd, today);
  const forecastEnd = addDays(today, Math.max(0, Math.round(remainingDays / spi)));
  const slipDays = Math.max(0, differenceInDays(forecastEnd, planEnd));

  return { forecastEnd, spi, slipDays };
}

/** Parse URL searchParam assumptions with safe defaults */
export function parseAssumptions(
  sp: Record<string, string | undefined>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _computed30d?: number
): ProjectionAssumptions {
  const burn = sp.burn ? parseFloat(sp.burn) : null;
  const contingency = sp.contingency ? parseFloat(sp.contingency) : 10;
  const injection = sp.injection ? parseFloat(sp.injection) : 0;
  const horizon = sp.horizon === "60" ? 60 : sp.horizon === "90" ? 90 : 30;
  return {
    burnRateOverride: burn !== null && !isNaN(burn) ? burn : null,
    contingencyPct: isNaN(contingency) ? 10 : Math.max(0, Math.min(50, contingency)),
    cashInjection: isNaN(injection) ? 0 : Math.max(0, injection),
    horizon: horizon as 30 | 60 | 90,
  };
}
