"use client";

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { DailyForecast } from "@/lib/projections/forecast";

export default function CashflowChart({
  forecast,
  horizon,
}: {
  forecast: DailyForecast[];
  horizon: 30 | 60 | 90;
}) {
  const data = forecast.slice(0, horizon).filter((_, i) => i % (horizon <= 30 ? 1 : horizon <= 60 ? 2 : 3) === 0);

  const fmt = (v: number) =>
    Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="dayLabel" tick={{ fontSize: 10 }} interval={Math.floor(data.length / 6)} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} width={55} />
        <Tooltip
          formatter={(v, name) => [fmt(v as number), name]}
          labelFormatter={(l) => `${l}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5} label={{ value: "Cash out", fontSize: 10, fill: "#ef4444" }} />
        <Area
          type="monotone"
          dataKey="cashBalance"
          name="Cash Balance"
          fill="#dbeafe"
          stroke="#3b82f6"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="cumulativeSpend"
          name="Cumulative Spend"
          stroke="#f59e0b"
          strokeWidth={1.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
