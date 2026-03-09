import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import Link from "next/link";
import DailyTrendChart from "@/components/expenses/DailyTrendChart";
import BudgetVsActual from "@/components/expenses/BudgetVsActual";

const CARD = { background: "#1e2736", border: "1px solid #30373f" } as const;

export default async function ExpensesPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const [expenses, costCodes] = await Promise.all([
    prisma.expense.findMany({
      where: { projectId: params.projectId, archivedAt: null },
      include: { costCode: true },
      orderBy: { date: "desc" },
    }),
    prisma.costCode.findMany({
      where: { projectId: params.projectId, archivedAt: null },
      orderBy: { code: "asc" },
    }),
  ]);

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

  const budgetRows = costCodes.map(cc => ({
    id: cc.id,
    code: cc.code,
    name: cc.name,
    budget: Number(cc.budgetAmount),
    actual: expenses.filter(e => e.costCodeId === cc.id).reduce((s, e) => s + Number(e.amount), 0),
  }));

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
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Daily Expense Summary</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
            {expenses.length} expenses · ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} spend
            {grandTax > 0 && ` · $${grandTax.toLocaleString("en-US", { minimumFractionDigits: 2 })} tax`}
            {dupCount > 0 && ` · ${dupCount} duplicate flags`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${params.companyId}/${params.projectId}/expenses/log`}
            className="px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}>
            Expense Log
          </Link>
          <a href={`/api/${params.companyId}/${params.projectId}/export/expenses`}
            className="px-3 py-1.5 text-sm rounded-lg font-medium"
            style={{ background: "#C9A84C", color: "#0d1117" }}>
            Export CSV
          </a>
        </div>
      </div>

      <div className="mb-6">
        <DailyTrendChart expenses={chartExpenses} />
      </div>

      {budgetRows.length > 0 && (
        <div className="mb-6">
          <BudgetVsActual rows={budgetRows} />
        </div>
      )}

      <div className="space-y-6">
        {sortedDates.map((dateKey) => {
          const dayExpenses = byDate.get(dateKey)!;
          const dayTotal = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);
          const dayTax = dayExpenses.reduce((s, e) => s + Number(e.tax), 0);
          const dayCount = dayExpenses.length;
          const hasDups = dayExpenses.some(e => e.isDuplicate);
          const hasPossibleDups = dayExpenses.some(e => e.isPossibleDup);

          const byVendor = new Map<string, number>();
          const byCostCode = new Map<string, number>();
          for (const e of dayExpenses) {
            byVendor.set(e.vendor, (byVendor.get(e.vendor) ?? 0) + Number(e.amount));
            const cc = e.costCode?.code ?? "Uncoded";
            byCostCode.set(cc, (byCostCode.get(cc) ?? 0) + Number(e.amount));
          }

          return (
            <div key={dateKey} className="rounded-xl overflow-hidden" style={CARD}>
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
                style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: "#e6edf3" }}>
                    {format(new Date(dateKey + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </span>
                  <span className="text-xs" style={{ color: "#8b949e" }}>{dayCount} transactions</span>
                  {hasDups && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#2d1b1b", color: "#fca5a5", border: "1px solid #6b2a2a" }}>Exact Dup</span>
                  )}
                  {hasPossibleDups && !hasDups && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#2d2410", color: "#fcd34d", border: "1px solid #6b4f10" }}>Possible Dup</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold" style={{ color: "#e6edf3" }}>
                    ${dayTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  {dayTax > 0 && (
                    <div className="text-xs" style={{ color: "#8b949e" }}>+${dayTax.toFixed(2)} tax</div>
                  )}
                </div>
              </div>

              {/* Expense rows */}
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #30373f" }}>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Vendor</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Description</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Cost Code</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Category</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Paid By</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Amount</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {dayExpenses.map(e => (
                    <tr key={e.id} style={{
                      borderBottom: "1px solid #30373f",
                      background: e.isDuplicate ? "#2d1b1b" : e.isPossibleDup ? "#2d2410" : "transparent",
                    }}>
                      <td className="px-4 py-2 font-medium" style={{ color: "#e6edf3" }}>
                        {e.vendor}
                        {e.isDuplicate && <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "#6b2a2a", color: "#fca5a5" }}>exact dup</span>}
                        {e.isPossibleDup && !e.isDuplicate && <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "#6b4f10", color: "#fcd34d" }}>possible dup</span>}
                      </td>
                      <td className="px-4 py-2" style={{ color: "#8b949e" }}>{e.description}</td>
                      <td className="px-4 py-2" style={{ color: "#8b949e" }}>{e.costCode?.code ?? "—"}</td>
                      <td className="px-4 py-2" style={{ color: "#8b949e" }}>{e.category}</td>
                      <td className="px-4 py-2" style={{ color: "#8b949e" }}>{e.paidBy}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#e6edf3" }}>
                        ${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#8b949e" }}>
                        {Number(e.tax) > 0 ? `$${Number(e.tax).toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Drill-down subtotals */}
              <div className="grid grid-cols-2 gap-4 px-4 py-3 text-xs"
                style={{ background: "#161b22", borderTop: "1px solid #30373f" }}>
                <div>
                  <p className="font-medium mb-1.5" style={{ color: "#8b949e" }}>By Vendor</p>
                  {Array.from(byVendor.entries()).sort((a,b) => b[1]-a[1]).map(([v, amt]) => (
                    <div key={v} className="flex justify-between py-0.5">
                      <span style={{ color: "#8b949e" }}>{v}</span>
                      <span className="font-mono" style={{ color: "#e6edf3" }}>${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-1.5" style={{ color: "#8b949e" }}>By Cost Code</p>
                  {Array.from(byCostCode.entries()).sort((a,b) => b[1]-a[1]).map(([cc, amt]) => (
                    <div key={cc} className="flex justify-between py-0.5">
                      <span className="font-mono" style={{ color: "#8b949e" }}>{cc}</span>
                      <span className="font-mono" style={{ color: "#e6edf3" }}>${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
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
