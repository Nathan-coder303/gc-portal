import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { computePartnerBalances } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import JournalEntryForm from "@/components/ledger/JournalEntryForm";
import PartnerContributionForm from "@/components/ledger/PartnerContributionForm";

export default async function LedgerPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const [entries, accounts, partners] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true, partner: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.account.findMany({ where: { projectId: params.projectId } }),
    prisma.partner.findMany({ where: { companyId: params.companyId } }),
  ]);

  // Compute partner balances
  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type,
      partnerId: l.partnerId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }))
  );
  const partnerBalances = computePartnerBalances(allLines);

  // Account balances
  const accountBalances = new Map<string, number>();
  for (const line of allLines) {
    const acct = accounts.find((a) => a.id === line.accountId);
    if (!acct) continue;
    const current = accountBalances.get(line.accountId) ?? 0;
    const isNormalDebit = acct.type === AccountType.ASSET || acct.type === AccountType.EXPENSE;
    accountBalances.set(
      line.accountId,
      current + (isNormalDebit ? line.debit - line.credit : line.credit - line.debit)
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Partner Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">{entries.length} journal entries</p>
        </div>
        <a
          href={`/api/${params.companyId}/${params.projectId}/export/ledger`}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Export CSV
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Partner Balances */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Partner Capital Balances</h2>
          <div className="space-y-2">
            {partners.map((p) => {
              const bal = partnerBalances.get(p.id) ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{p.name}</span>
                  <span className={`text-sm font-mono font-semibold ${bal >= 0 ? "text-green-700" : "text-red-600"}`}>
                    ${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Balances */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Account Balances</h2>
          <div className="space-y-2">
            {accounts.map((a) => {
              const bal = accountBalances.get(a.id) ?? 0;
              return (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="text-sm text-slate-700">{a.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{a.type}</span>
                  </div>
                  <span className="text-sm font-mono font-semibold text-slate-800">
                    ${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Contribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Add Partner Contribution</h2>
          <PartnerContributionForm
            projectId={params.projectId}
            partners={partners.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      </div>

      {/* Add Journal Entry */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-3">Add Journal Entry</h2>
        <JournalEntryForm
          projectId={params.projectId}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Journal Entries</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Date</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Ref</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Memo</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Account</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Partner</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Debit</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.lines.map((line, lineIdx) => (
                <tr key={`${entry.id}-${line.id}`} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                    {lineIdx === 0 ? format(new Date(entry.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d, yyyy") : ""}
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">{lineIdx === 0 ? (entry.reference ?? "") : ""}</td>
                  <td className="px-4 py-2 text-slate-700">{lineIdx === 0 ? entry.memo : ""}</td>
                  <td className="px-4 py-2 text-slate-600">{line.account.name}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{line.partner?.name ?? ""}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800">
                    {Number(line.debit) > 0 ? `$${Number(line.debit).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800">
                    {Number(line.credit) > 0 ? `$${Number(line.credit).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
