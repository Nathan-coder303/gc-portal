import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import Link from "next/link";
import DailyTrendChart from "@/components/expenses/DailyTrendChart";
import BudgetVsActual from "@/components/expenses/BudgetVsActual";

export default async function ExpensesPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const [expenses, costCodes] = await Promise.all([
    prisma.expense.findMany({
      where: { projectId: params.projectId },
      include: { costCode: true },
      orderBy: { date: "desc" },
    }),
    prisma.costCode.findMany({
      where: { projectId: params.projectId },
      orderBy: { code: "asc" },
    }),
  ]);

  // Group by date
  const byDate = new Map<string, typeof expenses>();
  for (const e of expenses) {
    const key = e.date.toISOString().split("T")[0];
    const arr = byDate.get(key) ?? [];
    arr.push(e);
    byDate.set(key, arr);
  }
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  const grandTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const grandTax = expenses.reduce((s, e) => s + Number(e.tax), 0);
  const dupCount = expenses.filter(e => e.isDuplicate || e.isPossibleDup).length;

  // Budget vs Actual
  const budgetRows = costCodes.map(cc => ({
    id: cc.id,
    code: cc.code,
    name: cc.name,
    budget: Number(cc.budgetAmount),
    actual: expenses.filter(e => e.costCodeId === cc.id).reduce((s, e) => s + Number(e.amount), 0),
  }));

  // For chart
  const chartExpenses = expenses.map(e => ({
    date: e.date.toISOString().split("T")[0],
    amount: Number(e.amount),
    category: e.category,
    costCode: e.costCode?.code ?? "Uncoded",
  })).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Daily Expense Summary</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {expenses.length} expenses · ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} spend
            {grandTax > 0 && ` · $${grandTax.toLocaleString("en-US", { minimumFractionDigits: 2 })} tax`}
            {dupCount > 0 && ` · ${dupCount} duplicate flags`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${params.companyId}/${params.projectId}/expenses/log`}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700">
            Expense Log
          </Link>
          <a href={`/api/${params.companyId}/${params.projectId}/export/expenses`}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Export CSV
          </a>
        </div>
      </div>

      {/* Daily trend chart */}
      <div className="mb-6">
        <DailyTrendChart expenses={chartExpenses} />
      </div>

      {/* Budget vs Actual */}
      {budgetRows.length > 0 && (
        <div className="mb-6">
          <BudgetVsActual rows={budgetRows} />
        </div>
      )}

      {/* Daily breakdown */}
      <div className="space-y-6">
        {sortedDates.map((dateKey) => {
          const dayExpenses = byDate.get(dateKey)!;
          const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
          const dayTax = dayExpenses.reduce((s, e) => s + Number(e.tax), 0);
          const dayCount = dayExpenses.length;
          const hasDups = dayExpenses.some(e => e.isDuplicate);
          const hasPossibleDups = dayExpenses.some(e => e.isPossibleDup);

          // Drill-down by vendor
          const byVendor = new Map<string, number>();
          const byCostCode = new Map<string, number>();
          for (const e of dayExpenses) {
            byVendor.set(e.vendor, (byVendor.get(e.vendor) ?? 0) + Number(e.amount));
            const cc = e.costCode?.code ?? "Uncoded";
            byCostCode.set(cc, (byCostCode.get(cc) ?? 0) + Number(e.amount));
          }

          return (
            <div key={dateKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">
                    {format(new Date(dateKey + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </span>
                  <span className="text-xs text-slate-400">{dayCount} transactions</span>
                  {hasDups && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Exact Dup</span>
                  )}
                  {hasPossibleDups && !hasDups && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Possible Dup</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    ${dayTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  {dayTax > 0 && (
                    <div className="text-xs text-slate-400">+${dayTax.toFixed(2)} tax</div>
                  )}
                </div>
              </div>

              {/* Expense rows */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Vendor</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Description</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Cost Code</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Category</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Paid By</th>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">Amount</th>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {dayExpenses.map(e => (
                    <tr key={e.id} className={`border-b border-slate-50 ${e.isDuplicate ? "bg-red-50" : e.isPossibleDup ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {e.vendor}
                        {e.isDuplicate && <span className="ml-2 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded">exact dup</span>}
                        {e.isPossibleDup && !e.isDuplicate && <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">possible dup</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{e.description}</td>
                      <td className="px-4 py-2 text-slate-500">{e.costCode?.code ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-500">{e.category}</td>
                      <td className="px-4 py-2 text-slate-500">{e.paidBy}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-800">
                        ${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400">
                        {Number(e.tax) > 0 ? `$${Number(e.tax).toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Drill-down subtotals */}
              <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs">
                <div>
                  <p className="font-medium text-slate-500 mb-1.5">By Vendor</p>
                  {Array.from(byVendor.entries()).sort((a,b) => b[1]-a[1]).map(([v, amt]) => (
                    <div key={v} className="flex justify-between py-0.5">
                      <span className="text-slate-600">{v}</span>
                      <span className="font-mono text-slate-700">${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-medium text-slate-500 mb-1.5">By Cost Code</p>
                  {Array.from(byCostCode.entries()).sort((a,b) => b[1]-a[1]).map(([cc, amt]) => (
                    <div key={cc} className="flex justify-between py-0.5">
                      <span className="font-mono text-slate-600">{cc}</span>
                      <span className="font-mono text-slate-700">${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
