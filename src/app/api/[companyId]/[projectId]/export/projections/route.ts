import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAccountBalance } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import { computeFinancialKpis, computeScheduleKpis } from "@/lib/kpi/compute";
import { buildCashflowForecast, parseAssumptions, forecastCompletionDate } from "@/lib/projections/forecast";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; projectId: string } }
) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());

  const [expenses, tasks, entries, costCodes, accounts] = await Promise.all([
    prisma.expense.findMany({ where: { projectId: params.projectId }, orderBy: { date: "asc" } }),
    prisma.task.findMany({ where: { projectId: params.projectId } }),
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true } } },
    }),
    prisma.costCode.findMany({ where: { projectId: params.projectId } }),
    prisma.account.findMany({ where: { projectId: params.projectId } }),
  ]);

  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type as AccountType,
      partnerId: null,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }))
  );
  const accountBalances = new Map<string, number>();
  for (const line of allLines) {
    const acct = accounts.find((a) => a.id === line.accountId);
    if (!acct) continue;
    accountBalances.set(
      line.accountId,
      (accountBalances.get(line.accountId) ?? 0) +
        computeAccountBalance(acct.type, line.debit, line.credit)
    );
  }
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const cashBalance = cashAccount ? (accountBalances.get(cashAccount.id) ?? 0) : 0;

  const expenseInputs = expenses.map((e) => ({
    id: e.id,
    date: e.date,
    vendor: e.vendor,
    amount: Number(e.amount),
    costCodeId: e.costCodeId,
    isDuplicate: e.isDuplicate,
    isPossibleDup: e.isPossibleDup,
  }));
  const ccInputs = costCodes.map((cc) => ({
    id: cc.id,
    code: cc.code,
    name: cc.name,
    budget: Number(cc.budgetAmount),
  }));
  const taskInputs = tasks.map((t) => ({
    id: t.id,
    phase: t.phase,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate,
    durationDays: t.durationDays,
    isMilestone: t.isMilestone,
    status: t.status,
    percentComplete: t.percentComplete,
  }));

  const fin = computeFinancialKpis(expenseInputs, ccInputs, cashBalance);
  const sched = computeScheduleKpis(taskInputs);
  const assumptions = parseAssumptions(sp, fin.burn30d);
  const { forecastEnd, spi, slipDays } = forecastCompletionDate(sched.pctComplete, sched.planStart, sched.planEnd);

  const forecast = buildCashflowForecast(cashBalance, fin.burn30d, taskInputs, { ...assumptions, horizon: 90 });

  const lines: string[] = [];

  // Section 1: KPI Summary
  lines.push("# KPI Summary");
  lines.push("metric,value");
  lines.push(`Total Spend,${fin.totalSpend.toFixed(2)}`);
  lines.push(`Total Budget,${fin.totalBudget.toFixed(2)}`);
  lines.push(`Remaining Budget,${fin.remainingBudget.toFixed(2)}`);
  lines.push(`Budget Used %,${fin.spendPct.toFixed(2)}`);
  lines.push(`Burn Rate 7d ($/day),${fin.burn7d.toFixed(2)}`);
  lines.push(`Burn Rate 30d ($/day),${fin.burn30d.toFixed(2)}`);
  lines.push(`Cash on Hand,${cashBalance.toFixed(2)}`);
  lines.push(`Runway Days,${fin.runwayDays ?? "infinite"}`);
  lines.push(`Duplicate Flags,${fin.dupCount}`);
  lines.push(`Possible Dup Flags,${fin.possibleDupCount}`);
  lines.push(`Schedule % Complete,${sched.pctComplete.toFixed(2)}`);
  lines.push(`Late Task Count,${sched.lateCount}`);
  lines.push(`SPI,${spi?.toFixed(3) ?? "N/A"}`);
  lines.push(`Planned End,${sched.planEnd ? sched.planEnd.toISOString().split("T")[0] : "N/A"}`);
  lines.push(`Forecast End,${forecastEnd ? forecastEnd.toISOString().split("T")[0] : "N/A"}`);
  lines.push(`Slip Days,${slipDays}`);
  lines.push("");

  // Section 2: Budget vs Actual
  lines.push("# Budget vs Actual by Cost Code");
  lines.push("code,name,budget,actual,variance,variance_pct");
  for (const cc of fin.budgetVsActual) {
    lines.push(`${cc.code},${cc.name},${cc.budget.toFixed(2)},${cc.actual.toFixed(2)},${cc.variance.toFixed(2)},${cc.variancePct.toFixed(2)}`);
  }
  lines.push("");

  // Section 3: Assumptions
  lines.push("# Projection Assumptions");
  lines.push(`burn_rate_override,${assumptions.burnRateOverride ?? "computed"}`);
  lines.push(`contingency_pct,${assumptions.contingencyPct}`);
  lines.push(`cash_injection,${assumptions.cashInjection}`);
  lines.push(`horizon_days,${assumptions.horizon}`);
  lines.push("");

  // Section 4: Daily forecast
  lines.push(`# ${assumptions.horizon}-Day Cashflow Forecast`);
  lines.push("date,projected_spend,cumulative_spend,cash_balance,active_tasks,intensity_ratio");
  for (const row of forecast.slice(0, assumptions.horizon)) {
    lines.push(
      `${row.date},${row.projectedSpend.toFixed(2)},${row.cumulativeSpend.toFixed(2)},${row.cashBalance.toFixed(2)},${row.activeTaskCount},${row.intensityRatio.toFixed(3)}`
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="projections-${assumptions.horizon}d.csv"`,
    },
  });
}
