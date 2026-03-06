import { prisma } from "@/lib/prisma";
import { computePartnerBalances } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import { format, subDays } from "date-fns";

export default async function DashboardPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const [project, expenses, tasks, entries, costCodes, partners] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.expense.findMany({ where: { projectId: params.projectId } }),
    prisma.task.findMany({ where: { projectId: params.projectId } }),
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true, partner: true } } },
    }),
    prisma.costCode.findMany({ where: { projectId: params.projectId } }),
    prisma.partner.findMany({ where: { companyId: params.companyId } }),
  ]);

  const totalSpend = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const budget = Number(project?.budget ?? 0);
  const remaining = budget - totalSpend;
  const spendPct = budget > 0 ? (totalSpend / budget) * 100 : 0;

  // Schedule health
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const blockedTasks = tasks.filter((t) => t.status === "BLOCKED").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;

  // Partner balances
  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type as AccountType,
      partnerId: l.partnerId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }))
  );
  const partnerBalances = computePartnerBalances(allLines);
  const totalContributions = Array.from(partnerBalances.values()).reduce((s, v) => s + v, 0);

  // Burn rate (last 7 days)
  const sevenDaysAgo = subDays(new Date(), 7);
  const recentExpenses = expenses.filter((e) => new Date(e.date) >= sevenDaysAgo);
  const recentSpend = recentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const dailyBurnRate = recentSpend / 7;

  // Cost code breakdown
  const ccSpend = costCodes.map((cc) => {
    const spend = expenses
      .filter((e) => e.costCodeId === cc.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return { code: cc.code, name: cc.name, budget: Number(cc.budgetAmount), spend };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{project?.name} Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Project start: {project?.startDate ? format(project.startDate, "MMM d, yyyy") : "—"} ·
          Budget: ${budget.toLocaleString("en-US")}
        </p>
      </div>

      {/* Top Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Spend Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Spend</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            ${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 0 })}
          </p>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${spendPct > 90 ? "bg-red-500" : spendPct > 70 ? "bg-amber-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min(spendPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{spendPct.toFixed(1)}% of ${budget.toLocaleString()} budget</p>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Remaining Budget</p>
          <p className={`text-2xl font-bold mt-1 ${remaining < 0 ? "text-red-600" : "text-green-600"}`}>
            ${Math.abs(remaining).toLocaleString("en-US", { minimumFractionDigits: 0 })}
            {remaining < 0 && " over"}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            Burn rate: ${dailyBurnRate.toFixed(0)}/day (7-day avg)
          </p>
        </div>

        {/* Schedule Health */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Schedule Health</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Done</span><span className="font-medium text-green-600">{doneTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>In Progress</span><span className="font-medium text-blue-600">{inProgressTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>Blocked</span><span className="font-medium text-orange-600">{blockedTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>Total</span><span className="font-medium">{totalTasks}</span>
            </div>
          </div>
        </div>

        {/* Partner Balances */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Partner Capital</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            ${totalContributions.toLocaleString("en-US", { minimumFractionDigits: 0 })}
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            {partners.map((p) => {
              const bal = partnerBalances.get(p.id) ?? 0;
              return (
                <div key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-medium text-slate-700">${bal.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Budget vs Actual by Cost Code */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-4">Budget vs Actual by Cost Code</h2>
        <div className="space-y-3">
          {ccSpend.map((cc) => {
            const pct = cc.budget > 0 ? (cc.spend / cc.budget) * 100 : 0;
            return (
              <div key={cc.code}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{cc.code} – {cc.name}</span>
                  <span className="text-slate-500">
                    ${cc.spend.toLocaleString()} / ${cc.budget.toLocaleString()}
                    <span className={`ml-2 font-medium ${pct > 100 ? "text-red-600" : "text-slate-600"}`}>
                      ({pct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Recent Expenses</h2>
          <a
            href={`/${params.companyId}/${params.projectId}/expenses`}
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </a>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {expenses.slice(0, 8).map((e) => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                  {format(new Date(e.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d")}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{e.vendor}</td>
                <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate">{e.description}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-800">
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
