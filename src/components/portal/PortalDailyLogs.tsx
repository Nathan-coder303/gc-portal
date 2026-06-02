"use client";

import { useState, useEffect } from "react";

type Log = {
  id: string;
  arrivalDate: string;
  departureTime: string | null;
  status: string;
  weatherCondition: string | null;
  temperature: string | null;
  siteCondition: string | null;
  weatherDelay: boolean;
  scheduleDelay: boolean;
  tasksPerformed: string | null;
  employeesOnSite: string | null;
  visitorsOnSite: boolean;
  jobsiteConditionNotes: string | null;
  materialNotes: string | null;
  equipmentNotes: string | null;
  projectNotes: string | null;
  workCompletedPct: string | null;
  createdBy: string | null;
  attachmentCount: number;
};

const GOLD = "#C9A84C";
const CARD = "#161b22";
const BORDER = "#30373f";
const MUTED = "#8b949e";
const TEXT = "#e6edf3";
const BG = "#0d1117";

function statusStyle(status: string) {
  if (status === "COMPLETE") return { bg: "#0d2a1a", color: "#22c55e", label: "Complete" };
  if (status === "ON_HOLD") return { bg: "#1a1a2e", color: "#8b949e", label: "On Hold" };
  return { bg: "#2a1f00", color: "#f59e0b", label: "In Progress" };
}

function parseNotes(raw: string | null): { title?: string; content: string; addedBy?: string }[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <span className="text-xs shrink-0 pt-0.5" style={{ color: MUTED, width: 130 }}>{label}</span>
      <span className="text-xs" style={{ color: TEXT }}>{value}</span>
    </div>
  );
}

function LogCard({ log, clientId }: { log: Log; clientId: string }) {
  const [open, setOpen] = useState(false);
  const st = statusStyle(log.status);
  const date = new Date(log.arrivalDate);
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeLabel = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const notes = parseNotes(log.projectNotes);
  const pdfUrl = `/api/client-portal/${clientId}/daily-logs/${log.id}/pdf`;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: TEXT }}>{dateLabel}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: st.bg, color: st.color }}>
              {st.label}
            </span>
            {log.weatherDelay && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#2a1f00", color: "#f59e0b" }}>Weather Delay</span>
            )}
            {log.scheduleDelay && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#2a1010", color: "#ef4444" }}>Schedule Delay</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: MUTED }}>Arrival {timeLabel}</span>
            {log.departureTime && <span className="text-xs" style={{ color: MUTED }}>· Departure {log.departureTime}</span>}
            {log.weatherCondition && <span className="text-xs" style={{ color: MUTED }}>· {log.weatherCondition}{log.temperature ? ` ${log.temperature}°F` : ""}</span>}
            {log.workCompletedPct && <span className="text-xs font-semibold" style={{ color: GOLD }}>{log.workCompletedPct}% complete</span>}
            {log.attachmentCount > 0 && <span className="text-xs" style={{ color: MUTED }}>📎 {log.attachmentCount}</span>}
          </div>
        </div>
        <span className="text-xs shrink-0" style={{ color: MUTED }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
            {log.tasksPerformed && (
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>Tasks Performed</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: TEXT }}>{log.tasksPerformed}</p>
              </div>
            )}

            <div className="space-y-0">
              {log.siteCondition && <Row label="Site Condition" value={log.siteCondition} />}
              {log.employeesOnSite && <Row label="Employees on Site" value={log.employeesOnSite} />}
              {log.visitorsOnSite && <Row label="Visitors on Site" value="Yes" />}
              {log.jobsiteConditionNotes && <Row label="Site Notes" value={log.jobsiteConditionNotes} />}
              {log.materialNotes && <Row label="Material Notes" value={log.materialNotes} />}
              {log.equipmentNotes && <Row label="Equipment Notes" value={log.equipmentNotes} />}
              {log.createdBy && <Row label="Logged by" value={log.createdBy} />}
            </div>

            {notes.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>Project Notes</p>
                {notes.map((n, i) => (
                  <div key={i} className="mb-2">
                    {n.title && <p className="text-xs font-semibold" style={{ color: MUTED }}>{n.title}{n.addedBy ? ` — ${n.addedBy}` : ""}</p>}
                    {n.content && <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: TEXT }}>{n.content}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              View PDF
            </a>
            <a
              href={`${pdfUrl}?download=1`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: BG, color: MUTED, border: `1px solid ${BORDER}` }}
            >
              ↓ Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortalDailyLogs({ clientId }: { clientId: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/client-portal/${clientId}/daily-logs`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLogs(data); })
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p className="text-sm py-4" style={{ color: MUTED }}>Loading…</p>;
  if (logs.length === 0) return <p className="text-sm" style={{ color: "#484f58" }}>No daily logs yet.</p>;

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <LogCard key={log.id} log={log} clientId={clientId} />
      ))}
    </div>
  );
}
