"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Appointment = { id: string; text: string; dueDate: string | null };

export default function AppointmentsCard({
  companyId,
  initialAppointments,
  todayDateStr,
}: {
  companyId: string;
  initialAppointments: Appointment[];
  todayDateStr: string;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [showAdd, setShowAdd] = useState(false);
  const [apptText, setApptText] = useState("");
  const [apptDate, setApptDate] = useState(todayDateStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!apptText.trim()) return;
    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.append("category", "TASK");
    fd.append("text", `📅 Appointment – ${apptText.trim()}`);
    fd.append("dueDate", apptDate);
    try {
      const res = await fetch(`/api/${companyId}/follow-ups`, { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const item = await res.json();
      if (item.dueDate && item.dueDate.slice(0, 10) === todayDateStr) {
        setAppointments(prev => [...prev, { id: item.id, text: item.text, dueDate: item.dueDate }]);
      }
      setApptText("");
      setApptDate(todayDateStr);
      setShowAdd(false);
      router.refresh();
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  }

  return (
    <div
      className="mb-4 rounded-2xl px-4 py-4 sm:px-6 sm:py-5"
      style={{ background: "#0a0e1a", border: "1px solid #C9A84C33" }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 text-center text-[52px] sm:text-6xl font-black leading-none tracking-tight"
          style={{ color: "#C9A84C" }}
        >
          Today&apos;s appointments
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setError(""); }}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-2xl font-bold transition-opacity hover:opacity-80"
          style={{ background: "#C9A84C22", border: "1px solid #C9A84C66", color: "#C9A84C" }}
        >
          +
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mt-4 p-4 rounded-xl flex flex-col gap-3" style={{ background: "#161b22", border: "1px solid #C9A84C33" }}>
          <input
            type="text"
            placeholder="Name · Project · Address · 11:00 AM · Phone · Email"
            value={apptText}
            onChange={e => setApptText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={apptDate}
              onChange={e => setApptDate(e.target.value)}
              className="bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }}
            />
            <button
              onClick={handleSave}
              disabled={saving || !apptText.trim()}
              className="flex-1 text-sm font-bold py-2 rounded-lg transition-opacity disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-sm px-3 py-2 rounded-lg"
              style={{ color: "#8b949e", border: "1px solid #30373f" }}
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        </div>
      )}

      {/* Appointment list */}
      {appointments.length === 0 && !showAdd ? (
        <p className="text-base text-center mt-3" style={{ color: "#484f58" }}>No appointments scheduled for today</p>
      ) : appointments.length > 0 ? (
        <div className="space-y-3 mt-4">
          {appointments.map(appt => {
            const raw = appt.text.replace(/^📅 Appointment\s*[–-]\s*/, "");
            const parts = raw.split(" · ");
            const name = parts[0] ?? "";
            const rest = parts.slice(1);
            return (
              <div
                key={appt.id}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: "#161b22", border: "1px solid #C9A84C22" }}
              >
                <span className="text-2xl shrink-0">📅</span>
                <div>
                  <div className="text-lg font-black leading-tight" style={{ color: "#e6edf3" }}>{name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {rest.map((p, i) => (
                      <span key={i} className="text-sm" style={{ color: "#8b949e" }}>{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
