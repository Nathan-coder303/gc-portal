"use client";

import { useState } from "react";
import Link from "next/link";

type ClientWithLog = {
  id: string;
  name: string;
  projectName: string | null;
  lastLogDate: string | null;
  lastLogStatus: string | null;
  logCount: number;
};

const GOLD = "#C9A84C";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";
const BORDER = "#30373f";

function relativeDay(dateStr: string | null, todayDateStr: string): { label: string; tone: "today" | "yesterday" | "old" | "none" } {
  if (!dateStr) return { label: "No logs yet", tone: "none" };
  const ymd = dateStr.slice(0, 10);
  if (ymd === todayDateStr) return { label: "Today", tone: "today" };

  const [yT, mT, dT] = todayDateStr.split("-").map(Number);
  const today = new Date(Date.UTC(yT, mT - 1, dT));
  const log = new Date(dateStr);
  const diffDays = Math.floor((today.getTime() - log.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return { label: "Yesterday", tone: "yesterday" };
  if (diffDays > 1) return { label: `${diffDays}d ago`, tone: "old" };
  return { label: new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }), tone: "old" };
}

export default function DailyLogsCard({
  companyId,
  clients,
  todayDateStr,
}: {
  companyId: string;
  clients: ClientWithLog[];
  todayDateStr: string;
}) {
  const [open, setOpen] = useState(false);

  if (clients.length === 0) return null;

  // Aggregate counts for the collapsed header
  const todayLoggedCount = clients.filter(c => c.lastLogDate?.slice(0, 10) === todayDateStr).length;
  const noLogCount = clients.filter(c => !c.lastLogDate).length;

  return (
    <div className="rounded-2xl mb-4" style={{ background: "#161b22", border: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0" style={{ color: GOLD }}>{open ? "▼" : "▶"}</span>
          <span className="text-base sm:text-lg font-bold tracking-tight truncate" style={{ color: GOLD }}>📋 Daily Logs</span>
          <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}>
            {clients.length} active
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {todayLoggedCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#0a1f0e", color: "#22c55e", border: "1px solid #22c55e44" }}>
              ✓ {todayLoggedCount} today
            </span>
          )}
          {noLogCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#1f0a0a", color: "#f85149", border: "1px solid #f8514944" }}>
              {noLogCount} no logs
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-3 sm:px-5 pb-3 sm:pb-5" style={{ borderTop: `1px solid ${BORDER}` }}>
          {/* 3 columns on mobile, 3 on sm, 4 on lg */}
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 pt-3">
            {clients.map(c => {
              const r = relativeDay(c.lastLogDate, todayDateStr);
              const toneColor =
                r.tone === "today" ? "#22c55e" :
                r.tone === "yesterday" ? GOLD :
                r.tone === "none" ? "#f85149" :
                MUTED;
              return (
                <Link
                  key={c.id}
                  href={`/${companyId}/clients/${c.id}?tab=daily-logs`}
                  className="flex flex-col rounded-xl px-2 py-2 transition-colors hover:opacity-90"
                  style={{ background: "#0d1117", border: `1px solid ${BORDER}` }}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs font-semibold leading-tight truncate" style={{ color: TEXT }}>
                      {c.projectName || c.name}
                    </p>
                    {c.projectName && c.projectName !== c.name && (
                      <p className="text-[9px] truncate" style={{ color: MUTED }}>{c.name}</p>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold leading-none truncate" style={{ color: toneColor }}>{r.label}</span>
                    <span className="text-[9px] shrink-0" style={{ color: MUTED }}>{c.logCount}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
