import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { computeAccountBalance, computePartnerBalances } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import { computeFinancialKpis, computeScheduleKpis, computeAlerts } from "@/lib/kpi/compute";
import SpendTrendChart from "@/components/kpi/SpendTrendChart";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const [project, expenses, tasks, entries, costCodes] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.expense.findMany({
      where: { projectId: params.projectId, archivedAt: null },
      orderBy: { date: "asc" },
    }),
    prisma.task.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true, partner: true } } },
    }),
    prisma.costCode.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
  ]);

  // Cash balance from ledger
  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type as AccountType,
      partnerId: l.partnerId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }))
  );
  const accounts = await prisma.account.findMany({ where: { projectId: params.projectId } });
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

  const partnerBalances = computePartnerBalances(allLines);
  const totalCapital = Array.from(partnerBalances.values()).reduce((s, v) => s + v, 0);

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
  const alerts = computeAlerts(fin, sched);

  const fmtUsd = (n: number) =>
    `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const fmtUsd2 = (n: number) =>
    `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const burnTrendIcon =
    fin.burnTrend === "up" ? "↑" : fin.burnTrend === "down" ? "↓" : "→";
  const burnTrendColor =
    fin.burnTrend === "up" ? "text-red-600" : fin.burnTrend === "down" ? "text-green-600" : "text-slate-500";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{project?.name} — Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Start: {project?.startDate ? format(project.startDate, "MMM d, yyyy") : "—"} ·
            Budget: ${Number(project?.budget ?? 0).toLocaleString()}
          </p>
        </div>
        <Link
          href={`/${params.companyId}/${params.projectId}/projections`}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Projections →
        </Link>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-5">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 px-4 py-2.5 rounded-lg text-sm ${
                a.level === "critical"
                  ? "bg-red-50 border border-red-200 text-red-800"
                  : "bg-amber-50 border border-amber-200 text-amber-800"
              }`}
            >
              <span className="mt-0.5 shrink-0">{a.level === "critical" ? "🔴" : "⚠️"}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards — Row 1: Financial */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Spend</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmtUsd(fin.totalSpend)}</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${fin.spendPct > 90 ? "bg-red-500" : fin.spendPct > 70 ? "bg-amber-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min(fin.spendPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">{fin.spendPct.toFixed(1)}% of {fmtUsd(fin.totalBudget)} budget</p>
        </div>

        <div className={`bg-white rounded-xl border p-4 ${fin.remainingBudget < 0 ? "border-red-300" : "border-slate-200"}`}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Remaining Budget</p>
          <p className={`text-2xl font-bold mt-1 ${fin.remainingBudget < 0 ? "text-red-600" : "text-green-600"}`}>
            {fin.remainingBudget < 0 ? "-" : ""}{fmtUsd(fin.remainingBudget)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{fin.remainingBudget < 0 ? "over budget" : "left in budget"}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cash on Hand</p>
          <p className={`text-2xl font-bold mt-1 ${cashBalance < 0 ? "text-red-600" : "text-slate-900"}`}>
            {fmtUsd(cashBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">From ledger · {fmtUsd(totalCapital)} partner capital</p>
        </div>

        <div className={`bg-white rounded-xl border p-4 ${
          fin.runwayDays !== null && fin.runwayDays < 14 ? "border-red-300 bg-red-50" :
          fin.runwayDays !== null && fin.runwayDays < 30 ? "border-amber-300 bg-amber-50" : "border-slate-200"
        }`}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cash Runway</p>
          <p className={`text-2xl font-bold mt-1 ${
            fin.runwayDays !== null && fin.runwayDays < 14 ? "text-red-600" :
            fin.runwayDays !== null && fin.runwayDays < 30 ? "text-amber-600" : "text-slate-900"
          }`}>
            {fin.runwayDays !== null ? `${fin.runwayDays}d` : "∞"}
          </p>
          <p className="text-xs text-slate-400 mt-1">at {fmtUsd2(fin.burn7d)}/day (7d burn)</p>
        </div>
      </div>

      {/* KPI Cards — Row 2: Burn + Schedule */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Burn Rate</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {fmtUsd2(fin.burn7d)}
            <span className={`text-base ml-1 ${burnTrendColor}`}>{burnTrendIcon}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">7d · 30d avg: {fmtUsd2(fin.burn30d)}/day</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Schedule</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{sched.pctComplete.toFixed(0)}%</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${sched.pctComplete}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {sched.spi !== null ? `SPI: ${sched.spi.toFixed(2)}` : "weighted complete"}
          </p>
        </div>

        <div className={`bg-white rounded-xl border p-4 ${sched.lateCount > 0 ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Late Tasks</p>
          <p className={`text-2xl font-bold mt-1 ${sched.lateCount > 0 ? "text-red-600" : "text-slate-900"}`}>
            {sched.lateCount}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {sched.lateDays > 0 ? `${sched.lateDays} total late days` : "no overdue tasks"}
          </p>
        </div>

        <div className={`bg-white rounded-xl border p-4 ${fin.dupCount > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Expense Flags</p>
          <p className={`text-2xl font-bold mt-1 ${fin.dupCount > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {fin.dupCount + fin.possibleDupCount}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {fin.dupCount} exact · {fin.possibleDupCount} possible dup
          </p>
        </div>
      </div>

      {/* 30-day spend trend + forecast link */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-800">30-Day Spend Trend</h2>
            <Link
              href={`/${params.companyId}/${params.projectId}/projections`}
              className="text-xs text-blue-600 hover:underline"
            >
              View 90-day forecast →
            </Link>
          </div>
          <SpendTrendChart data={fin.spendTrend} burn7d={fin.burn7d} burn30d={fin.burn30d} />
        </div>

        {/* Schedule + completion forecast */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Schedule Summary</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Planned end</span>
              <span className="font-medium text-slate-800">
                {sched.planEnd ? format(sched.planEnd, "MMM d, yyyy") : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Forecast end</span>
              <span className={`font-medium ${
                sched.forecastEnd && sched.planEnd && sched.forecastEnd > sched.planEnd
                  ? "text-red-600" : "text-green-700"
              }`}>
                {sched.forecastEnd ? format(sched.forecastEnd, "MMM d, yyyy") : "—"}
              </span>
            </div>
            {sched.spi !== null && (
              <div className="flex justify-between">
                <span className="text-slate-500">SPI</span>
                <span className={`font-medium font-mono ${sched.spi < 0.9 ? "text-red-600" : sched.spi > 1.05 ? "text-green-700" : "text-slate-700"}`}>
                  {sched.spi.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Due in 7d</span>
              <span className={`font-medium ${sched.dueSoon7 > 0 ? "text-amber-600" : "text-slate-700"}`}>
                {sched.dueSoon7} tasks
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Due in 14d</span>
              <span className="font-medium text-slate-700">{sched.dueSoon14} tasks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs Actual by Cost Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Budget vs Actual by Cost Code</h2>
          {fin.budgetVsActual.length === 0 ? (
            <p className="text-sm text-slate-400">No cost codes defined.</p>
          ) : (
            <div className="space-y-3">
              {fin.budgetVsActual.map((cc) => (
                <div key={cc.code}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{cc.code} – {cc.name}</span>
                    <span>
                      <span className="text-slate-500">{fmtUsd(cc.actual)} / {fmtUsd(cc.budget)}</span>
                      <span className={`ml-2 font-semibold ${cc.variance < 0 ? "text-red-600" : "text-slate-600"}`}>
                        {cc.variance < 0 ? `-${fmtUsd(Math.abs(cc.variance))} over` : `${fmtUsd(cc.variance)} left`}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cc.pctUsed >= 100 ? "bg-red-500" : cc.pctUsed >= 80 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min(cc.pctUsed, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Vendors */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Top Vendors by Spend</h2>
          {fin.topVendors.length === 0 ? (
            <p className="text-sm text-slate-400">No expense data.</p>
          ) : (
            <div className="space-y-2">
              {fin.topVendors.slice(0, 8).map((v, i) => (
                <div key={v.vendor} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="font-medium text-slate-700 truncate">{v.vendor}</span>
                      <span className="text-slate-500 shrink-0 ml-2">{fmtUsd(v.amount)} ({v.pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${v.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Recent Expenses</h2>
          <Link
            href={`/${params.companyId}/${params.projectId}/expenses/log`}
            className="text-sm text-blue-600 hover:underline"
          >
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[...expenses].reverse().slice(0, 8).map((e) => (
              <tr key={e.id} className={`border-b border-slate-50 hover:bg-slate-50 ${e.isDuplicate ? "bg-red-50" : e.isPossibleDup ? "bg-amber-50" : ""}`}>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">
                  {format(new Date(e.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d")}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {e.vendor}
                  {e.isDuplicate && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">dup</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate text-xs">{e.description}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-800 text-xs">
                  ${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
