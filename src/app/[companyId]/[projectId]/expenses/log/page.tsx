import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Suspense } from "react";
import AddExpenseForm from "@/components/expenses/ExpenseForm";
import ExpenseFilters from "@/components/expenses/ExpenseFilters";
import ExpenseLogTable from "@/components/expenses/ExpenseLogTable";
import { can } from "@/lib/auth/permissions";

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
  const role = session?.user.role ?? "PARTNER";
  const canEdit = can(role, "expense:edit");
  const canArchive = can(role, "expense:archive");
  const canAdd = can(role, "expense:create");

  const costCodes = await prisma.costCode.findMany({
    where: { projectId: params.projectId, archivedAt: null },
    orderBy: { code: "asc" },
  });

  // Build Prisma where clause from searchParams
  const where: Prisma.ExpenseWhereInput = {
    projectId: params.projectId,
    archivedAt: null,
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

      {canAdd && (
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

      <ExpenseLogTable
        expenses={expenses.map((e) => ({
          id: e.id,
          date: e.date.toISOString().split("T")[0],
          vendor: e.vendor,
          description: e.description,
          costCodeId: e.costCodeId,
          costCodeCode: e.costCode?.code ?? null,
          category: e.category,
          amount: Number(e.amount),
          tax: Number(e.tax),
          paymentMethod: e.paymentMethod,
          paidBy: e.paidBy,
          receiptUrl: e.receiptUrl,
          notes: e.notes,
          isDuplicate: e.isDuplicate,
          isPossibleDup: e.isPossibleDup,
        }))}
        costCodes={costCodes.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
        canEdit={canEdit}
        canArchive={canArchive}
      />
    </div>
  );
}
