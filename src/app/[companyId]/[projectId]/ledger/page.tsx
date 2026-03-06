import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { computeAccountBalance, computePartnerBalances } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import LedgerForms from "@/components/ledger/LedgerForms";
import PartnerCapitalStatement from "@/components/ledger/PartnerCapitalStatement";
import ReverseButton from "@/components/ledger/ReverseButton";

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
    prisma.partner.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
    }),
  ]);

  const reversedIds = new Set(
    entries.filter((e) => e.reversesId).map((e) => e.reversesId!)
  );

  // All journal lines enriched
  const allLines = entries.flatMap((e) =>
    e.lines.map((l) => ({
      accountId: l.accountId,
      accountType: l.account.type,
      partnerId: l.partnerId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }))
  );

  // Partner capital balances
  const partnerBalances = computePartnerBalances(allLines);

  // Account balances
  const accountBalances = new Map<string, number>();
  for (const line of allLines) {
    const acct = accounts.find((a) => a.id === line.accountId);
    if (!acct) continue;
    const current = accountBalances.get(line.accountId) ?? 0;
    accountBalances.set(
      line.accountId,
      current + computeAccountBalance(acct.type, line.debit, line.credit)
    );
  }

  // Cash position
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const cashBalance = cashAccount ? (accountBalances.get(cashAccount.id) ?? 0) : 0;

  // Capital lines for partner statements
  const capitalAccountId = accounts.find((a) => a.isPartnerCapital)?.id;
  const capitalLines = entries.flatMap((e) =>
    e.lines
      .filter((l) => l.accountId === capitalAccountId && l.partnerId)
      .map((l) => ({
        entryId: e.id,
        date: e.date,
        memo: e.memo,
        reference: e.reference ?? null,
        isReversal: e.isReversal,
        partnerId: l.partnerId,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))
  );

  // Total partner capital
  const totalCapital = Array.from(partnerBalances.values()).reduce((s, v) => s + v, 0);

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

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">Cash Position</div>
          <div className={`text-xl font-bold font-mono ${cashBalance >= 0 ? "text-green-700" : "text-red-600"}`}>
            ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">Total Partner Capital</div>
          <div className="text-xl font-bold font-mono text-slate-800">
            ${totalCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
        {partners.map((p) => {
          const bal = partnerBalances.get(p.id) ?? 0;
          return (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 mb-1">
                {p.name}
                {p.ownershipPct != null && <span className="ml-1 text-slate-400">({Number(p.ownershipPct)}%)</span>}
              </div>
              <div className={`text-xl font-bold font-mono ${bal >= 0 ? "text-slate-800" : "text-red-600"}`}>
                ${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Balances */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Account Balances</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Account</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Type</th>
              <th className="text-right px-4 py-2 text-slate-500 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const bal = accountBalances.get(a.id) ?? 0;
              return (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{a.type}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                    a.type === AccountType.ASSET && bal < 0 ? "text-red-600" : "text-slate-800"
                  }`}>
                    ${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Guided Entry Forms */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-4">New Journal Entry</h2>
        <LedgerForms
          projectId={params.projectId}
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
        />
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Journal Entries</h2>
          <p className="text-xs text-slate-400 mt-0.5">Entries are immutable — use Reverse to correct an error</p>
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
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.lines.map((line, lineIdx) => (
                <tr
                  key={`${entry.id}-${line.id}`}
                  className={`border-b border-slate-50 hover:bg-slate-50 ${entry.isReversal ? "bg-amber-50" : ""}`}
                >
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">
                    {lineIdx === 0
                      ? format(
                          new Date(entry.date.toISOString().split("T")[0] + "T00:00:00"),
                          "MMM d, yyyy"
                        )
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">
                    {lineIdx === 0 ? (entry.reference ?? "") : ""}
                  </td>
                  <td className="px-4 py-2 text-slate-700 max-w-xs">
                    {lineIdx === 0 && (
                      <span>
                        {entry.isReversal && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-1.5">
                            Reversal
                          </span>
                        )}
                        {entry.memo}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600 text-xs">{line.account.name}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{line.partner?.name ?? ""}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800 text-xs">
                    {Number(line.debit) > 0
                      ? `$${Number(line.debit).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800 text-xs">
                    {Number(line.credit) > 0
                      ? `$${Number(line.credit).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {lineIdx === 0 && (
                      <ReverseButton
                        entryId={entry.id}
                        isReversal={entry.isReversal}
                        alreadyReversed={reversedIds.has(entry.id)}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Partner Capital Statements */}
      {capitalLines.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Partner Capital Statements</h2>
            <p className="text-xs text-slate-400 mt-0.5">Running balance per partner</p>
          </div>
          <div className="p-4">
            <PartnerCapitalStatement
              partners={partners.map((p) => ({
                id: p.id,
                name: p.name,
                ownershipPct: p.ownershipPct != null ? Number(p.ownershipPct) : null,
              }))}
              capitalLines={capitalLines}
            />
          </div>
        </div>
      )}
    </div>
  );
}
