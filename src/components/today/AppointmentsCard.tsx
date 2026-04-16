"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type Appointment = { id: string; text: string; dueDate: string | null };
type Note = { id: string; content: string; noteDate: string; createdAt: string };

type PipelineLead = {
  id: string;
  displayName: string;
  notes: string | null;
  source: string | null;
  lead: {
    id?: string;
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

// ── Parse the stored appointment text ──────────────────────────────────────────
// Format line 1: "📅 Appointment – Name · Time · Phone · Address"
// Line 2+: notes
function parseAppt(text: string) {
  const clean = text.replace(/^📅 Appointment\s*[–-]\s*/, "");
  const newlineIdx = clean.indexOf("\n");
  const mainLine = newlineIdx >= 0 ? clean.slice(0, newlineIdx) : clean;
  const notes = newlineIdx >= 0 ? clean.slice(newlineIdx + 1).trim() : "";
  const parts = mainLine.split(" · ");
  return {
    name: parts[0]?.trim() ?? "",
    time: parts[1]?.trim() ?? "",
    phone: parts[2]?.trim() ?? "",
    address: parts[3]?.trim() ?? "",
    notes,
  };
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── Time helpers ────────────────────────────────────────────────────────────────
function parseTime(timeStr: string): { hour: string; min: string; ampm: "AM" | "PM" } {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) return { hour: match[1].padStart(2, "0"), min: match[2], ampm: match[3].toUpperCase() as "AM" | "PM" };
  const match2 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match2) return { hour: match2[1].padStart(2, "0"), min: match2[2], ampm: "AM" };
  return { hour: "", min: "", ampm: "AM" };
}

function buildTimeStr(hour: string, min: string, ampm: string) {
  if (!hour) return "";
  return `${hour}:${min || "00"} ${ampm}`;
}

// ── Structured time input component ────────────────────────────────────────────
function TimeInput({
  hour, min, ampm,
  onHour, onMin, onAmPm,
}: {
  hour: string; min: string; ampm: "AM" | "PM";
  onHour: (v: string) => void; onMin: (v: string) => void; onAmPm: (v: "AM" | "PM") => void;
}) {
  const minRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1 px-2 py-2 rounded-lg" style={{ border: "1px solid #30373f", background: "transparent" }}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="12"
        maxLength={2}
        value={hour}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 2);
          onHour(v);
          if (v.length === 2) minRef.current?.focus();
        }}
        className="w-8 bg-transparent text-sm outline-none text-center"
        style={{ color: "#e6edf3" }}
      />
      <span style={{ color: "#8b949e", fontWeight: "bold" }}>:</span>
      <input
        ref={minRef}
        type="text"
        inputMode="numeric"
        placeholder="00"
        maxLength={2}
        value={min}
        onChange={e => onMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
        className="w-8 bg-transparent text-sm outline-none text-center"
        style={{ color: "#e6edf3" }}
      />
      <button
        type="button"
        onClick={() => onAmPm(ampm === "AM" ? "PM" : "AM")}
        className="ml-1 px-2 py-0.5 rounded text-xs font-bold transition-colors"
        style={{ background: "#C9A84C33", color: "#C9A84C", border: "1px solid #C9A84C55" }}
      >
        {ampm}
      </button>
    </div>
  );
}

