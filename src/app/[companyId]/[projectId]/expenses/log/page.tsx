import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { format } from "date-fns";
import Link from "next/link";
import AddExpenseForm from "@/components/expenses/ExpenseForm";
import { deleteExpense } from "../actions";

export default async function ExpenseLogPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  const expenses = await prisma.expense.findMany({
    where: { projectId: params.projectId },
    include: { costCode: true },
    orderBy: { date: "desc" },
  });

  const costCodes = await prisma.costCode.findMany({
    where: { projectId: params.projectId },
    orderBy: { code: "asc" },
  });

  const canEdit = session?.user.role !== "PARTNER";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expense Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">{expenses.length} total entries</p>
        </div>
        <Link
          href={`/${params.companyId}/${params.projectId}/expenses`}
          className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
        >
          Daily Summary
        </Link>
      </div>

      {canEdit && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4">Add Expense</h2>
          <AddExpenseForm
            projectId={params.projectId}
            costCodes={costCodes.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Date</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Vendor</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Description</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Cost Code</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Category</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Payment</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Paid By</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Amount</th>
              {canEdit && <th className="px-4 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className={`border-b border-slate-50 hover:bg-slate-50 ${e.isDuplicate ? "bg-amber-50" : ""}`}>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                  {format(new Date(e.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {e.vendor}
                  {e.isDuplicate && (
                    <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">dup</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{e.description}</td>
                <td className="px-4 py-2 text-slate-500">{e.costCode?.code ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{e.category}</td>
                <td className="px-4 py-2 text-slate-500">{e.paymentMethod}</td>
                <td className="px-4 py-2 text-slate-500">{e.paidBy}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-800 whitespace-nowrap">
                  ${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <form action={async () => { await deleteExpense(e.id); }}>
                      <button className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
