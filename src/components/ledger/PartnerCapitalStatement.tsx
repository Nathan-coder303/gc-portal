import { format } from "date-fns";

type Line = {
  entryId: string;
  date: Date;
  memo: string;
  reference: string | null;
  isReversal: boolean;
  partnerId: string | null;
  debit: number;
  credit: number;
};

type Partner = {
  id: string;
  name: string;
  ownershipPct: number | null;
};

export default function PartnerCapitalStatement({
  partners,
  capitalLines,
}: {
  partners: Partner[];
  capitalLines: Line[];
}) {
  return (
    <div className="space-y-6">
      {partners.map((p) => {
        const lines = capitalLines.filter((l) => l.partnerId === p.id);
        if (lines.length === 0) return null;

        let running = 0;
        const rows = [...lines].sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        ).map((l) => {
          running += l.credit - l.debit;
          return { ...l, balance: running };
        });

        return (
          <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-200">
              <div>
                <span className="font-semibold text-slate-800">{p.name}</span>
                {p.ownershipPct != null && (
                  <span className="ml-2 text-xs text-slate-500">{p.ownershipPct}% ownership</span>
                )}
              </div>
              <span className={`text-sm font-mono font-bold ${running >= 0 ? "text-green-700" : "text-red-600"}`}>
                ${running.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Date</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Memo</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Credit</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Debit</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.entryId}-${i}`} className={`border-b border-slate-50 ${r.isReversal ? "bg-amber-50" : ""}`}>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">
                      {format(new Date(r.date.toISOString().split("T")[0] + "T00:00:00"), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {r.isReversal && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mr-1.5">Reversal</span>}
                      {r.memo}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-green-700">
                      {r.credit > 0 ? `$${r.credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-red-600">
                      {r.debit > 0 ? `$${r.debit.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${r.balance >= 0 ? "text-slate-800" : "text-red-600"}`}>
                      ${r.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
