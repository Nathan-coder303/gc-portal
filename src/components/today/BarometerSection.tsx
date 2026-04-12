"use client";

import { useState } from "react";

const GOAL_2026 = 5_000_000;

export type ClientIncomeSummary = {
  id: string;
  name: string;
  status: string;
  estimateTotal: number;
  internalProfit: number;
  gcFee: number;
  mibhIncome: number;
  companyId: string;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtFull(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function BarometerSection({ mibhIncome, clients }: { mibhIncome: number; clients: ClientIncomeSummary[] }) {
  const [open, setOpen] = useState(false);
  const goalPct = Math.min(100, (mibhIncome / GOAL_2026) * 100);

  const active = clients.filter(c => c.status === "ACTIVE");
  const completed = clients.filter(c => c.status === "COMPLETED");

  const activeIncome = active.reduce((s, c) => s + c.mibhIncome, 0);
  const completedIncome = completed.reduce((s, c) => s + c.mibhIncome, 0);

  function ClientRow({ c }: { c: ClientIncomeSummary }) {
    return (
      <a
        href={`/${c.companyId}/clients/${c.id}`}
        className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[#1a2030] rounded-lg"
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{c.name}</div>
          <div className="flex gap-3 mt-0.5 text-xs" style={{ color: "#8b949e" }}>
            <span>Est: <span style={{ color: "#94a3b8" }}>${fmt(c.estimateTotal)}</span></span>
            {c.internalProfit > 0 && <span>Profit: <span style={{ color: "#22c55e" }}>${fmt(c.internalProfit)}</span></span>}
            {c.gcFee > 0 && <span>GC Fee: <span style={{ color: "#C9A84C" }}>${fmt(c.gcFee)}</span></span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold" style={{ color: "#22c55e" }}>${fmt(c.mibhIncome)}</div>
          <div className="text-[10px]" style={{ color: "#484f58" }}>MIBH Income</div>
        </div>
      </a>
    );
  }

  return (
    <>
      {/* Clickable barometer */}
      <div
        className="mt-6 mb-6 rounded-2xl px-6 py-5 cursor-pointer transition-all hover:border-[#22c55e66]"
        style={{ background: "#0a1a0f", border: "1px solid #22c55e33" }}
        onClick={() => setOpen(true)}
      >
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#22c55e88" }}>MIBH Income 2026</div>
            <div className="text-5xl font-black leading-none" style={{ color: "#22c55e" }}>
              ${fmt(mibhIncome)}
            </div>
            <div className="text-xs mt-1.5" style={{ color: "#484f58" }}>Click for breakdown →</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#8b949e" }}>Goal 2026</div>
            <div className="text-2xl font-bold" style={{ color: "#8b949e" }}>$5,000,000</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: "#22c55e" }}>{goalPct.toFixed(1)}% there</div>
          </div>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 18, background: "#1a2a1a", border: "1px solid #22c55e22" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(goalPct, 0.5)}%`,
              background: goalPct >= 100 ? "#C9A84C" : "linear-gradient(90deg, #16a34a, #22c55e)",
              minWidth: 4,
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs" style={{ color: "#22c55e88" }}>{active.length} open · {completed.length} closed</span>
          <span className="text-xs" style={{ color: "#8b949e" }}>${fmt(GOAL_2026 - mibhIncome)} remaining</span>
        </div>
      </div>

      {/* Summary modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[85vh] flex flex-col" style={{ background: "#161b22", border: "1px solid #30373f" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #30373f", background: "#0a1a0f" }}>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#22c55e88" }}>MIBH Income 2026</div>
                <div className="text-3xl font-black" style={{ color: "#22c55e" }}>${fmtFull(mibhIncome)}</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none" style={{ color: "#8b949e" }}>×</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-6">

              {/* Open Jobs */}
              <div>
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>Open Jobs ({active.length})</span>
                  <span className="text-sm font-bold" style={{ color: "#22c55e" }}>${fmtFull(activeIncome)}</span>
                </div>
                {active.length === 0 && <p className="text-xs px-4" style={{ color: "#484f58" }}>No active clients</p>}
                {active.map(c => <ClientRow key={c.id} c={c} />)}
              </div>

              {/* Closed Jobs */}
              {completed.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2 px-2" style={{ borderTop: "1px solid #30373f", paddingTop: 16 }}>
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>Closed Jobs ({completed.length})</span>
                    <span className="text-sm font-bold" style={{ color: "#8b949e" }}>${fmtFull(completedIncome)}</span>
                  </div>
                  {completed.map(c => <ClientRow key={c.id} c={c} />)}
                </div>
              )}

              {active.length === 0 && completed.length === 0 && (
                <p className="text-center text-sm py-8" style={{ color: "#484f58" }}>No active or completed clients yet.</p>
              )}
            </div>

            {/* Footer total */}
            <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: "1px solid #30373f", background: "#0d1117" }}>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>Total MIBH Income</span>
              <span className="text-xl font-black" style={{ color: "#22c55e" }}>${fmtFull(mibhIncome)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
