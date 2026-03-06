import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import Link from "next/link";

export default async function ExpensesPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const expenses = await prisma.expense.findMany({
    where: { projectId: params.projectId },
    include: { costCode: true },
    orderBy: { date: "desc" },
  });

  // Group by date
  const byDate = new Map<string, typeof expenses>();
  for (const e of expenses) {
    const key = e.date.toISOString().split("T")[0];
    const arr = byDate.get(key) ?? [];
    arr.push(e);
    byDate.set(key, arr);
  }

  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  const grandTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Daily Expense Summary</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {expenses.length} expenses · Grand total: ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${params.companyId}/${params.projectId}/expenses/log`}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            Expense Log
          </Link>
          <a
            href={`/api/${params.companyId}/${params.projectId}/export/expenses`}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="space-y-6">
        {sortedDates.map((dateKey) => {
          const dayExpenses = byDate.get(dateKey)!;
          const dayTotal = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
          const hasFlags = dayExpenses.some((e) => e.isDuplicate);

          return (
            <div key={dateKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {format(new Date(dateKey + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </span>
                  {hasFlags && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Duplicate Flagged
                    </span>
                  )}
                </div>
                <span className="font-semibold text-slate-900">
                  ${dayTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Vendor</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Description</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Cost Code</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Category</th>
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Paid By</th>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dayExpenses.map((e) => (
                    <tr key={e.id} className={`border-b border-slate-50 ${e.isDuplicate ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {e.vendor}
                        {e.isDuplicate && (
                          <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">dup</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{e.description}</td>
                      <td className="px-4 py-2 text-slate-500">{e.costCode?.code ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-500">{e.category}</td>
                      <td className="px-4 py-2 text-slate-500">{e.paidBy}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-800">
                        ${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
