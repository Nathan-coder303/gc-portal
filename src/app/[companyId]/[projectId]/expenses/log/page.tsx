import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { format } from "date-fns";
import Link from "next/link";
import { Suspense } from "react";
import AddExpenseForm from "@/components/expenses/ExpenseForm";
import ExpenseFilters from "@/components/expenses/ExpenseFilters";
import { deleteExpense } from "../actions";

export default async function ExpenseLogPage({
  params,
  searchParams,
}: {
  params: { companyId: string; projectId: string };
  searchParams: {
    from?: string;
    to?: string;
    vendor?: string;
    costCode?: string;
    category?: string;
    paidBy?: string;
    flags?: string;
  };
}) {
  const session = await auth();
  const canEdit = session?.user.role !== "PARTNER";

  const costCodes = await prisma.costCode.findMany({
    where: { projectId: params.projectId },
    orderBy: { code: "asc" },
  });

  // Build Prisma where clause from searchParams
  const where: Prisma.ExpenseWhereInput = {
    projectId: params.projectId,
  };

  if (searchParams.from) {
    where.date = { ...((where.date as object) ?? {}), gte: new Date(searchParams.from) };
  }
  if (searchParams.to) {
    where.date = { ...((where.date as object) ?? {}), lte: new Date(searchParams.to) };
  }
  if (searchParams.vendor) {
    where.vendor = { contains: searchParams.vendor, mode: "insensitive" };
  }
  if (searchParams.costCode) {
    const cc = costCodes.find(c => c.code === searchParams.costCode);
    where.costCodeId = cc?.id ?? "__none__";
  }
  if (searchParams.category) {
    where.category = searchParams.category;
  }
  if (searchParams.paidBy) {
    where.paidBy = { contains: searchParams.paidBy, mode: "insensitive" };
  }
  if (searchParams.flags === "dup") {
    where.isDuplicate = true;
  } else if (searchParams.flags === "possibleDup") {
    where.isPossibleDup = true;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { costCode: true },
    orderBy: { date: "desc" },
  });

  const grandTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expense Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {expenses.length} entries · ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} total
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${params.companyId}/${params.projectId}/expenses`}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
          >
            Daily Summary
          </Link>
          <a
            href={`/api/${params.companyId}/${params.projectId}/export/expenses`}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Export CSV
          </a>
        </div>
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

      {/* Filters — client component, needs Suspense for useSearchParams */}
      <Suspense>
        <ExpenseFilters
          costCodes={costCodes.map(c => ({ id: c.id, code: c.code, name: c.name }))}
        />
      </Suspense>

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
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Tax</th>
              {canEdit && <th className="px-4 py-2.5 w-16"></th>}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-4 py-8 text-center text-sm text-slate-400">
                  No expenses match the current filters
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr
                key={e.id}
                className={`border-b border-slate-50 hover:bg-slate-50 ${
                  e.isDuplicate ? "bg-red-50" : e.isPossibleDup ? "bg-amber-50" : ""
                }`}
              >
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                  {format(new Date(e.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {e.vendor}
                  {e.isDuplicate && (
                    <span className="ml-2 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded">exact dup</span>
                  )}
                  {e.isPossibleDup && !e.isDuplicate && (
                    <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">possible dup</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600 max-w-xs">
                  <div className="truncate">{e.description}</div>
                  {e.notes && <div className="text-xs text-slate-400 truncate">{e.notes}</div>}
                </td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{e.costCode?.code ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{e.category}</td>
                <td className="px-4 py-2 text-slate-500">{e.paymentMethod}</td>
                <td className="px-4 py-2 text-slate-500">{e.paidBy}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-800 whitespace-nowrap">
                  ${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-400 whitespace-nowrap">
                  {Number(e.tax) > 0 ? `$${Number(e.tax).toFixed(2)}` : "—"}
                </td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <form action={async () => { await deleteExpense(e.id); }}>
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700">Delete</button>
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
