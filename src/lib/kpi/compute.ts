import { subDays, addDays, differenceInDays } from "date-fns";

export type ExpenseInput = {
  id: string;
  date: Date;
  vendor: string;
  amount: number;
  costCodeId: string | null;
  isDuplicate: boolean;
  isPossibleDup: boolean;
};

export type CostCodeInput = {
  id: string;
  code: string;
  name: string;
  budget: number;
};

export type TaskInput = {
  id: string;
  phase: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number;
  isMilestone: boolean;
  status: string;
  percentComplete: number;
};

// ─── Financial KPIs ──────────────────────────────────────────────────────────

export function computeFinancialKpis(
  expenses: ExpenseInput[],
  costCodes: CostCodeInput[],
  cashBalance: number,
  today: Date = new Date()
) {
  const d7ago = subDays(today, 7);
  const d30ago = subDays(today, 30);

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const totalBudget = costCodes.reduce((s, cc) => s + cc.budget, 0);

  const spend7 = expenses.filter((e) => e.date >= d7ago).reduce((s, e) => s + e.amount, 0);
  const spend30 = expenses.filter((e) => e.date >= d30ago).reduce((s, e) => s + e.amount, 0);
  const burn7d = spend7 / 7;
  const burn30d = spend30 / 30;
  const burnTrend: "up" | "down" | "flat" =
    burn7d > burn30d * 1.1 ? "up" : burn7d < burn30d * 0.9 ? "down" : "flat";

  const runwayDays = burn7d > 0 ? Math.floor(cashBalance / burn7d) : null;

  const budgetVsActual = costCodes.map((cc) => {
    const actual = expenses
      .filter((e) => e.costCodeId === cc.id)
      .reduce((s, e) => s + e.amount, 0);
    const variance = cc.budget - actual;
    const variancePct = cc.budget > 0 ? (variance / cc.budget) * 100 : 0;
    const pctUsed = cc.budget > 0 ? (actual / cc.budget) * 100 : 0;
    return { ...cc, actual, variance, variancePct, pctUsed };
  });

  const vendorMap = new Map<string, number>();
  for (const e of expenses) {
    vendorMap.set(e.vendor, (vendorMap.get(e.vendor) ?? 0) + e.amount);
  }
  const topVendors = Array.from(vendorMap.entries())
    .map(([vendor, amount]) => ({ vendor, amount, pct: totalSpend > 0 ? (amount / totalSpend) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const dupCount = expenses.filter((e) => e.isDuplicate).length;
  const possibleDupCount = expenses.filter((e) => e.isPossibleDup && !e.isDuplicate).length;

  // 30-day daily spend array for sparkline
  const dailyMap = new Map<string, number>();
  for (const e of expenses) {
    if (e.date >= d30ago) {
      const key = e.date.toISOString().split("T")[0];
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + e.amount);
    }
  }
  const spendTrend = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(today, 29 - i);
    const key = d.toISOString().split("T")[0];
    return { date: key.slice(5), amount: dailyMap.get(key) ?? 0 };
  });

  return {
    totalSpend,
    totalBudget,
    remainingBudget: totalBudget - totalSpend,
    spendPct: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
    burn7d,
    burn30d,
    burnTrend,
    cashBalance,
    runwayDays,
    budgetVsActual,
    topVendors,
    dupCount,
    possibleDupCount,
    spendTrend,
  };
}

// ─── Schedule KPIs ────────────────────────────────────────────────────────────

