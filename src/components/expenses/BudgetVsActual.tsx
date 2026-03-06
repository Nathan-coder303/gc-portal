type Row = {
  id: string;
  code: string;
  name: string;
  budget: number;
  actual: number;
};

export default function BudgetVsActual({ rows }: { rows: Row[] }) {
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800">Budget vs Actual</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2 text-slate-500 font-medium">Cost Code</th>
            <th className="text-right px-4 py-2 text-slate-500 font-medium">Budget</th>
            <th className="text-right px-4 py-2 text-slate-500 font-medium">Actual</th>
            <th className="text-right px-4 py-2 text-slate-500 font-medium">Remaining</th>
            <th className="px-4 py-2 w-32"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const remaining = r.budget - r.actual;
            const pct = r.budget > 0 ? Math.min((r.actual / r.budget) * 100, 100) : 0;
            const over = r.actual > r.budget;
            return (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  <span className="font-mono text-xs text-slate-500 mr-2">{r.code}</span>
                  {r.name}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                  ${r.budget.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-800">
                  ${r.actual.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono font-semibold ${over ? "text-red-600" : "text-green-600"}`}>
                  {over ? "-" : ""}${Math.abs(remaining).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  {over && <span className="ml-1 text-xs font-normal">over</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 text-right mt-0.5">{pct.toFixed(0)}%</div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-slate-200 bg-slate-50">
          <tr>
            <td className="px-4 py-2.5 font-semibold text-slate-700">Total</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-700">${totalBudget.toLocaleString()}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800">${totalActual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td className={`px-4 py-2.5 text-right font-mono font-bold ${totalActual > totalBudget ? "text-red-600" : "text-green-600"}`}>
              ${Math.abs(totalBudget - totalActual).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
