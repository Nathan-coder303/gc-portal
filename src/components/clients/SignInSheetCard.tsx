"use client";

import { useEffect, useRef, useState } from "react";

type Employee = { id: string; name: string; payPerDay: number; attendance: Record<string, boolean> };
type SheetData = { dates: string[]; employees: Employee[] };

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateShort(s: string): string {
  const [, m, d] = s.split("-").map(Number);
  return `${m}/${d}`;
}

function emptyEmployee(): Employee {
  return { id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: "", payPerDay: 0, attendance: {} };
}

export default function SignInSheetCard({
  companyId,
  estimateId,
  estimateName,
}: {
  companyId: string;
  estimateId: string;
  estimateName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SheetData>({ dates: [], employees: [] });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoad = useRef(true);

  // Load on first expand
  useEffect(() => {
    if (!open || !firstLoad.current) return;
    firstLoad.current = false;
    setLoading(true);
    fetch(`/api/${companyId}/estimates/${estimateId}/sign-in-sheet`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : { dates: [], employees: [] })
      .then((d: SheetData) => setData({ dates: d.dates ?? [], employees: d.employees ?? [] }))
      .finally(() => setLoading(false));
  }, [open, companyId, estimateId]);

  // Debounced save on data change
  useEffect(() => {
    if (firstLoad.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/${companyId}/estimates/${estimateId}/sign-in-sheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(() => setSavedAt(new Date())).catch(() => {});
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, companyId, estimateId]);

  const totals = data.employees.map(e => {
    const days = data.dates.reduce((s, d) => s + (e.attendance[d] ? 1 : 0), 0);
    return days * (Number(e.payPerDay) || 0);
  });
  const grand = totals.reduce((s, n) => s + n, 0);

  function addEmployee() {
    setData(d => ({ ...d, employees: [...d.employees, emptyEmployee()] }));
  }
  function removeEmployee(id: string) {
    setData(d => ({ ...d, employees: d.employees.filter(e => e.id !== id) }));
  }
  function updateEmployee(id: string, patch: Partial<Employee>) {
    setData(d => ({ ...d, employees: d.employees.map(e => e.id === id ? { ...e, ...patch } : e) }));
  }
  function toggleAttendance(id: string, date: string) {
    setData(d => ({
      ...d,
      employees: d.employees.map(e => {
        if (e.id !== id) return e;
        const att = { ...e.attendance };
        if (att[date]) delete att[date]; else att[date] = true;
        return { ...e, attendance: att };
      }),
    }));
  }
  function addDate(dateStr: string) {
    if (!dateStr) return;
    if (data.dates.includes(dateStr)) return;
    setData(d => ({ ...d, dates: [...d.dates, dateStr].sort() }));
  }
  function removeDate(dateStr: string) {
    setData(d => ({
      dates: d.dates.filter(x => x !== dateStr),
      employees: d.employees.map(e => {
        const att = { ...e.attendance };
        delete att[dateStr];
        return { ...e, attendance: att };
      }),
    }));
  }

  const [newDate, setNewDate] = useState(todayIso());

  return (
    <div className="rounded-2xl mb-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs" style={{ color: GOLD }}>{open ? "▼" : "▶"}</span>
          <span className="text-sm font-bold uppercase tracking-widest truncate" style={{ color: GOLD }}>Sign-In Sheet</span>
          {(data.employees.length > 0 || data.dates.length > 0) && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}>
              {data.employees.length} emp · {data.dates.length} day{data.dates.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {grand > 0 && (
            <span className="text-sm font-bold font-mono" style={{ color: GOLD }}>${fmtMoney(grand)}</span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          {loading ? (
            <p className="text-xs py-4 text-center" style={{ color: MUTED }}>Loading…</p>
          ) : (
            <>
              {/* Add date + Add employee */}
              <div className="flex items-center gap-2 py-3 flex-wrap">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="rounded px-2 py-1.5 text-xs"
                  style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                />
                <button
                  onClick={() => addDate(newDate)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}
                >
                  + Add Day
                </button>
                <button
                  onClick={addEmployee}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: GOLD, color: "#0d1117" }}
                >
                  + Add Employee
                </button>
                <div className="flex-1" />
                <a
                  href={`/api/${companyId}/estimates/${estimateId}/sign-in-sheet/pdf`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#1e2736", color: GOLD, border: `1px solid ${GOLD}33` }}
                >
                  ↓ PDF
                </a>
              </div>

              {/* Scrollable grid */}
              {data.employees.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: MUTED }}>
                  Add a date and an employee to get started.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${BORDER}` }}>
                  <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#1e2736" }}>
                        <th className="text-left px-2 py-2" style={{ color: MUTED, fontWeight: 700, position: "sticky", left: 0, background: "#1e2736", minWidth: 140 }}>
                          Employee
                        </th>
                        <th className="text-right px-2 py-2" style={{ color: MUTED, fontWeight: 700, minWidth: 90 }}>Pay/Day</th>
                        {data.dates.map(d => (
                          <th key={d} className="text-center px-1 py-2" style={{ color: MUTED, fontWeight: 700, minWidth: 50 }}>
                            <div className="flex items-center justify-center gap-1">
                              <span>{fmtDateShort(d)}</span>
                              <button onClick={() => removeDate(d)} className="text-[10px]" style={{ color: "#f87171" }} title="Remove day">×</button>
                            </div>
                          </th>
                        ))}
                        <th className="text-right px-2 py-2" style={{ color: GOLD, fontWeight: 700, minWidth: 80 }}>Total</th>
                        <th style={{ width: 32 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.map((e, idx) => (
                        <tr key={e.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                          <td className="px-2 py-1.5" style={{ position: "sticky", left: 0, background: idx % 2 === 0 ? CARD : "#10141a", minWidth: 140 }}>
                            <input
                              type="text"
                              value={e.name}
                              onChange={ev => updateEmployee(e.id, { name: ev.target.value })}
                              placeholder="Name"
                              className="w-full rounded px-2 py-1 text-xs"
                              style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={e.payPerDay || ""}
                              onChange={ev => updateEmployee(e.id, { payPerDay: parseFloat(ev.target.value) || 0 })}
                              placeholder="0"
                              className="w-full rounded px-2 py-1 text-xs text-right"
                              style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                            />
                          </td>
                          {data.dates.map(d => (
                            <td key={d} className="text-center px-1 py-1.5">
                              <button
                                onClick={() => toggleAttendance(e.id, d)}
                                className="w-7 h-7 rounded flex items-center justify-center mx-auto"
                                style={{
                                  background: e.attendance[d] ? `${GOLD}33` : "#0d1117",
                                  border: `1px solid ${e.attendance[d] ? GOLD : BORDER}`,
                                  color: e.attendance[d] ? GOLD : MUTED,
                                  fontSize: 14, fontWeight: 700,
                                }}
                                title={e.attendance[d] ? "Mark absent" : "Mark present"}
                              >
                                {e.attendance[d] ? "✓" : ""}
                              </button>
                            </td>
                          ))}
                          <td className="text-right px-2 py-1.5 font-bold font-mono" style={{ color: GOLD }}>
                            ${fmtMoney(totals[idx])}
                          </td>
                          <td className="text-center px-1">
                            <button onClick={() => removeEmployee(e.id)} className="text-xs" style={{ color: "#f87171" }} title="Remove employee">×</button>
                          </td>
                        </tr>
                      ))}
                      {/* Grand total */}
                      <tr style={{ background: "#1a1508", borderTop: `2px solid ${GOLD}55` }}>
                        <td colSpan={2 + data.dates.length} className="text-right px-2 py-2 font-bold uppercase tracking-wider" style={{ color: GOLD }}>
                          Grand Total
                        </td>
                        <td className="text-right px-2 py-2 font-bold font-mono text-sm" style={{ color: GOLD }}>
                          ${fmtMoney(grand)}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[10px] mt-3 px-1" style={{ color: "#484f58" }}>
                {savedAt ? `Auto-saved ${savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Auto-saves as you type"} · For: {estimateName}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