export function computeScheduleKpis(tasks: TaskInput[], today: Date = new Date()) {
  const totalDuration = tasks.reduce((s, t) => s + Math.max(t.durationDays, 1), 0);
  const weightedDone = tasks.reduce((s, t) => {
    return s + (Math.max(t.durationDays, 1) * t.percentComplete) / 100;
  }, 0);
  const pctComplete = totalDuration > 0 ? (weightedDone / totalDuration) * 100 : 0;

  const notDone = tasks.filter((t) => t.status !== "DONE");
  const late = notDone.filter((t) => t.endDate && t.endDate < today);
  const lateDays = late.reduce((s, t) => s + differenceInDays(today, t.endDate!), 0);

  const in7 = addDays(today, 7);
  const in14 = addDays(today, 14);
  const dueSoon7 = notDone.filter((t) => t.endDate && t.endDate >= today && t.endDate <= in7).length;
  const dueSoon14 = notDone.filter(
    (t) => t.endDate && t.endDate > in7 && t.endDate <= in14
  ).length;

  const planEnd = tasks.reduce<Date | null>(
    (max, t) => (!t.endDate ? max : max === null || t.endDate > max ? t.endDate : max),
    null
  );
  const planStart = tasks.reduce<Date | null>(
    (min, t) => (!t.startDate ? min : min === null || t.startDate < min ? t.startDate : min),
    null
  );

  // SPI (Schedule Performance Index)
  let spi: number | null = null;
  let forecastEnd: Date | null = null;
  if (planStart && planEnd && planEnd > planStart) {
    const totalSpan = differenceInDays(planEnd, planStart);
    const elapsed = Math.max(differenceInDays(today, planStart), 0);
    const plannedPct = Math.min((elapsed / totalSpan) * 100, 100);
    spi = plannedPct > 0 ? pctComplete / plannedPct : null;

    if (spi !== null && spi > 0) {
      if (pctComplete >= 100) {
        forecastEnd = today;
      } else {
        const remainingDays = differenceInDays(planEnd, today);
        forecastEnd = addDays(today, Math.max(0, Math.round(remainingDays / spi)));
      }
    }
  }

  return {
    pctComplete,
    lateCount: late.length,
    lateDays,
    dueSoon7,
    dueSoon14,
    planEnd,
    planStart,
    forecastEnd,
    spi,
  };
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type Alert = {
  level: "critical" | "warning" | "info";
  message: string;
};

export function computeAlerts(
  fin: ReturnType<typeof computeFinancialKpis>,
  sched: ReturnType<typeof computeScheduleKpis>
): Alert[] {
  const alerts: Alert[] = [];

  if (fin.runwayDays !== null && fin.runwayDays < 14) {
    alerts.push({ level: "critical", message: `Cash runway is only ${fin.runwayDays} days at current burn rate.` });
  } else if (fin.runwayDays !== null && fin.runwayDays < 30) {
    alerts.push({ level: "warning", message: `Cash runway is ${fin.runwayDays} days. Consider topping up cash.` });
  }

  const overBudget = fin.budgetVsActual.filter((cc) => cc.variance < 0);
  if (overBudget.length > 0) {
    const names = overBudget.map((cc) => cc.code).join(", ");
    alerts.push({ level: "critical", message: `Over budget on: ${names}.` });
  }

  const nearBudget = fin.budgetVsActual.filter((cc) => cc.pctUsed >= 80 && cc.pctUsed < 100);
  if (nearBudget.length > 0) {
    const names = nearBudget.map((cc) => `${cc.code} (${cc.pctUsed.toFixed(0)}%)`).join(", ");
    alerts.push({ level: "warning", message: `Approaching budget limit: ${names}.` });
  }

  if (sched.lateCount > 0) {
    alerts.push({
      level: "critical",
      message: `${sched.lateCount} task${sched.lateCount > 1 ? "s" : ""} overdue (${sched.lateDays} total late days).`,
    });
  }

  if (fin.burnTrend === "up" && fin.burn7d > fin.burn30d * 1.3) {
    alerts.push({ level: "warning", message: `Burn rate is accelerating: $${fin.burn7d.toFixed(0)}/day vs $${fin.burn30d.toFixed(0)}/day 30d avg.` });
  }

  if (fin.dupCount > 0) {
    alerts.push({ level: "warning", message: `${fin.dupCount} exact duplicate expense${fin.dupCount > 1 ? "s" : ""} flagged.` });
  }

  if (sched.spi !== null && sched.spi < 0.8) {
    alerts.push({ level: "warning", message: `Schedule is running behind plan (SPI: ${sched.spi.toFixed(2)}).` });
  }

  return alerts;
}
