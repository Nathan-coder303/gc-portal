import { prisma } from "@/lib/prisma";
import { computePartnerBalances } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import ReportsClient from "@/components/reports/ReportsClient";

export default async function ReportsPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const [expenses, costCodes, tasks, entries, partners] = await Promise.all([
    prisma.expense.findMany({
      where: { projectId: params.projectId, archivedAt: null },
      include: { costCode: true },
      orderBy: { date: "asc" },
    }),
    prisma.costCode.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.task.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true, partner: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.partner.findMany({ where: { companyId: params.companyId, archivedAt: null } }),
  ]);

  const budgetVsActual = costCodes.map((cc) => ({
    code: cc.code,
    name: cc.name,
    budget: Number(cc.budgetAmount),
    actual: expenses.filter((e) => e.costCodeId === cc.id).reduce((s, e) => s + Number(e.amount), 0),
  }));

  const burnRate: { date: string; cumulative: number }[] = [];
  let cumulative = 0;
  for (const e of expenses) {
    cumulative += Number(e.amount);
    burnRate.push({ date: e.date.toISOString().split("T")[0], cumulative });
  }

  const vendorMap = new Map<string, number>();
  for (const e of expenses) {
    vendorMap.set(e.vendor, (vendorMap.get(e.vendor) ?? 0) + Number(e.amount));
  }
  const vendorData = Array.from(vendorMap.entries())
    .map(([vendor, amount]) => ({ vendor, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type as AccountType,
      partnerId: l.partnerId,
      debit: Number(l.debit),
      credit: Number(l.credit),
      date: e.date.toISOString().split("T")[0],
      memo: e.memo,
      partnerName: l.partner?.name ?? null,
    }))
  );
  const partnerBalances = computePartnerBalances(allLines);

  const partnerStatements = partners.map((p) => {
    const lines = allLines.filter((l) => l.partnerId === p.id);
    let running = 0;
    const rows = lines.map((l) => {
      running += l.credit - l.debit;
      return { date: l.date, memo: l.memo, credit: l.credit, debit: l.debit, balance: running };
    });
    return { partner: p.name, rows, total: partnerBalances.get(p.id) ?? 0 };
  });

  const scheduleVariance = tasks.map((t) => ({
    name: t.name,
    phase: t.phase,
    plannedStart: t.startDate?.toISOString().split("T")[0] ?? "",
    plannedEnd: t.endDate?.toISOString().split("T")[0] ?? "",
    status: t.status,
    percentComplete: t.percentComplete,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>Financial and schedule analytics</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/${params.companyId}/${params.projectId}/export/expenses`}
            className="px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
          >
            Export Expenses
          </a>
          <a
            href={`/api/${params.companyId}/${params.projectId}/export/ledger`}
            className="px-3 py-1.5 text-sm rounded-lg font-medium"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            Export Ledger
          </a>
        </div>
      </div>
      <ReportsClient
        budgetVsActual={budgetVsActual}
        burnRate={burnRate}
        vendorData={vendorData}
        partnerStatements={partnerStatements}
        scheduleVariance={scheduleVariance}
      />
    </div>
  );
}
