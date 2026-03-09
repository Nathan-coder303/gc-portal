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
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

const CARD = { background: "#1e2736", border: "1px solid #30373f" } as const;

export default async function ProjectionsPage({
  params,
  searchParams,
}: {
  params: { companyId: string; projectId: string };
  searchParams: Record<string, string | undefined>;
}) {
  const session = await auth();
  const canSave = can(session?.user.role ?? "PARTNER", "settings:edit");

  const [project, expenses, tasks, entries, costCodes, accounts, savedSettings] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.expense.findMany({ where: { projectId: params.projectId, archivedAt: null }, orderBy: { date: "asc" } }),
    prisma.task.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true, partner: true } } },
    }),
    prisma.costCode.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.account.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.projectSettings.findMany({
      where: {
        projectId: params.projectId,
        key: { in: ["projection.burnOverride", "projection.contingencyPct", "projection.cashInjection", "projection.horizon"] },
      },
    }),
  ]);

  const settingsMap = Object.fromEntries(savedSettings.map((s) => [s.key, s.value]));
  const savedAssumptions = {
    burn: settingsMap["projection.burnOverride"] ?? "",
    contingency: settingsMap["projection.contingencyPct"] ?? "10",
    injection: settingsMap["projection.cashInjection"] ?? "0",
    horizon: settingsMap["projection.horizon"] ?? "30",
  };

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
    accountBalances.set(line.accountId, (accountBalances.get(line.accountId) ?? 0) + computeAccountBalance(acct.type, line.debit, line.credit));
  }
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const cashBalance = cashAccount ? (accountBalances.get(cashAccount.id) ?? 0) : 0;

  const expenseInputs = expenses.map((e) => ({ id: e.id, date: e.date, vendor: e.vendor, amount: Number(e.amount), costCodeId: e.costCodeId, isDuplicate: e.isDuplicate, isPossibleDup: e.isPossibleDup }));
  const ccInputs = costCodes.map((cc) => ({ id: cc.id, code: cc.code, name: cc.name, budget: Number(cc.budgetAmount) }));
  const taskInputs = tasks.map((t) => ({ id: t.id, phase: t.phase, name: t.name, startDate: t.startDate, endDate: t.endDate, durationDays: t.durationDays, isMilestone: t.isMilestone, status: t.status, percentComplete: t.percentComplete }));

  const fin = computeFinancialKpis(expenseInputs, ccInputs, cashBalance);
  const sched = computeScheduleKpis(taskInputs);

  const assumptions = parseAssumptions(searchParams, fin.burn30d);
  const effectiveBurn = assumptions.burnRateOverride ?? fin.burn30d;

  const forecast90 = buildCashflowForecast(cashBalance, fin.burn30d, taskInputs, { ...assumptions, horizon: 90 });
  const displayForecast = forecast90.slice(0, assumptions.horizon);
  const summaries = summariseForecast(forecast90);

  const { forecastEnd, spi, slipDays } = forecastCompletionDate(sched.pctComplete, sched.planStart, sched.planEnd);

  const fmtUsd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>KPIs & Projections</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>{project?.name} — forward-looking estimates</p>
        </div>
        <a
          href={`/api/${params.companyId}/${params.projectId}/export/projections?burn=${effectiveBurn.toFixed(2)}&contingency=${assumptions.contingencyPct}&injection=${assumptions.cashInjection}&horizon=${assumptions.horizon}`}
          className="px-3 py-1.5 text-sm rounded-lg transition-colors"
          style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
        >
          Export CSV
        </a>
      </div>

      <Suspense>
        <AssumptionControls
          burn30d={fin.burn30d}
          projectId={params.projectId}
          saved={savedAssumptions}
          canSave={canSave}
        />
      </Suspense>

      {/* Horizon Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mt-5 mb-6">
        {summaries.map((s) => {
          const isCurrent = s.days === assumptions.horizon;
          return (
            <div
              key={s.days}
              className="rounded-xl p-4"
              style={isCurrent ? { background: "#1a2a1a", border: "1px solid #C9A84C55" } : CARD}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: isCurrent ? "#C9A84C" : "#8b949e" }}>
                {s.days}-Day Outlook {isCurrent && "✓"}
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: "#8b949e" }}>Proj. spend</span>
                  <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{fmtUsd(s.projectedSpend)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "#8b949e" }}>Est. cash</span>
                  <span className="font-mono font-semibold" style={{ color: s.cashBalance < 0 ? "#f87171" : "#4ade80" }}>
                    {s.cashBalance < 0 ? "-" : ""}{fmtUsd(s.cashBalance)}
                  </span>
                </div>
                {s.cashoutDate && (
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: "#f87171" }}>Cash out</span>
                    <span className="font-medium text-xs" style={{ color: "#f87171" }}>{s.cashoutDate}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cashflow Chart */}
      <div className="rounded-xl p-5 mb-6" style={CARD}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: "#e6edf3" }}>{assumptions.horizon}-Day Cashflow Forecast</h2>
          <span className="text-xs" style={{ color: "#8b949e" }}>Gold = cash balance · Amber = cumulative spend</span>
        </div>
        <CashflowChart forecast={displayForecast} horizon={assumptions.horizon} />

        <div className="mt-4 p-3 rounded-lg text-xs space-y-1" style={{ background: "#161b22" }}>
          <p className="font-semibold" style={{ color: "#e6edf3" }}>How this is computed</p>
          <p style={{ color: "#8b949e" }}>
            <strong style={{ color: "#e6edf3" }}>Base burn:</strong>{" "}
            {assumptions.burnRateOverride !== null ? `${fmtUsd(assumptions.burnRateOverride)}/day (manual override)` : `${fmtUsd(fin.burn30d)}/day (30-day average of actual expenses)`}.
          </p>
          <p style={{ color: "#8b949e" }}>
            <strong style={{ color: "#e6edf3" }}>Contingency:</strong> {assumptions.contingencyPct}% added to every day&apos;s projected spend.
          </p>
          {assumptions.cashInjection > 0 && (
            <p style={{ color: "#8b949e" }}><strong style={{ color: "#e6edf3" }}>Cash injection:</strong> {fmtUsd(assumptions.cashInjection)} added to starting cash balance.</p>
          )}
          <p style={{ color: "#8b949e" }}>
            <strong style={{ color: "#e6edf3" }}>Schedule intensity:</strong> Each day&apos;s spend is scaled by the number of active tasks that day relative to the average, clamped between ×0.5 and ×1.5.
          </p>
          <p style={{ color: "#8b949e" }}>
            <strong style={{ color: "#e6edf3" }}>Starting cash:</strong> {fmtUsd(cashBalance)} from ledger
            {assumptions.cashInjection > 0 ? ` + ${fmtUsd(assumptions.cashInjection)} injection = ${fmtUsd(cashBalance + assumptions.cashInjection)}` : ""}.
          </p>
        </div>
      </div>

      {/* Completion Date Forecast + Phase Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="rounded-xl p-5" style={CARD}>
          <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>Completion Date Forecast</h2>
          <div className="space-y-3 text-sm">
            {[
              { label: "Planned start", value: sched.planStart ? format(sched.planStart, "MMM d, yyyy") : "—", color: "#e6edf3" },
              { label: "Planned end", value: sched.planEnd ? format(sched.planEnd, "MMM d, yyyy") : "—", color: "#e6edf3" },
              { label: "Current progress", value: `${sched.pctComplete.toFixed(1)}% (weighted by duration)`, color: "#e6edf3" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between pb-2" style={{ borderBottom: "1px solid #30373f" }}>
                <span style={{ color: "#8b949e" }}>{label}</span>
                <span className="font-medium" style={{ color }}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between pb-2" style={{ borderBottom: "1px solid #30373f" }}>
              <span style={{ color: "#8b949e" }}>SPI</span>
              <span className="font-medium font-mono" style={{
                color: spi === null ? "#8b949e" : spi < 0.9 ? "#f87171" : spi > 1.05 ? "#4ade80" : "#e6edf3"
              }}>
                {spi !== null ? spi.toFixed(3) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between pb-2" style={{ borderBottom: "1px solid #30373f" }}>
              <span style={{ color: "#8b949e" }}>Forecast end</span>
              <span className="font-semibold" style={{
                color: forecastEnd && sched.planEnd && forecastEnd > sched.planEnd ? "#f87171" : "#4ade80"
              }}>
                {forecastEnd ? format(forecastEnd, "MMM d, yyyy") : "—"}
              </span>
            </div>
            {slipDays > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "#8b949e" }}>Projected slip</span>
                <span className="font-semibold" style={{ color: "#f87171" }}>{slipDays} days</span>
              </div>
            )}
          </div>
          <div className="mt-4 p-3 rounded-lg text-xs space-y-1" style={{ background: "#161b22" }}>
            <p className="font-semibold" style={{ color: "#e6edf3" }}>How this is computed</p>
            <p style={{ color: "#8b949e" }}><strong style={{ color: "#e6edf3" }}>SPI</strong> = actual % complete ÷ planned % complete.</p>
            <p style={{ color: "#8b949e" }}><strong style={{ color: "#e6edf3" }}>Forecast end</strong> = today + remaining planned days ÷ SPI.</p>
            <p style={{ color: "#8b949e" }}><strong style={{ color: "#e6edf3" }}>% complete</strong> is weighted by task duration.</p>
          </div>
        </div>

        <div className="rounded-xl p-5" style={CARD}>
          <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>Phase Schedule Weight</h2>
          <p className="text-xs mb-3" style={{ color: "#8b949e" }}>
            Schedule intensity is modulated by active tasks per phase.
          </p>
          {phaseBurn.length === 0 ? (
            <p className="text-sm" style={{ color: "#8b949e" }}>No tasks imported.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #30373f" }}>
                  <th className="text-left py-2 text-xs font-medium" style={{ color: "#8b949e" }}>Phase</th>
                  <th className="text-right py-2 text-xs font-medium" style={{ color: "#8b949e" }}>Tasks</th>
                  <th className="text-right py-2 text-xs font-medium" style={{ color: "#8b949e" }}>Done</th>
                  <th className="text-right py-2 text-xs font-medium" style={{ color: "#8b949e" }}>Duration wt.</th>
                </tr>
              </thead>
              <tbody>
                {phaseBurn.map((p) => (
                  <tr key={p.phase} style={{ borderBottom: "1px solid #30373f" }}>
                    <td className="py-2 font-medium" style={{ color: "#e6edf3" }}>{p.phase}</td>
                    <td className="py-2 text-right" style={{ color: "#8b949e" }}>{p.taskCount}</td>
                    <td className="py-2 text-right" style={{ color: "#8b949e" }}>{p.done}</td>
                    <td className="py-2 text-right" style={{ color: "#8b949e" }}>{(p.weight * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "7d Burn", value: `${fmtUsd(fin.burn7d)}/d`, color: "#e6edf3" },
              { label: "30d Burn", value: `${fmtUsd(fin.burn30d)}/d`, color: "#e6edf3" },
              { label: "Cash on Hand", value: fmtUsd(cashBalance), color: cashBalance < 0 ? "#f87171" : "#e6edf3" },
              {
                label: "Runway",
                value: fin.runwayDays !== null ? `${fin.runwayDays}d` : "∞",
                color: fin.runwayDays !== null && fin.runwayDays < 30 ? "#f87171" : "#e6edf3",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-3" style={{ background: "#161b22" }}>
                <p className="text-xs" style={{ color: "#8b949e" }}>{label}</p>
                <p className="text-lg font-bold font-mono mt-0.5" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget Variance Summary */}
      <div className="rounded-xl p-5" style={CARD}>
        <h2 className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Budget Variance Summary</h2>
        <p className="text-xs mb-4" style={{ color: "#8b949e" }}>
          Current actual spend vs budget. Variance % = (budget − actual) / budget.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Cost Code</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Budget</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Actual</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Variance $</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Variance %</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {fin.budgetVsActual.map((cc) => (
                <tr key={cc.code} style={{ borderBottom: "1px solid #30373f" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "#e6edf3" }}>
                    <span className="font-mono text-xs mr-2" style={{ color: "#8b949e" }}>{cc.code}</span>
                    {cc.name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#8b949e" }}>{fmtUsd(cc.budget)}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: "#e6edf3" }}>{fmtUsd(cc.actual)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold"
                    style={{ color: cc.variance < 0 ? "#f87171" : "#4ade80" }}>
                    {cc.variance < 0 ? "-" : "+"}{fmtUsd(Math.abs(cc.variance))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono"
                    style={{ color: cc.variance < 0 ? "#f87171" : "#4ade80" }}>
                    {cc.variancePct > 0 ? "+" : ""}{cc.variancePct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#30373f" }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min(cc.pctUsed, 100)}%`, background: cc.pctUsed >= 100 ? "#f87171" : cc.pctUsed >= 80 ? "#fbbf24" : "#C9A84C" }} />
                    </div>
                    <div className="text-xs text-right mt-0.5" style={{ color: "#8b949e" }}>{cc.pctUsed.toFixed(0)}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ borderTop: "2px solid #30373f", background: "#161b22" }}>
              <tr>
                <td className="px-4 py-2.5 font-semibold" style={{ color: "#e6edf3" }}>Total</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "#8b949e" }}>{fmtUsd(fin.totalBudget)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: "#e6edf3" }}>{fmtUsd(fin.totalSpend)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold"
                  style={{ color: fin.remainingBudget < 0 ? "#f87171" : "#4ade80" }}>
                  {fin.remainingBudget < 0 ? "-" : "+"}{fmtUsd(Math.abs(fin.remainingBudget))}
                </td>
                <td className="px-4 py-2.5 text-right font-mono"
                  style={{ color: fin.remainingBudget < 0 ? "#f87171" : "#4ade80" }}>
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
