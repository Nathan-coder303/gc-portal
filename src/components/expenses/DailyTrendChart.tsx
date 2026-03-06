"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#64748b"];

type Expense = {
  date: string;
  amount: number;
  category: string;
  costCode: string;
};

export default function DailyTrendChart({ expenses }: { expenses: Expense[] }) {
  const [groupBy, setGroupBy] = useState<"category" | "costCode">("category");

  // Collect all unique groups
  const groups = Array.from(new Set(expenses.map(e => e[groupBy] || "Uncoded"))).sort();

  // Build per-day data
  const byDate = new Map<string, Record<string, number>>();
  for (const e of expenses) {
    const row = byDate.get(e.date) ?? {};
    const key = e[groupBy] || "Uncoded";
    row[key] = (row[key] ?? 0) + e.amount;
    byDate.set(e.date, row);
  }

  const data = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({ date: date.slice(5), ...row })); // "MM-DD"

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Daily Spend Trend</h2>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setGroupBy("category")}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${groupBy === "category" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            By Category
          </button>
          <button
            onClick={() => setGroupBy("costCode")}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${groupBy === "costCode" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            By Cost Code
          </button>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No expense data</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
            <Legend />
            {groups.map((g, i) => (
              <Bar key={g} dataKey={g} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === groups.length - 1 ? [3,3,0,0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
