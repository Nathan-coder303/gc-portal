"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type BudgetVsActual = { code: string; name: string; budget: number; actual: number };
type BurnRate = { date: string; cumulative: number };
type VendorData = { vendor: string; amount: number };
type PartnerStatement = {
  partner: string;
  total: number;
  rows: { date: string; memo: string; credit: number; debit: number; balance: number }[];
};
type ScheduleVariance = {
  name: string;
  phase: string;
  plannedStart: string;
  plannedEnd: string;
  status: string;
  percentComplete: number;
};

export default function ReportsClient({
  budgetVsActual,
  burnRate,
  vendorData,
  partnerStatements,
  scheduleVariance,
}: {
  budgetVsActual: BudgetVsActual[];
  burnRate: BurnRate[];
  vendorData: VendorData[];
  partnerStatements: PartnerStatement[];
  scheduleVariance: ScheduleVariance[];
}) {
  const fmt = (n: number | undefined) =>
    n !== undefined ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0 }) : "";

  return (
    <div className="space-y-6">
      {/* Budget vs Actual */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Budget vs Actual by Cost Code</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={budgetVsActual} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="code" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => fmt(v as number)} />
            <Legend />
            <Bar dataKey="budget" name="Budget" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {/* Variance Table */}
        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 text-slate-500 font-medium">Cost Code</th>
              <th className="text-right py-2 text-slate-500 font-medium">Budget</th>
              <th className="text-right py-2 text-slate-500 font-medium">Actual</th>
              <th className="text-right py-2 text-slate-500 font-medium">Variance</th>
              <th className="text-right py-2 text-slate-500 font-medium">Var %</th>
            </tr>
          </thead>
          <tbody>
            {budgetVsActual.map((row) => {
              const variance = row.budget - row.actual;
              const varPct = row.budget > 0 ? ((row.actual / row.budget) * 100 - 100).toFixed(1) : "—";
              return (
                <tr key={row.code} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-700">{row.code} – {row.name}</td>
                  <td className="py-2 text-right font-mono text-slate-600">{fmt(row.budget)}</td>
                  <td className="py-2 text-right font-mono text-slate-600">{fmt(row.actual)}</td>
                  <td className={`py-2 text-right font-mono font-semibold ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {variance >= 0 ? "+" : ""}{fmt(variance)}
                  </td>
                  <td className={`py-2 text-right text-sm ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {varPct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Burn Rate */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Cumulative Burn Rate</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={burnRate} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => fmt(v as number)} />
            <Line type="monotone" dataKey="cumulative" name="Cumulative Spend" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Top Vendors</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={vendorData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="vendor" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v) => fmt(v as number)} />
              <Bar dataKey="amount" name="Total Spend" radius={[0, 3, 3, 0]}>
                {vendorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vendor Pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Spend Distribution</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={vendorData}
                dataKey="amount"
                nameKey="vendor"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${String(name ?? "").slice(0, 12)} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {vendorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Partner Statements */}
      {partnerStatements.map((ps) => (
        <div key={ps.partner} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Partner Statement – {ps.partner}</h2>
            <span className="text-sm font-mono font-semibold text-green-700">{fmt(ps.total)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Date</th>
                <th className="text-left px-4 py-2 text-slate-500 font-medium">Memo</th>
                <th className="text-right px-4 py-2 text-slate-500 font-medium">Credit</th>
                <th className="text-right px-4 py-2 text-slate-500 font-medium">Debit</th>
                <th className="text-right px-4 py-2 text-slate-500 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ps.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-500">{r.date}</td>
                  <td className="px-4 py-2 text-slate-700">{r.memo}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-700">{r.credit > 0 ? fmt(r.credit) : ""}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-600">{r.debit > 0 ? fmt(r.debit) : ""}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Schedule Variance */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Schedule Variance</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Task</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Phase</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Planned Start</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Planned End</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Status</th>
              <th className="text-right px-4 py-2 text-slate-500 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {scheduleVariance.map((t, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-2 text-slate-500">{t.phase}</td>
                <td className="px-4 py-2 text-slate-500">{t.plannedStart}</td>
                <td className="px-4 py-2 text-slate-500">{t.plannedEnd}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    t.status === "DONE" ? "bg-green-100 text-green-700" :
                    t.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                    t.status === "BLOCKED" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {t.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-slate-600">{t.percentComplete}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
