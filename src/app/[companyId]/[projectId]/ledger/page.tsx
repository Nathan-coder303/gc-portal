import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { computeAccountBalance, computePartnerBalances } from "@/lib/ledger/balances";
import { AccountType } from "@prisma/client";
import LedgerForms from "@/components/ledger/LedgerForms";
import PartnerCapitalStatement from "@/components/ledger/PartnerCapitalStatement";
import ReverseButton from "@/components/ledger/ReverseButton";
import PartnerManager, { AddPartnerInline } from "@/components/ledger/PartnerManager";
import PartnerAccountCards from "@/components/ledger/PartnerAccountCards";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

const CARD = { background: "#1e2736", border: "1px solid #30373f" } as const;

export default async function LedgerPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  const isAdmin = can(session?.user.role ?? "PARTNER", "partner:edit");
  const isPartner = session?.user.role === "PARTNER";
  const userName = session?.user.name?.trim().toLowerCase() ?? null;
  const userLastName = session?.user.lastName?.trim().toLowerCase() ?? null;

  const [entries, accounts, allPartners, project, accountEntries, savedPayees] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { projectId: params.projectId },
      include: { lines: { include: { account: true, partner: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.account.findMany({ where: { projectId: params.projectId, archivedAt: null } }),
    prisma.partner.findMany({
      where: { companyId: params.companyId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.project.findUnique({ where: { id: params.projectId }, select: { llcBeginningBalance: true } }),
    prisma.partnerAccountEntry.findMany({
      where: { projectId: params.projectId },
      orderBy: { date: "asc" },
    }),
    prisma.payee.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const payeeNames = savedPayees.map((p) => p.name);

  // PARTNER role: restrict visible partners to those matching the user's name
  const partners = isPartner
    ? allPartners.filter((p) => {
        const pName = p.name.toLowerCase();
        // If we have a first name, require it to match (don't match on shared last name alone)
        if (userName) return pName.includes(userName);
        // Fallback: last name only if no first name set
        if (userLastName) return pName.includes(userLastName);
        return false;
      })
    : allPartners;

  const viewPartners = partners;

  const reversedIds = new Set(entries.filter((e) => e.reversesId).map((e) => e.reversesId!));

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

  const accountBalances = new Map<string, number>();
  for (const line of allLines) {
    const acct = accounts.find((a) => a.id === line.accountId);
    if (!acct) continue;
    accountBalances.set(line.accountId, (accountBalances.get(line.accountId) ?? 0) + computeAccountBalance(acct.type, line.debit, line.credit));
  }

  const cashAccount = accounts.find((a) => a.name === "Cash");
  const cashBalance = cashAccount ? (accountBalances.get(cashAccount.id) ?? 0) : 0;
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
  const totalCapital = Array.from(partnerBalances.values()).reduce((s, v) => s + v, 0);

  // Partner account dashboard data
  const llcBeginningBalance = Number(project?.llcBeginningBalance ?? 0);

  const partnerEntriesMap: Record<string, { id: string; description: string; amount: number; entryType: "CREDIT" | "DEBIT"; date: string }[]> = {};
  for (const p of viewPartners) {
    partnerEntriesMap[p.id] = accountEntries
      .filter((e) => e.accountType === "PARTNER" && e.partnerId === p.id)
      .map((e) => ({ id: e.id, description: e.description, amount: Number(e.amount), entryType: e.entryType as "CREDIT" | "DEBIT", date: e.date.toISOString().split("T")[0] }));
  }

  const llcEntries = accountEntries
    .filter((e) => e.accountType === "LLC")
    .map((e) => ({ id: e.id, description: e.description, amount: Number(e.amount), entryType: e.entryType as "CREDIT" | "DEBIT", date: e.date.toISOString().split("T")[0] }));

  // Capital journal lines grouped by partner — serialize dates to strings for client component
  const capitalLinesByPartner: Record<string, { entryId: string; date: string; memo: string; debit: number; credit: number }[]> = {};
  for (const p of viewPartners) {
    capitalLinesByPartner[p.id] = capitalLines
      .filter((l) => l.partnerId === p.id)
      .map((l) => ({
        entryId: l.entryId,
        date: l.date.toISOString().split("T")[0],
        memo: l.memo,
        debit: l.debit,
        credit: l.credit,
      }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Partner Ledger</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>{entries.length} journal entries</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && <AddPartnerInline />}
          <a
            href={`/api/${params.companyId}/${params.projectId}/export/ledger`}
            className="px-3 py-1.5 text-sm rounded-lg font-medium"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Partner Account Dashboard */}
      {viewPartners.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3" style={{ color: "#e6edf3" }}>Account Overview</h2>
          <PartnerAccountCards
            projectId={params.projectId}
            companyId={params.companyId}
            partners={viewPartners.map((p) => ({
              id: p.id,
              name: p.name,
              beginningBalance: Number(p.beginningBalance),
            }))}
            llcBeginningBalance={llcBeginningBalance}
            partnerEntriesMap={partnerEntriesMap}
            llcEntries={llcEntries}
            capitalLinesByPartner={capitalLinesByPartner}
            isAdmin={isAdmin}
            isPartner={isPartner}
          />
        </div>
      )}

      {/* Summary cards */}
      {false && <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-4" style={CARD}>
          <div className="text-xs mb-1" style={{ color: "#8b949e" }}>Cash Position</div>
          <div className="text-xl font-bold font-mono" style={{ color: cashBalance >= 0 ? "#4ade80" : "#f87171" }}>
            ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl p-4" style={CARD}>
          <div className="text-xs mb-1" style={{ color: "#8b949e" }}>Total Partner Capital</div>
          <div className="text-xl font-bold font-mono" style={{ color: "#e6edf3" }}>
            ${totalCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
        {viewPartners.map((p) => {
          const bal = partnerBalances.get(p.id) ?? 0;
          return (
            <div key={p.id} className="rounded-xl p-4" style={CARD}>
              <div className="text-xs mb-1" style={{ color: "#8b949e" }}>
                {p.name}
                {p.ownershipPct != null && <span className="ml-1" style={{ color: "#8b949e" }}>({Number(p.ownershipPct)}%)</span>}
              </div>
              <div className="text-xl font-bold font-mono" style={{ color: bal >= 0 ? "#e6edf3" : "#f87171" }}>
                ${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          );
        })}
      </div>}

      {/* Account Balances */}
      {false &&
      <div className="rounded-xl overflow-hidden mb-6" style={CARD}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid #30373f" }}>
          <h2 className="font-semibold" style={{ color: "#e6edf3" }}>Account Balances</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Account</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Type</th>
              <th className="text-right px-4 py-2 font-medium" style={{ color: "#8b949e" }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const bal = accountBalances.get(a.id) ?? 0;
              return (
                <tr key={a.id} style={{ borderBottom: "1px solid #30373f" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "#e6edf3" }}>{a.name}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "#8b949e" }}>{a.type}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{
                    color: a.type === AccountType.ASSET && bal < 0 ? "#f87171" : "#e6edf3"
                  }}>
                    ${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>}

      {/* New Journal Entry */}
      {false && !isPartner && (
        <div className="rounded-xl p-5 mb-6" style={CARD}>
          <h2 className="font-semibold mb-4" style={{ color: "#e6edf3" }}>New Journal Entry</h2>
          <LedgerForms
            projectId={params.projectId}
            partners={allPartners.map((p) => ({ id: p.id, name: p.name }))}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
            payees={payeeNames}
          />
        </div>
      )}

      {/* Journal Entries Table */}
      {false && <div className="rounded-xl overflow-hidden mb-6" style={CARD}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid #30373f" }}>
          <h2 className="font-semibold" style={{ color: "#e6edf3" }}>Journal Entries</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Entries are immutable — use Reverse to correct an error</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Date</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Ref</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Memo</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Account</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Partner</th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Debit</th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "#8b949e" }}>Credit</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.lines.map((line, lineIdx) => (
                <tr
                  key={`${entry.id}-${line.id}`}
                  style={{
                    borderBottom: "1px solid #30373f",
                    background: entry.isReversal ? "#2d2410" : "transparent",
                  }}
                >
                  <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: "#8b949e" }}>
                    {lineIdx === 0 ? format(new Date(entry.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d, yyyy") : ""}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: "#8b949e" }}>
                    {lineIdx === 0 ? (entry.reference ?? "") : ""}
                  </td>
                  <td className="px-4 py-2 max-w-xs" style={{ color: "#e6edf3" }}>
                    {lineIdx === 0 && (
                      <span>
                        {entry.isReversal && (
                          <span className="text-xs px-1.5 py-0.5 rounded mr-1.5"
                            style={{ background: "#6b4f10", color: "#fcd34d" }}>Reversal</span>
                        )}
                        {entry.memo}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs" style={{ color: "#8b949e" }}>{line.account.name}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "#8b949e" }}>{line.partner?.name ?? ""}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: "#e6edf3" }}>
                    {Number(line.debit) > 0 ? `$${Number(line.debit).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: "#e6edf3" }}>
                    {Number(line.credit) > 0 ? `$${Number(line.credit).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {lineIdx === 0 && !isPartner && (
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
      </div>}

      {false && capitalLines.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-6" style={CARD}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid #30373f" }}>
            <h2 className="font-semibold" style={{ color: "#e6edf3" }}>Partner Capital Statements</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Running balance per partner</p>
          </div>
          <div className="p-4">
            <PartnerCapitalStatement
              partners={viewPartners.map((p) => ({
                id: p.id,
                name: p.name,
                ownershipPct: p.ownershipPct != null ? Number(p.ownershipPct) : null,
              }))}
              capitalLines={capitalLines}
            />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-xl p-5" style={CARD}>
          <PartnerManager
            partners={allPartners.map((p) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              role: p.role,
              ownershipPct: p.ownershipPct != null ? Number(p.ownershipPct) : null,
            }))}
            projectId={params.projectId}
          />
        </div>
      )}
    </div>
  );
}
