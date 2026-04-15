"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Appointment = { id: string; text: string; dueDate: string | null };

type PipelineLead = {
  id: string;
  displayName: string;
  notes: string | null;
  source: string | null;
  lead: {
    name: string;
    email: string | null;
    phone: string | null;
    projectType: string | null;
    address?: string | null;
    city?: string | null;
  } | null;
};

type RawLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  projectType: string | null;
  address?: string | null;
  city?: string | null;
};

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

  // Step 1: pick lead
  const [showPicker, setShowPicker] = useState(false);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [search, setSearch] = useState("");

  // Step 2: compose appointment
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [apptTime, setApptTime] = useState("");
  const [apptDate, setApptDate] = useState(todayDateStr);
  const [apptText, setApptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function openPicker() {
    setShowPicker(true);
    setShowForm(false);
    setSearch("");
    setError("");
    setLoadingLeads(true);
    try {
      const [pipelineRes, rawLeadsRes] = await Promise.all([
        fetch(`/api/${companyId}/pipeline?type=sales`),
        fetch(`/api/${companyId}/leads`),
      ]);
      const pipelineCards: PipelineLead[] = await pipelineRes.json();
      const rawLeads: RawLead[] = await rawLeadsRes.json();
      // Convert raw leads (no pipeline card yet) to PipelineLead shape
      const rawAsCards: PipelineLead[] = rawLeads.map(l => ({
        id: `raw_${l.id}`,
        displayName: l.name,
        notes: null,
        source: null,
        lead: { name: l.name, email: l.email, phone: l.phone, projectType: l.projectType, address: l.address, city: l.city },
      }));
      setLeads([...pipelineCards, ...rawAsCards]);
    } catch { /* ignore */ }
    setLoadingLeads(false);
  }

  function selectLead(lead: PipelineLead) {
    setSelectedLead(lead);
    // Pre-compose appointment text from lead data
    const parts: string[] = [lead.displayName];
    if (lead.lead?.projectType) parts.push(lead.lead.projectType);
    if (lead.lead?.phone) parts.push(lead.lead.phone);
    if (lead.lead?.email) parts.push(lead.lead.email);
    setApptText(parts.join(" · "));
    setApptTime("");
    setApptDate(todayDateStr);
    setShowPicker(false);
    setShowForm(true);
  }

  function buildFinalText() {
    // Insert time after name (first part)
    const parts = apptText.split(" · ");
    const name = parts[0];
    const rest = parts.slice(1);
    const withTime = apptTime ? [name, apptTime, ...rest] : [name, ...rest];
    return withTime.join(" · ");
  }

  async function handleSave() {
    const final = buildFinalText();
    if (!final.trim()) return;
    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.append("category", "TASK");
    fd.append("text", `📅 Appointment – ${final.trim()}`);
    fd.append("dueDate", apptDate);
    try {
      const res = await fetch(`/api/${companyId}/follow-ups`, { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const item = await res.json();
      if (item.dueDate && item.dueDate.slice(0, 10) === todayDateStr) {
        setAppointments(prev => [...prev, { id: item.id, text: item.text, dueDate: item.dueDate }]);
      }
      setShowForm(false);
      setSelectedLead(null);
      setApptText("");
      router.refresh();
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  }

  function closeAll() {
    setShowPicker(false);
    setShowForm(false);
    setSelectedLead(null);
    setError("");
  }

  const filteredLeads = leads.filter(l =>
    l.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (l.lead?.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (l.lead?.phone ?? "").includes(search)
  );

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
          onClick={showPicker || showForm ? closeAll : openPicker}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-2xl font-bold transition-opacity hover:opacity-80"
          style={{ background: "#C9A84C22", border: "1px solid #C9A84C66", color: "#C9A84C" }}
        >
          {showPicker || showForm ? "×" : "+"}
        </button>
      </div>

      {/* Step 1 — Lead picker */}
      {showPicker && (
        <div className="mt-4 rounded-xl flex flex-col gap-2" style={{ background: "#161b22", border: "1px solid #C9A84C33" }}>
          <div className="p-3 pb-0">
            <input
              type="text"
              placeholder="Search by name, phone, or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }}
            />
          </div>
          <div className="overflow-y-auto px-3 pb-3" style={{ maxHeight: 300 }}>
            {loadingLeads && <p className="text-xs py-4 text-center" style={{ color: "#8b949e" }}>Loading leads…</p>}
            {!loadingLeads && filteredLeads.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: "#484f58" }}>No leads found</p>
            )}
            {filteredLeads.map(lead => (
              <button
                key={lead.id}
                onClick={() => selectLead(lead)}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-[#1e2736] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{lead.displayName}</div>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {lead.lead?.projectType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C" }}>{lead.lead.projectType}</span>
                    )}
                    {lead.lead?.phone && (
                      <span className="text-[10px]" style={{ color: "#8b949e" }}>{lead.lead.phone}</span>
                    )}
                    {lead.lead?.email && (
                      <span className="text-[10px] truncate max-w-[140px]" style={{ color: "#58a6ff" }}>{lead.lead.email}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] shrink-0" style={{ color: "#C9A84C" }}>Select →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Compose form */}
      {showForm && selectedLead && (
        <div className="mt-4 p-4 rounded-xl flex flex-col gap-3" style={{ background: "#161b22", border: "1px solid #C9A84C33" }}>
          <div className="text-xs font-semibold" style={{ color: "#C9A84C" }}>
            Appointment for <span style={{ color: "#e6edf3" }}>{selectedLead.displayName}</span>
          </div>

          {/* Time + Date row */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Time (e.g. 11:00 AM)"
              value={apptTime}
              onChange={e => setApptTime(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }}
            />
            <input
              type="date"
              value={apptDate}
              onChange={e => setApptDate(e.target.value)}
              className="bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }}
            />
          </div>

          {/* Editable text */}
          <input
            type="text"
            value={apptText}
            onChange={e => setApptText(e.target.value)}
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: "1px solid #30373f", color: "#8b949e" }}
            placeholder="Name · Project · Phone · Email"
          />
          <p className="text-[10px] -mt-1" style={{ color: "#484f58" }}>Edit details above if needed</p>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !apptText.trim()}
              className="flex-1 text-sm font-bold py-2 rounded-lg transition-opacity disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              {saving ? "Saving…" : "Save appointment"}
            </button>
            <button
              onClick={() => { setShowForm(false); setShowPicker(true); }}
              className="text-sm px-3 py-2 rounded-lg"
              style={{ color: "#8b949e", border: "1px solid #30373f" }}
            >
              ← Back
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        </div>
      )}

      {/* Appointment list */}
      {appointments.length === 0 && !showPicker && !showForm ? (
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
