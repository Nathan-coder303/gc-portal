import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { computeAccountBalance, computePartnerBalances } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import { computeFinancialKpis, computeScheduleKpis, computeAlerts } from "@/lib/kpi/compute";
import SpendTrendChart from "@/components/kpi/SpendTrendChart";
import Link from "next/link";

const CARD = { background: "#1e2736", border: "1px solid #30373f" } as const;
const CARD_RED = { background: "#2d1b1b", border: "1px solid #6b2a2a" } as const;
const CARD_AMBER = { background: "#2d2410", border: "1px solid #6b4f10" } as const;

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

  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type as AccountType,
      partnerId: l.partnerId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }))
  );
  const accounts = await prisma.account.findMany({ where: { projectId: params.projectId, archivedAt: null } });
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
    fin.burnTrend === "up" ? "#f87171" : fin.burnTrend === "down" ? "#4ade80" : "#8b949e";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>{project?.name} — Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
            Start: {project?.startDate ? format(project.startDate, "MMM d, yyyy") : "—"} ·
            Budget: ${Number(project?.budget ?? 0).toLocaleString()}
          </p>
        </div>
        <Link
          href={`/${params.companyId}/${params.projectId}/projections`}
          className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
          style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}
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
              className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg text-sm"
              style={
                a.level === "critical"
                  ? { background: "#2d1b1b", border: "1px solid #6b2a2a", color: "#fca5a5" }
                  : { background: "#2d2410", border: "1px solid #6b4f10", color: "#fcd34d" }
              }
            >
              <span className="mt-0.5 shrink-0">{a.level === "critical" ? "🔴" : "⚠️"}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards — Row 1: Financial */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="rounded-xl p-4" style={CARD}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Total Spend</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#e6edf3" }}>{fmtUsd(fin.totalSpend)}</p>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#30373f" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(fin.spendPct, 100)}%`,
                background: fin.spendPct > 90 ? "#f87171" : fin.spendPct > 70 ? "#fbbf24" : "#C9A84C",
              }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>{fin.spendPct.toFixed(1)}% of {fmtUsd(fin.totalBudget)} budget</p>
        </div>

        <div className="rounded-xl p-4" style={fin.remainingBudget < 0 ? CARD_RED : CARD}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Remaining Budget</p>
          <p className="text-2xl font-bold mt-1" style={{ color: fin.remainingBudget < 0 ? "#f87171" : "#4ade80" }}>
            {fin.remainingBudget < 0 ? "-" : ""}{fmtUsd(fin.remainingBudget)}
          </p>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>{fin.remainingBudget < 0 ? "over budget" : "left in budget"}</p>
        </div>

        <div className="rounded-xl p-4" style={CARD}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Cash on Hand</p>
          <p className="text-2xl font-bold mt-1" style={{ color: cashBalance < 0 ? "#f87171" : "#e6edf3" }}>
            {fmtUsd(cashBalance)}
          </p>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>From ledger · {fmtUsd(totalCapital)} partner capital</p>
        </div>

        <div
          className="rounded-xl p-4"
          style={
            fin.runwayDays !== null && fin.runwayDays < 14 ? CARD_RED :
            fin.runwayDays !== null && fin.runwayDays < 30 ? CARD_AMBER : CARD
          }
        >
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Cash Runway</p>
          <p
            className="text-2xl font-bold mt-1"
            style={{
              color:
                fin.runwayDays !== null && fin.runwayDays < 14 ? "#f87171" :
                fin.runwayDays !== null && fin.runwayDays < 30 ? "#fbbf24" : "#e6edf3",
            }}
          >
            {fin.runwayDays !== null ? `${fin.runwayDays}d` : "∞"}
          </p>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>at {fmtUsd2(fin.burn7d)}/day (7d burn)</p>
        </div>
      </div>

      {/* KPI Cards — Row 2: Burn + Schedule */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl p-4" style={CARD}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Burn Rate</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#e6edf3" }}>
            {fmtUsd2(fin.burn7d)}
            <span className="text-base ml-1" style={{ color: burnTrendColor }}>{burnTrendIcon}</span>
          </p>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>7d · 30d avg: {fmtUsd2(fin.burn30d)}/day</p>
        </div>

        <div className="rounded-xl p-4" style={CARD}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Schedule</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#e6edf3" }}>{sched.pctComplete.toFixed(0)}%</p>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#30373f" }}>
            <div className="h-full rounded-full" style={{ width: `${sched.pctComplete}%`, background: "#4ade80" }} />
          </div>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
            {sched.spi !== null ? `SPI: ${sched.spi.toFixed(2)}` : "weighted complete"}
          </p>
        </div>

        <div className="rounded-xl p-4" style={sched.lateCount > 0 ? CARD_RED : CARD}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Late Tasks</p>
          <p className="text-2xl font-bold mt-1" style={{ color: sched.lateCount > 0 ? "#f87171" : "#e6edf3" }}>
            {sched.lateCount}
          </p>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
            {sched.lateDays > 0 ? `${sched.lateDays} total late days` : "no overdue tasks"}
          </p>
        </div>

        <div className="rounded-xl p-4" style={fin.dupCount > 0 ? CARD_AMBER : CARD}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b949e" }}>Expense Flags</p>
          <p className="text-2xl font-bold mt-1" style={{ color: fin.dupCount > 0 ? "#fbbf24" : "#e6edf3" }}>
            {fin.dupCount + fin.possibleDupCount}
          </p>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
            {fin.dupCount} exact · {fin.possibleDupCount} possible dup
          </p>
        </div>
      </div>

      {/* 30-day spend trend + schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 rounded-xl p-5" style={CARD}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold" style={{ color: "#e6edf3" }}>30-Day Spend Trend</h2>
            <Link
              href={`/${params.companyId}/${params.projectId}/projections`}
              className="text-xs transition-colors"
              style={{ color: "#C9A84C" }}
            >
              View 90-day forecast →
            </Link>
          </div>
          <SpendTrendChart data={fin.spendTrend} burn7d={fin.burn7d} burn30d={fin.burn30d} />
        </div>

        <div className="rounded-xl p-5" style={CARD}>
          <h2 className="font-semibold mb-3" style={{ color: "#e6edf3" }}>Schedule Summary</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "#8b949e" }}>Planned end</span>
              <span className="font-medium" style={{ color: "#e6edf3" }}>
                {sched.planEnd ? format(sched.planEnd, "MMM d, yyyy") : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "#8b949e" }}>Forecast end</span>
              <span
                className="font-medium"
                style={{
                  color:
                    sched.forecastEnd && sched.planEnd && sched.forecastEnd > sched.planEnd
                      ? "#f87171"
                      : "#4ade80",
                }}
              >
                {sched.forecastEnd ? format(sched.forecastEnd, "MMM d, yyyy") : "—"}
              </span>
            </div>
            {sched.spi !== null && (
              <div className="flex justify-between">
                <span style={{ color: "#8b949e" }}>SPI</span>
                <span
                  className="font-medium font-mono"
                  style={{
                    color:
                      sched.spi < 0.9 ? "#f87171" : sched.spi > 1.05 ? "#4ade80" : "#e6edf3",
                  }}
                >
                  {sched.spi.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span style={{ color: "#8b949e" }}>Due in 7d</span>
              <span className="font-medium" style={{ color: sched.dueSoon7 > 0 ? "#fbbf24" : "#e6edf3" }}>
                {sched.dueSoon7} tasks
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "#8b949e" }}>Due in 14d</span>
              <span className="font-medium" style={{ color: "#e6edf3" }}>{sched.dueSoon14} tasks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs Actual + Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-xl p-5" style={CARD}>
          <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>Budget vs Actual by Cost Code</h2>
          {fin.budgetVsActual.length === 0 ? (
            <p className="text-sm" style={{ color: "#8b949e" }}>No cost codes defined.</p>
          ) : (
            <div className="space-y-3">
              {fin.budgetVsActual.map((cc) => (
                <div key={cc.code}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium" style={{ color: "#e6edf3" }}>{cc.code} – {cc.name}</span>
                    <span>
                      <span style={{ color: "#8b949e" }}>{fmtUsd(cc.actual)} / {fmtUsd(cc.budget)}</span>
                      <span
                        className="ml-2 font-semibold"
                        style={{ color: cc.variance < 0 ? "#f87171" : "#8b949e" }}
                      >
                        {cc.variance < 0 ? `-${fmtUsd(Math.abs(cc.variance))} over` : `${fmtUsd(cc.variance)} left`}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#30373f" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(cc.pctUsed, 100)}%`,
                        background: cc.pctUsed >= 100 ? "#f87171" : cc.pctUsed >= 80 ? "#fbbf24" : "#C9A84C",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl p-5" style={CARD}>
          <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>Top Vendors by Spend</h2>
          {fin.topVendors.length === 0 ? (
            <p className="text-sm" style={{ color: "#8b949e" }}>No expense data.</p>
          ) : (
            <div className="space-y-2">
              {fin.topVendors.slice(0, 8).map((v, i) => (
                <div key={v.vendor} className="flex items-center gap-3">
                  <span className="text-xs w-4 shrink-0" style={{ color: "#8b949e" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="font-medium truncate" style={{ color: "#e6edf3" }}>{v.vendor}</span>
                      <span className="shrink-0 ml-2" style={{ color: "#8b949e" }}>{fmtUsd(v.amount)} ({v.pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#30373f" }}>
                      <div className="h-full rounded-full" style={{ width: `${v.pct}%`, background: "#C9A84C" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid #30373f" }}
        >
          <h2 className="font-semibold" style={{ color: "#e6edf3" }}>Recent Expenses</h2>
          <Link
            href={`/${params.companyId}/${params.projectId}/expenses/log`}
            className="text-sm transition-colors"
            style={{ color: "#C9A84C" }}
          >
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[...expenses].reverse().slice(0, 8).map((e) => (
              <tr
                key={e.id}
                style={{
                  borderBottom: "1px solid #30373f",
                  background: e.isDuplicate ? "#2d1b1b" : e.isPossibleDup ? "#2d2410" : "transparent",
                }}
              >
                <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: "#8b949e" }}>
                  {format(new Date(e.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d")}
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: "#e6edf3" }}>
                  {e.vendor}
                  {e.isDuplicate && (
                    <span
                      className="ml-2 text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "#6b2a2a", color: "#fca5a5" }}
                    >
                      dup
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 max-w-xs truncate text-xs" style={{ color: "#8b949e" }}>{e.description}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: "#e6edf3" }}>
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