export default function AppointmentsCard({
  companyId,
  initialAppointments,
  initialUpcoming,
  todayDateStr,
}: {
  companyId: string;
  initialAppointments: Appointment[];
  initialUpcoming: Appointment[];
  todayDateStr: string;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [upcoming, setUpcoming] = useState(initialUpcoming);

  // ── Add appointment flow ────────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [apptHour, setApptHour] = useState("");
  const [apptMin, setApptMin] = useState("");
  const [apptAmPm, setApptAmPm] = useState<"AM" | "PM">("AM");
  const [apptDate, setApptDate] = useState(todayDateStr);
  const [apptAddress, setApptAddress] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Edit appointment modal ──────────────────────────────────────────────────
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editHour, setEditHour] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editAmPm, setEditAmPm] = useState<"AM" | "PM">("AM");
  const [editDate, setEditDate] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(appt: Appointment) {
    const { time, address, notes } = parseAppt(appt.text);
    const { hour, min, ampm } = parseTime(time);
    setEditingAppt(appt);
    setEditHour(hour);
    setEditMin(min);
    setEditAmPm(ampm);
    setEditDate(appt.dueDate ? appt.dueDate.slice(0, 10) : todayDateStr);
    setEditAddress(address);
    setEditNotes(notes);
  }

  async function saveEdit() {
    if (!editingAppt) return;
    const { name } = parseAppt(editingAppt.text);
    const timeStr = buildTimeStr(editHour, editMin, editAmPm);
    const mainLine = [name, timeStr, "", editAddress]
      .map(s => s.trim())
      .filter(Boolean)
      .join(" · ");
    const newText = `📅 Appointment – ${mainLine}${editNotes.trim() ? `\n${editNotes.trim()}` : ""}`;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/follow-ups/${editingAppt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText, dueDate: editDate }),
      });
      if (res.ok) {
        const updated = await res.json();
        const updatedAppt = { id: updated.id, text: updated.text, dueDate: updated.dueDate };
        setAppointments(prev => prev.map(a => a.id === editingAppt.id ? updatedAppt : a));
        setUpcoming(prev => prev.map(a => a.id === editingAppt.id ? updatedAppt : a));
        setEditingAppt(null);
        router.refresh();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteAppt(apptId: string) {
    await fetch(`/api/${companyId}/follow-ups/${apptId}`, { method: "DELETE" });
    setAppointments(prev => prev.filter(a => a.id !== apptId));
    setUpcoming(prev => prev.filter(a => a.id !== apptId));
    router.refresh();
  }

  // ── Upcoming section toggle ─────────────────────────────────────────────────
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // ── Lead popup ──────────────────────────────────────────────────────────────
  const [popupAppt, setPopupAppt] = useState<Appointment | null>(null);
  const [popupLead, setPopupLead] = useState<PipelineLead | null>(null);
  const [popupLeadId, setPopupLeadId] = useState<string | null>(null);
  const [popupNotes, setPopupNotes] = useState<Note[]>([]);
  const [popupLoading, setPopupLoading] = useState(false);

  // Popup edit state
  const [popupEditing, setPopupEditing] = useState(false);
  const [popupPhone, setPopupPhone] = useState("");
  const [popupNewNote, setPopupNewNote] = useState("");
  const [popupSaving, setPopupSaving] = useState(false);

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
      const rawAsCards: PipelineLead[] = rawLeads.map(l => ({
        id: `raw_${l.id}`,
        displayName: l.name,
        notes: null,
        source: null,
        lead: { id: l.id, name: l.name, email: l.email, phone: l.phone, projectType: l.projectType, address: l.address, city: l.city },
      }));
      setLeads([...pipelineCards, ...rawAsCards]);
    } catch { /* ignore */ }
    setLoadingLeads(false);
  }

  function selectLead(lead: PipelineLead) {
    setSelectedLead(lead);
    setApptAddress(lead.lead?.address ?? "");
    setApptHour("");
    setApptMin("");
    setApptAmPm("AM");
    setApptDate(todayDateStr);
    setApptNotes("");
    setShowPicker(false);
    setShowForm(true);
  }

  async function handleSave() {
    if (!selectedLead) return;
    const namePart = selectedLead.displayName;
    const timeStr = buildTimeStr(apptHour, apptMin, apptAmPm);
    const mainLine = [namePart, timeStr, selectedLead.lead?.phone ?? "", apptAddress]
      .map(s => s.trim())
      .filter(Boolean)
      .join(" · ");
    const fullText = `📅 Appointment – ${mainLine}${apptNotes.trim() ? `\n${apptNotes.trim()}` : ""}`;

    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.append("category", "TASK");
    fd.append("text", fullText);
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

  const openLeadPopup = useCallback(async (appt: Appointment) => {
    const { name } = parseAppt(appt.text);
    if (!name) return;
    setPopupAppt(appt);
    setPopupLoading(true);
    setPopupLead(null);
    setPopupLeadId(null);
    setPopupNotes([]);
    setPopupEditing(false);
    setPopupPhone("");
    setPopupNewNote("");
    try {
      const [pipelineRes, rawLeadsRes] = await Promise.all([
        fetch(`/api/${companyId}/pipeline?type=sales`),
        fetch(`/api/${companyId}/leads`),
      ]);
      const cards: PipelineLead[] = await pipelineRes.json();
      const rawLeads: RawLead[] = await rawLeadsRes.json();
      const nameLower = name.toLowerCase();

      const card = cards.find(c =>
        c.displayName.toLowerCase().includes(nameLower) ||
        (c.lead?.name ?? "").toLowerCase().includes(nameLower)
      );
      const rawMatch = rawLeads.find(l => (l.name ?? "").toLowerCase().includes(nameLower));

      let found: PipelineLead | null = null;
      let leadId: string | null = null;

      if (card) {
        found = card;
        leadId = card.lead?.id ?? null;
      } else if (rawMatch) {
        found = { id: `raw_${rawMatch.id}`, displayName: rawMatch.name, notes: null, source: null, lead: { ...rawMatch } };
        leadId = rawMatch.id;
      }

      setPopupLead(found);
      setPopupLeadId(leadId);
      setPopupPhone(found?.lead?.phone ?? "");

      if (leadId) {
        const notesRes = await fetch(`/api/${companyId}/notes?leadId=${leadId}`);
        if (notesRes.ok) setPopupNotes(await notesRes.json());
      }
    } catch { /* ignore */ }
    setPopupLoading(false);
  }, [companyId]);

  async function savePopupEdits() {
    if (!popupLeadId) return;
    setPopupSaving(true);
    try {
      // Update phone on lead record
      await fetch(`/api/${companyId}/leads/${popupLeadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: popupPhone }),
      });
      // Add new note if provided
      if (popupNewNote.trim()) {
        const res = await fetch(`/api/${companyId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: popupLeadId, content: popupNewNote.trim() }),
        });
        if (res.ok) {
          const newNote = await res.json();
          setPopupNotes(prev => [newNote, ...prev]);
          setPopupNewNote("");
        }
      }
      // Update local popup lead state
      setPopupLead(prev => prev ? { ...prev, lead: prev.lead ? { ...prev.lead, phone: popupPhone } : prev.lead } : prev);
      setPopupEditing(false);
    } finally {
      setPopupSaving(false);
    }
  }

  function closePopup() {
    setPopupAppt(null);
    setPopupLead(null);
    setPopupLeadId(null);
    setPopupNotes([]);
    setPopupEditing(false);
  }

  // Group upcoming by date string
  const upcomingByDate: Record<string, Appointment[]> = {};
  for (const a of upcoming) {
    const key = a.dueDate ? a.dueDate.slice(0, 10) : "no-date";
    if (!upcomingByDate[key]) upcomingByDate[key] = [];
    upcomingByDate[key].push(a);
  }
  const upcomingDates = Object.keys(upcomingByDate).sort();

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
      {/* Header */}
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
                    {lead.lead?.phone && <span className="text-[10px]" style={{ color: "#8b949e" }}>{lead.lead.phone}</span>}
                    {lead.lead?.address && <span className="text-[10px] truncate max-w-[180px]" style={{ color: "#484f58" }}>{lead.lead.address}</span>}
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
          <div className="flex gap-2 flex-wrap">
            <TimeInput
              hour={apptHour} min={apptMin} ampm={apptAmPm}
              onHour={setApptHour} onMin={setApptMin} onAmPm={setApptAmPm}
            />
            <input
              type="date"
              value={apptDate}
              onChange={e => setApptDate(e.target.value)}
              className="bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }}
            />
          </div>
          <input
            type="text"
            placeholder="Address (optional)"
            value={apptAddress}
            onChange={e => setApptAddress(e.target.value)}
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }}
          />
          <textarea
            rows={3}
            placeholder="Notes (optional)…"
            value={apptNotes}
            onChange={e => setApptNotes(e.target.value)}
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
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

      {/* Today's appointment list */}
      {appointments.length === 0 && !showPicker && !showForm ? (
        <p className="text-base text-center mt-3" style={{ color: "#484f58" }}>No appointments scheduled for today</p>
      ) : appointments.length > 0 ? (
        <div className="space-y-3 mt-4">
          {appointments.map(appt => {
            const { name, time, phone, address, notes } = parseAppt(appt.text);
            return (
              <div
                key={appt.id}
                className="rounded-xl"
                style={{ background: "#161b22", border: "1px solid #C9A84C22" }}
              >
                <div className="flex flex-col p-4 gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                      <span className="text-base font-black leading-tight" style={{ color: "#e6edf3" }}>{name}</span>
                      {time && <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>{time}</span>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(appt)}
                        className="rounded-md px-3 py-1 text-xs font-bold"
                        style={{ background: "#C9A84C", color: "#0d1117", cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => deleteAppt(appt.id)}
                        className="rounded-md px-2 py-1 text-xs font-bold"
                        style={{ background: "#ef4444", color: "#fff", cursor: "pointer" }}>
                        ×
                      </button>
                    </div>
                  </div>
                  <button onClick={() => openLeadPopup(appt)} className="text-left w-full">
                    {(phone || address) && (
                      <div className="flex gap-3 flex-wrap">
                        {phone && <span className="text-xs" style={{ color: "#8b949e" }}>📞 {phone}</span>}
                        {address && <span className="text-xs" style={{ color: "#8b949e" }}>📍 {address}</span>}
                      </div>
                    )}
                    {notes && <p className="text-xs mt-0.5" style={{ color: "#8b949e", whiteSpace: "pre-wrap" }}>{notes}</p>}
                    {!phone && !address && !notes && (
                      <span className="text-xs" style={{ color: "#484f58" }}>Tap for lead details</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Upcoming appointments section */}
      {upcoming.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowUpcoming(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: "#161b2288", border: "1px solid #C9A84C22" }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>
              Upcoming appointments ({upcoming.length})
            </span>
            <span style={{ color: "#C9A84C", fontSize: 14 }}>{showUpcoming ? "▲" : "▼"}</span>
          </button>

          {showUpcoming && (
            <div className="mt-2 space-y-2">
              {upcomingDates.map(dateKey => {
                const appts = upcomingByDate[dateKey];
                const isOpen = expandedDates.has(dateKey);
                const label = dateKey !== "no-date"
                  ? new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
                  : "No date";
                return (
                  <div key={dateKey} className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
                    <button
                      onClick={() => setExpandedDates(prev => {
                        const next = new Set(prev);
                        if (isOpen) { next.delete(dateKey); } else { next.add(dateKey); }
                        return next;
                      })}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[#1e2736]"
                      style={{ background: "#161b22" }}
                    >
                      <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C" }}>{appts.length}</span>
                        <span style={{ color: "#484f58", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: "1px solid #30373f" }}>
                        {appts.map(appt => {
                          const { name, time, address, notes } = parseAppt(appt.text);
                          return (
                            <div key={appt.id} style={{ background: "#0d1117", borderBottom: "1px solid #1e2736" }}>
                              <div className="flex flex-col px-4 py-3 gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                                    <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{name}</span>
                                    {time && <span className="text-xs font-semibold" style={{ color: "#C9A84C" }}>{time}</span>}
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={() => openEdit(appt)}
                                      className="rounded-md px-3 py-1 text-xs font-bold"
                                      style={{ background: "#C9A84C", color: "#0d1117", cursor: "pointer" }}>
                                      Edit
                                    </button>
                                    <button onClick={() => deleteAppt(appt.id)}
                                      className="rounded-md px-2 py-1 text-xs font-bold"
                                      style={{ background: "#ef4444", color: "#fff", cursor: "pointer" }}>
                                      ×
                                    </button>
                                  </div>
                                </div>
                                <button onClick={() => openLeadPopup(appt)} className="text-left">
                                  {address && <div className="text-xs" style={{ color: "#8b949e" }}>📍 {address}</div>}
                                  {notes && <div className="text-xs line-clamp-1" style={{ color: "#484f58" }}>{notes}</div>}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit appointment modal */}
      {editingAppt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => setEditingAppt(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "#161b22", border: "1px solid #C9A84C66" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                Edit: {parseAppt(editingAppt.text).name}
              </span>
              <button onClick={() => setEditingAppt(null)} style={{ color: "#8b949e", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <TimeInput
                hour={editHour} min={editMin} ampm={editAmPm}
                onHour={setEditHour} onMin={setEditMin} onAmPm={setEditAmPm}
              />
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                className="bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
                style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <input type="text" placeholder="Address (optional)" value={editAddress} onChange={e => setEditAddress(e.target.value)}
              className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
            <textarea rows={3} placeholder="Notes (optional)…" value={editNotes} onChange={e => setEditNotes(e.target.value)}
              className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none resize-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 text-sm font-bold py-2 rounded-lg disabled:opacity-50"
                style={{ background: "#C9A84C", color: "#0d1117" }}>
                {editSaving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditingAppt(null)}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ color: "#8b949e", border: "1px solid #30373f" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead popup modal */}
      {(popupLoading || popupAppt) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={closePopup}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-4 overflow-y-auto"
            style={{ background: "#161b22", border: "1px solid #C9A84C44", maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Appointment info header */}
            {popupAppt && (() => {
              const { name, time, address, notes } = parseAppt(popupAppt.text);
              return (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>{name}</h2>
                    <button onClick={closePopup} style={{ color: "#8b949e", fontSize: 20, lineHeight: 1 }}>×</button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm" style={{ color: "#8b949e" }}>
                    {popupAppt.dueDate && (
                      <span style={{ color: "#C9A84C" }}>📅 {formatDueDate(popupAppt.dueDate)}</span>
                    )}
                    {time && <span style={{ color: "#C9A84C" }}>⏰ {time}</span>}
                    {address && <span>📍 {address}</span>}
                  </div>
                  {notes && (
                    <p className="text-xs mt-2 p-2 rounded-lg" style={{ color: "#e6edf3", background: "#0d1117", whiteSpace: "pre-wrap" }}>{notes}</p>
                  )}
                </div>
              );
            })()}

            {popupLoading && <p className="text-sm text-center py-4" style={{ color: "#484f58" }}>Loading lead…</p>}

            {!popupLoading && popupLead && (
              <>
                <div style={{ borderTop: "1px solid #30373f", paddingTop: 12 }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#484f58" }}>Lead Info</p>
                    {!popupEditing && (
                      <button
                        onClick={() => setPopupEditing(true)}
                        className="text-[10px] px-2 py-0.5 rounded font-bold"
                        style={{ background: "#C9A84C", color: "#0d1117" }}
                      >
                        Edit lead
                      </button>
                    )}
                  </div>

                  {popupEditing ? (
                    <div className="flex flex-col gap-2">
                      <div className="space-y-1 text-sm mb-1" style={{ color: "#8b949e" }}>
                        {popupLead.lead?.projectType && <div><span style={{ color: "#C9A84C" }}>Project:</span> {popupLead.lead.projectType}</div>}
                        {popupLead.lead?.email && <div><span style={{ color: "#C9A84C" }}>Email:</span> {popupLead.lead.email}</div>}
                        {popupLead.lead?.address && <div><span style={{ color: "#C9A84C" }}>Address:</span> {popupLead.lead.address}{popupLead.lead.city ? `, ${popupLead.lead.city}` : ""}</div>}
                        {popupLead.source && <div><span style={{ color: "#C9A84C" }}>Source:</span> {popupLead.source}</div>}
                      </div>
                      <label className="text-[10px] font-semibold" style={{ color: "#8b949e" }}>Phone</label>
                      <input
                        type="tel"
                        value={popupPhone}
                        onChange={e => setPopupPhone(e.target.value)}
                        placeholder="Phone number"
                        autoFocus
                        className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
                        style={{ border: "1px solid #30373f", color: "#e6edf3" }}
                      />
                      <label className="text-[10px] font-semibold mt-1" style={{ color: "#8b949e" }}>Add a note</label>
                      <textarea
                        rows={3}
                        value={popupNewNote}
                        onChange={e => setPopupNewNote(e.target.value)}
                        placeholder="Type a note…"
                        className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none resize-none"
                        style={{ border: "1px solid #30373f", color: "#e6edf3" }}
                      />
                      <div className="flex gap-2">
                        <button onClick={savePopupEdits} disabled={popupSaving}
                          className="flex-1 text-sm font-bold py-2 rounded-lg disabled:opacity-50"
                          style={{ background: "#C9A84C", color: "#0d1117" }}>
                          {popupSaving ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setPopupEditing(false)}
                          className="text-sm px-4 py-2 rounded-lg"
                          style={{ color: "#8b949e", border: "1px solid #30373f" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm" style={{ color: "#8b949e" }}>
                      {popupLead.lead?.projectType && <div><span style={{ color: "#C9A84C" }}>Project:</span> {popupLead.lead.projectType}</div>}
                      {popupLead.lead?.phone && <div><span style={{ color: "#C9A84C" }}>Phone:</span> {popupLead.lead.phone}</div>}
                      {!popupLead.lead?.phone && <div className="text-xs italic" style={{ color: "#484f58" }}>No phone — tap Edit lead to add</div>}
                      {popupLead.lead?.email && <div><span style={{ color: "#C9A84C" }}>Email:</span> {popupLead.lead.email}</div>}
                      {popupLead.lead?.address && <div><span style={{ color: "#C9A84C" }}>Address:</span> {popupLead.lead.address}{popupLead.lead.city ? `, ${popupLead.lead.city}` : ""}</div>}
                      {popupLead.source && <div><span style={{ color: "#C9A84C" }}>Source:</span> {popupLead.source}</div>}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid #30373f", paddingTop: 12 }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#484f58" }}>Notes</p>
                  {popupNotes.length === 0 ? (
                    <p className="text-xs italic" style={{ color: "#484f58" }}>No notes yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {popupNotes.map(n => (
                        <div key={n.id} style={{ borderLeft: "2px solid #C9A84C44", paddingLeft: 10 }}>
                          <div className="text-[10px] font-semibold mb-0.5" style={{ color: "#C9A84C" }}>
                            {new Date(n.noteDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <p className="text-xs" style={{ color: "#e6edf3", whiteSpace: "pre-wrap" }}>{n.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!popupLoading && !popupLead && (
              <p className="text-xs italic" style={{ color: "#484f58" }}>No matching lead found in pipeline</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
