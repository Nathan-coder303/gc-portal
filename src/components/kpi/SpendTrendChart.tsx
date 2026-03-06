"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type Day = { date: string; amount: number };

export default function SpendTrendChart({
  data,
  burn7d,
  burn30d,
}: {
  data: Day[];
  burn7d: number;
  burn30d: number;
}) {
  const fmt = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

  return (
    <div>
      <div className="flex items-center gap-6 mb-3 text-xs text-slate-500">
        <span>
          <span className="inline-block w-3 h-1 bg-blue-500 rounded mr-1.5 align-middle" />
          Daily spend
        </span>
        <span>
          <span className="inline-block w-3 h-0.5 bg-amber-500 rounded mr-1.5 align-middle" />
          7d avg: {fmt(burn7d)}/day
        </span>
        <span>
          <span className="inline-block w-3 h-0.5 bg-slate-400 rounded mr-1.5 align-middle border-dashed" />
          30d avg: {fmt(burn30d)}/day
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 9 }} width={45} />
          <Tooltip formatter={(v) => fmt(v as number)} labelFormatter={(l) => `Date: ${l}`} />
          <ReferenceLine y={burn7d} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
          <ReferenceLine y={burn30d} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
          <Bar dataKey="amount" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
