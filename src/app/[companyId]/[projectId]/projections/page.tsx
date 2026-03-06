import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Suspense } from "react";
import { computeAccountBalance } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import { computeFinancialKpis, computeScheduleKpis } from "@/lib/kpi/compute";
import {
  buildCashflowForecast,
  summariseForecast,
  forecastCompletionDate,
  parseAssumptions,
} from "@/lib/projections/forecast";
import CashflowChart from "@/components/projections/CashflowChart";
import AssumptionControls from "@/components/projections/AssumptionControls";

export default async function ProjectionsPage({
  params,
  searchParams,
}: {
  params: { companyId: string; projectId: string };
  searchParams: Record<string, string | undefined>;
}) {
  const [project, expenses, tasks, entries, costCodes, accounts] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.expense.findMany({ where: { projectId: params.projectId, archivedAt: null }, orderBy: { date: "asc" } }),
    prisma.task.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true, partner: true } } },
    }),
    prisma.costCode.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.account.findMany({ where: { projectId: params.projectId } }),
  ]);

  // Cash balance
  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type as AccountType,
      partnerId: l.partnerId,
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

  // KPIs
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

  // Parse assumptions from URL
  const assumptions = parseAssumptions(searchParams, fin.burn30d);
  const effectiveBurn = assumptions.burnRateOverride ?? fin.burn30d;

  // Build 90-day forecast (always full 90, then slice by horizon for display)
  const forecast90 = buildCashflowForecast(cashBalance, fin.burn30d, taskInputs, { ...assumptions, horizon: 90 });
  const displayForecast = forecast90.slice(0, assumptions.horizon);
  const summaries = summariseForecast(forecast90);

  // Completion date forecast
  const { forecastEnd, spi, slipDays } = forecastCompletionDate(
    sched.pctComplete,
    sched.planStart,
    sched.planEnd
  );

  const fmtUsd = (n: number) =>
    `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  // Phase breakdown for spend attribution
  const phases = Array.from(new Set(tasks.map((t) => t.phase)));
  const phaseBurn = phases.map((phase) => {
    const phaseTasks = taskInputs.filter((t) => t.phase === phase);
    const totalDur = phaseTasks.reduce((s, t) => s + Math.max(t.durationDays, 1), 0);
    const pct = taskInputs.reduce((s, t) => s + Math.max(t.durationDays, 1), 0);
    const weight = pct > 0 ? totalDur / pct : 0;
    const done = phaseTasks.filter((t) => t.status === "DONE").length;
    const inProg = phaseTasks.filter((t) => t.status === "IN_PROGRESS").length;
    return { phase, weight, taskCount: phaseTasks.length, done, inProg };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">KPIs & Projections</h1>
          <p className="text-sm text-slate-500 mt-0.5">{project?.name} — forward-looking estimates</p>
        </div>
        <a
          href={`/api/${params.companyId}/${params.projectId}/export/projections?burn=${effectiveBurn.toFixed(2)}&contingency=${assumptions.contingencyPct}&injection=${assumptions.cashInjection}&horizon=${assumptions.horizon}`}
          className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
        >
          Export CSV
        </a>
      </div>

      {/* Assumption Controls */}
      <Suspense>
        <AssumptionControls burn30d={fin.burn30d} />
      </Suspense>

      {/* Horizon Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mt-5 mb-6">
        {summaries.map((s) => {
          const isCurrent = s.days === assumptions.horizon;
          return (
            <div
              key={s.days}
              className={`rounded-xl border p-4 ${
                isCurrent ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isCurrent ? "text-blue-700" : "text-slate-500"}`}>
                {s.days}-Day Outlook {isCurrent && "✓"}
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Proj. spend</span>
                  <span className="font-mono font-semibold text-slate-800">{fmtUsd(s.projectedSpend)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Est. cash</span>
                  <span className={`font-mono font-semibold ${s.cashBalance < 0 ? "text-red-600" : "text-green-700"}`}>
                    {s.cashBalance < 0 ? "-" : ""}{fmtUsd(s.cashBalance)}
                  </span>
                </div>
                {s.cashoutDate && (
                  <div className="flex justify-between">
                    <span className="text-red-600 text-xs">Cash out</span>
                    <span className="text-red-600 font-medium text-xs">{s.cashoutDate}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cashflow Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">{assumptions.horizon}-Day Cashflow Forecast</h2>
          <span className="text-xs text-slate-400">Blue = cash balance · Amber = cumulative spend</span>
        </div>
        <CashflowChart forecast={displayForecast} horizon={assumptions.horizon} />

        {/* Assumption explanation */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700">How this is computed</p>
          <p>
            <strong>Base burn:</strong> {assumptions.burnRateOverride !== null ? `${fmtUsd(assumptions.burnRateOverride)}/day (manual override)` : `${fmtUsd(fin.burn30d)}/day (30-day average of actual expenses)`}.
          </p>
          <p>
            <strong>Contingency:</strong> {assumptions.contingencyPct}% added to every day&apos;s projected spend.
          </p>
          {assumptions.cashInjection > 0 && (
            <p><strong>Cash injection:</strong> {fmtUsd(assumptions.cashInjection)} added to starting cash balance.</p>
          )}
          <p>
            <strong>Schedule intensity:</strong> Each day&apos;s spend is scaled by the number of active tasks that day
            relative to the average, clamped between ×0.5 and ×1.5. Busier schedule days are modelled as higher spend.
          </p>
          <p>
            <strong>Starting cash:</strong> {fmtUsd(cashBalance)} from ledger
            {assumptions.cashInjection > 0 ? ` + ${fmtUsd(assumptions.cashInjection)} injection = ${fmtUsd(cashBalance + assumptions.cashInjection)}` : ""}.
          </p>
        </div>
      </div>

      {/* Completion Date Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Completion Date Forecast</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Planned start</span>
              <span className="font-medium">{sched.planStart ? format(sched.planStart, "MMM d, yyyy") : "—"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Planned end</span>
              <span className="font-medium">{sched.planEnd ? format(sched.planEnd, "MMM d, yyyy") : "—"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Current progress</span>
              <span className="font-medium">{sched.pctComplete.toFixed(1)}% (weighted by duration)</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">SPI</span>
              <span className={`font-medium font-mono ${spi === null ? "text-slate-400" : spi < 0.9 ? "text-red-600" : spi > 1.05 ? "text-green-700" : "text-slate-800"}`}>
                {spi !== null ? spi.toFixed(3) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Forecast end</span>
              <span className={`font-semibold ${forecastEnd && sched.planEnd && forecastEnd > sched.planEnd ? "text-red-600" : "text-green-700"}`}>
                {forecastEnd ? format(forecastEnd, "MMM d, yyyy") : "—"}
              </span>
            </div>
            {slipDays > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Projected slip</span>
                <span className="font-semibold text-red-600">{slipDays} days</span>
              </div>
            )}
          </div>
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">How this is computed</p>
            <p>
              <strong>SPI</strong> = actual % complete ÷ planned % complete (where planned % = days elapsed ÷ total planned duration).
            </p>
            <p>
              <strong>Forecast end</strong> = today + remaining planned days ÷ SPI.
              SPI &lt; 1 means work is progressing slower than planned, so forecast end is later.
            </p>
            <p>
              <strong>% complete</strong> is weighted by task duration (longer tasks count more).
            </p>
          </div>
        </div>

        {/* Phase breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Phase Schedule Weight</h2>
          <p className="text-xs text-slate-500 mb-3">
            Schedule intensity is modulated by active tasks per phase. This table shows how the forecast workload distributes.
          </p>
          {phaseBurn.length === 0 ? (
            <p className="text-sm text-slate-400">No tasks imported.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-xs text-slate-500 font-medium">Phase</th>
                  <th className="text-right py-2 text-xs text-slate-500 font-medium">Tasks</th>
                  <th className="text-right py-2 text-xs text-slate-500 font-medium">Done</th>
                  <th className="text-right py-2 text-xs text-slate-500 font-medium">Duration wt.</th>
                </tr>
              </thead>
              <tbody>
                {phaseBurn.map((p) => (
                  <tr key={p.phase} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-800">{p.phase}</td>
                    <td className="py-2 text-right text-slate-500">{p.taskCount}</td>
                    <td className="py-2 text-right text-slate-500">{p.done}</td>
                    <td className="py-2 text-right text-slate-500">{(p.weight * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Key metrics grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">7d Burn</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{fmtUsd(fin.burn7d)}/d</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">30d Burn</p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{fmtUsd(fin.burn30d)}/d</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Cash on Hand</p>
              <p className={`text-lg font-bold font-mono mt-0.5 ${cashBalance < 0 ? "text-red-600" : "text-slate-900"}`}>
                {fmtUsd(cashBalance)}
              </p>
            </div>
            <div className={`rounded-lg p-3 ${fin.runwayDays !== null && fin.runwayDays < 30 ? "bg-red-50" : "bg-slate-50"}`}>
              <p className="text-xs text-slate-500">Runway</p>
              <p className={`text-lg font-bold font-mono mt-0.5 ${fin.runwayDays !== null && fin.runwayDays < 30 ? "text-red-600" : "text-slate-900"}`}>
                {fin.runwayDays !== null ? `${fin.runwayDays}d` : "∞"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget-by-cost-code spend projection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-1">Budget Variance Summary</h2>
        <p className="text-xs text-slate-500 mb-4">
          Current actual spend vs budget. Variance % = (budget − actual) / budget.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Cost Code</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Budget</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Actual</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Variance $</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Variance %</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {fin.budgetVsActual.map((cc) => (
                <tr key={cc.code} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <span className="font-mono text-xs text-slate-500 mr-2">{cc.code}</span>
                    {cc.name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">{fmtUsd(cc.budget)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-800">{fmtUsd(cc.actual)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${cc.variance < 0 ? "text-red-600" : "text-green-700"}`}>
                    {cc.variance < 0 ? "-" : "+"}{fmtUsd(Math.abs(cc.variance))}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${cc.variance < 0 ? "text-red-600" : "text-green-700"}`}>
                    {cc.variancePct > 0 ? "+" : ""}{cc.variancePct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cc.pctUsed >= 100 ? "bg-red-500" : cc.pctUsed >= 80 ? "bg-amber-400" : "bg-blue-500"}`}
                        style={{ width: `${Math.min(cc.pctUsed, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 text-right mt-0.5">{cc.pctUsed.toFixed(0)}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className="px-4 py-2.5 font-semibold text-slate-700">Total</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-700">{fmtUsd(fin.totalBudget)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800">{fmtUsd(fin.totalSpend)}</td>
                <td className={`px-4 py-2.5 text-right font-mono font-bold ${fin.remainingBudget < 0 ? "text-red-600" : "text-green-700"}`}>
                  {fin.remainingBudget < 0 ? "-" : "+"}{fmtUsd(Math.abs(fin.remainingBudget))}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono ${fin.remainingBudget < 0 ? "text-red-600" : "text-green-700"}`}>
                  {fin.totalBudget > 0 ? `${fin.remainingBudget < 0 ? "-" : "+"}${(Math.abs(fin.remainingBudget) / fin.totalBudget * 100).toFixed(1)}%` : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
