"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectTypeSelector } from "@/components/leads/ProjectTypeSelector";

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
    state?: string | null;
    zip?: string | null;
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
  state?: string | null;
  zip?: string | null;
};

function parseAppt(text: string) {
  const clean = text.replace(/^📅 Appointment\s*[–-]\s*/, "");
  const newlineIdx = clean.indexOf("\n");
  const mainLine = newlineIdx >= 0 ? clean.slice(0, newlineIdx) : clean;
  const notes = newlineIdx >= 0 ? clean.slice(newlineIdx + 1).trim() : "";
  const parts = mainLine.split(" · ");

  const name = parts[0]?.trim() ?? "";
  const time = parts[1]?.trim() ?? "";
  let phone = "", address = "";

  if (parts.length >= 4) {
    // Full format: Name · Time · Phone · Address
    phone = parts[2]?.trim() ?? "";
    address = parts.slice(3).join(" · ").trim();
  } else if (parts.length === 3) {
    // Either Name · Time · Phone  OR  Name · Time · Address
    // If it's all digits/spaces/dashes/parens it's a phone; otherwise it's an address
    const p2 = parts[2]?.trim() ?? "";
    if (/^[\d\s\-()+.]{7,}$/.test(p2)) {
      phone = p2;
    } else {
      address = p2;
    }
  }

  return { name, time, phone, address, notes };
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function parseTime(str: string): { h: string; m: string; ap: "AM" | "PM" } {
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) return { h: match[1].padStart(2, "0"), m: match[2], ap: match[3].toUpperCase() as "AM" | "PM" };
  return { h: "", m: "", ap: "AM" };
}

function buildTime(h: string, m: string, ap: string) {
  if (!h) return "";
  return `${h}:${m || "00"} ${ap}`;
}

export default function AppointmentsCard({
  companyId,
  initialAppointments,
  initialUpcoming,
  initialPast,
  todayDateStr,
}: {
  companyId: string;
  initialAppointments: Appointment[];
  initialUpcoming: Appointment[];
  initialPast?: Appointment[];
  todayDateStr: string;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [past] = useState(initialPast ?? []);
  const [showPast, setShowPast] = useState(false);

  // Lead info map: lowercase name → { phone, address } for showing on cards
  const [leadMap, setLeadMap] = useState<Map<string, { phone: string; address: string }>>(new Map());

  useEffect(() => {
    async function loadLeads() {
      try {
        const [pr, lr] = await Promise.all([
          fetch(`/api/${companyId}/pipeline?type=sales`),
          fetch(`/api/${companyId}/leads`),
        ]);
        const cards: PipelineLead[] = await pr.json();
        const raws: RawLead[] = await lr.json();
        const map = new Map<string, { phone: string; address: string }>();
        for (const c of cards) {
          const p = c.lead?.phone ?? "";
          const a = c.lead?.address ?? "";
          map.set(c.displayName.toLowerCase(), { phone: p, address: a });
          if (c.lead?.name) map.set(c.lead.name.toLowerCase(), { phone: p, address: a });
        }
        for (const r of raws) {
          map.set(r.name.toLowerCase(), { phone: r.phone ?? "", address: r.address ?? "" });
        }
        setLeadMap(map);
      } catch { /**/ }
    }
    loadLeads();
  }, [companyId]);

  // ── Add flow ────────────────────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);

  // Add form time
  const [addH, setAddH] = useState("");
  const [addM, setAddM] = useState("");
  const [addAp, setAddAp] = useState<"AM" | "PM">("AM");
  const [addDate, setAddDate] = useState(todayDateStr);
  const [addAddress, setAddAddress] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Edit appointment modal ──────────────────────────────────────────────────
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editH, setEditH] = useState("");
  const [editM, setEditM] = useState("");
  const [editAp, setEditAp] = useState<"AM" | "PM">("AM");
  const [editDate, setEditDate] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(appt: Appointment) {
    const { time, address, notes } = parseAppt(appt.text);
    const { h, m, ap } = parseTime(time);
    setEditingAppt(appt);
    setEditH(h); setEditM(m); setEditAp(ap);
    setEditDate(appt.dueDate ? appt.dueDate.slice(0, 10) : todayDateStr);
    setEditAddress(address);
    setEditNotes(notes);
  }

  async function saveEdit() {
    if (!editingAppt) return;
    const { name } = parseAppt(editingAppt.text);
    const timeStr = buildTime(editH, editM, editAp);
    const mainLine = [name, timeStr, "", editAddress].map(s => s.trim()).filter(Boolean).join(" · ");
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
        const a = { id: updated.id, text: updated.text, dueDate: updated.dueDate };
        setAppointments(prev => prev.map(x => x.id === editingAppt.id ? a : x));
        setUpcoming(prev => prev.map(x => x.id === editingAppt.id ? a : x));
        setEditingAppt(null);
        router.refresh();
      }
    } finally { setEditSaving(false); }
  }

  async function deleteAppt(id: string) {
    await fetch(`/api/${companyId}/follow-ups/${id}`, { method: "DELETE" });
    setAppointments(prev => prev.filter(a => a.id !== id));
    setUpcoming(prev => prev.filter(a => a.id !== id));
    router.refresh();
  }

  // ── Upcoming section ────────────────────────────────────────────────────────
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // ── Lead popup ──────────────────────────────────────────────────────────────
  const [popupAppt, setPopupAppt] = useState<Appointment | null>(null);
  const [popupLead, setPopupLead] = useState<PipelineLead | null>(null);
  const [popupLeadId, setPopupLeadId] = useState<string | null>(null);
  const [popupNotes, setPopupNotes] = useState<Note[]>([]);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupEditing, setPopupEditing] = useState(false);
  const [popupNewNote, setPopupNewNote] = useState("");
  const [popupSaving, setPopupSaving] = useState(false);

  type FullLeadForm = { name: string; email: string; phone: string; address: string; city: string; state: string; zip: string; projectType: string; message: string };
  const [popupEditForm, setPopupEditForm] = useState<FullLeadForm>({ name: "", email: "", phone: "", address: "", city: "", state: "FL", zip: "", projectType: "", message: "" });
  const [popupFormLoading, setPopupFormLoading] = useState(false);
  const [popupSaveError, setPopupSaveError] = useState("");

  async function openPicker() {
    setShowPicker(true); setShowForm(false); setShowNewContact(false); setSearch(""); setError("");
    setLoadingLeads(true);
    try {
      const [pr, lr, cr] = await Promise.all([
        fetch(`/api/${companyId}/pipeline?type=sales`),
        fetch(`/api/${companyId}/leads`),
        fetch(`/api/${companyId}/clients?status=PROSPECT,PIPELINE,ACTIVE`),
      ]);
      const cards: PipelineLead[] = await pr.json();
      const raws: RawLead[] = await lr.json();
      const clients: { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; status: string }[] = cr.ok ? await cr.json() : [];
      const rawCards: PipelineLead[] = raws.map(l => ({
        id: `raw_${l.id}`, displayName: l.name, notes: null, source: null,
        lead: { id: l.id, name: l.name, email: l.email, phone: l.phone, projectType: l.projectType, address: l.address, city: l.city },
      }));
      const clientCards: PipelineLead[] = clients.map(c => ({
        id: `client_${c.id}`,
        displayName: c.name,
        notes: null,
        source: c.status, // PROSPECT / PIPELINE / ACTIVE
        lead: { id: c.id, name: c.name, email: c.email, phone: c.phone, projectType: null, address: c.address, city: c.city },
      }));
      setLeads([...cards, ...rawCards, ...clientCards]);
    } catch { /**/ }
    setLoadingLeads(false);
  }

  // ── New contact inline form ──────────────────────────────────────────────────
  const [showNewContact, setShowNewContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState("");

  function openNewContact() {
    setShowPicker(false); setShowNewContact(true);
    setNewName(search); // preserve whatever they typed in the search box
    setNewPhone(""); setNewEmail(""); setNewError("");
  }

  async function saveNewContact() {
    const name = newName.trim();
    if (!name) { setNewError("Name required"); return; }
    setNewSaving(true); setNewError("");
    try {
      const res = await fetch(`/api/${companyId}/clients`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: newPhone.trim() || undefined, email: newEmail.trim() || undefined, status: "PROSPECT" }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to save");
      }
      const c = await res.json() as { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null; status: string };
      // Build PipelineLead-shaped wrapper and continue to appointment form
      const wrapped: PipelineLead = {
        id: `client_${c.id}`,
        displayName: c.name,
        notes: null,
        source: c.status,
        lead: { id: c.id, name: c.name, email: c.email, phone: c.phone, projectType: null, address: c.address, city: c.city },
      };
      setLeads(prev => [wrapped, ...prev]);
      setShowNewContact(false);
      selectLead(wrapped);
    } catch (e) {
      setNewError(String(e));
    } finally {
      setNewSaving(false);
    }
  }

  function selectLead(lead: PipelineLead) {
    setSelectedLead(lead);
    setAddAddress(lead.lead?.address ?? "");
    setAddH(""); setAddM(""); setAddAp("AM");
    setAddDate(todayDateStr); setAddNotes("");
    setShowPicker(false); setShowForm(true);
  }

  async function handleSave() {
    if (!selectedLead) return;
    const timeStr = buildTime(addH, addM, addAp);
    const mainLine = [selectedLead.displayName, timeStr, selectedLead.lead?.phone ?? "", addAddress]
      .map(s => s.trim()).filter(Boolean).join(" · ");
    const fullText = `📅 Appointment – ${mainLine}${addNotes.trim() ? `\n${addNotes.trim()}` : ""}`;
    setSaving(true); setError("");
    const fd = new FormData();
    fd.append("category", "TASK"); fd.append("text", fullText); fd.append("dueDate", addDate);
    try {
      const res = await fetch(`/api/${companyId}/follow-ups`, { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      const item = await res.json();
      if (item.dueDate && item.dueDate.slice(0, 10) === todayDateStr) {
        setAppointments(prev => [...prev, { id: item.id, text: item.text, dueDate: item.dueDate }]);
      }
      setShowForm(false); setSelectedLead(null); router.refresh();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  }

  const openLeadPopup = useCallback(async (appt: Appointment) => {
    const { name } = parseAppt(appt.text);
    setPopupAppt(appt); setPopupLoading(true);
    setPopupLead(null); setPopupLeadId(null); setPopupNotes([]);
    setPopupEditing(false); setPopupNewNote("");
    try {
      const [pr, lr] = await Promise.all([
        fetch(`/api/${companyId}/pipeline?type=sales`),
        fetch(`/api/${companyId}/leads`),
      ]);
      const cards: PipelineLead[] = await pr.json();
      const raws: RawLead[] = await lr.json();
      const nl = name.toLowerCase();

      const card = cards.find(c =>
        c.displayName.toLowerCase().includes(nl) || nl.includes(c.displayName.toLowerCase()) ||
        (c.lead?.name ?? "").toLowerCase().includes(nl)
      );
      const raw = raws.find(l => (l.name ?? "").toLowerCase().includes(nl) || nl.includes((l.name ?? "").toLowerCase()));

      let found: PipelineLead | null = null;
      let leadId: string | null = null;
      if (card) {
        found = card; leadId = card.lead?.id ?? null;
      } else if (raw) {
        found = { id: `raw_${raw.id}`, displayName: raw.name, notes: null, source: null, lead: { ...raw } };
        leadId = raw.id;
      }
      setPopupLead(found); setPopupLeadId(leadId);
      if (leadId) {
        const nr = await fetch(`/api/${companyId}/notes?leadId=${leadId}`);
        if (nr.ok) setPopupNotes(await nr.json());
      }
    } catch { /**/ }
    setPopupLoading(false);
  }, [companyId]);

  async function openPopupEdit() {
    setPopupEditing(true);
    setPopupFormLoading(true);
    const blank: FullLeadForm = { name: "", email: "", phone: "", address: "", city: "", state: "FL", zip: "", projectType: "", message: "" };
    if (popupLeadId) {
      try {
        const res = await fetch(`/api/${companyId}/leads/${popupLeadId}`);
        if (res.ok) {
          const d = await res.json();
          setPopupEditForm({ name: d.name ?? "", email: d.email ?? "", phone: d.phone ?? "", address: d.address ?? "", city: d.city ?? "", state: d.state ?? "FL", zip: d.zip ?? "", projectType: d.projectType ?? "", message: d.message ?? "" });
        } else { setPopupEditForm(blank); }
      } catch { setPopupEditForm(blank); }
    } else {
      setPopupEditForm({ ...blank, name: popupLead?.displayName ?? "", email: popupLead?.lead?.email ?? "", phone: popupLead?.lead?.phone ?? "", address: popupLead?.lead?.address ?? "", city: popupLead?.lead?.city ?? "", projectType: popupLead?.lead?.projectType ?? "" });
    }
    setPopupFormLoading(false);
  }

  async function savePopupEdits() {
    if (!popupLeadId) return;
    setPopupSaving(true);
    setPopupSaveError("");
    try {
      await fetch(`/api/${companyId}/leads/${popupLeadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(popupEditForm),
      });

      // Save new note if provided
      if (popupNewNote.trim()) {
        const res = await fetch(`/api/${companyId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: popupLeadId, content: popupNewNote.trim() }),
        });
        if (res.ok) {
          const n = await res.json();
          setPopupNotes(prev => [n, ...prev]);
          setPopupNewNote("");
        }
      }

      // Patch appointment text if phone changed so it shows on the card
      if (popupAppt) {
        const { name, time, phone: currentPhone, address: currentAddr, notes: apptNotes } = parseAppt(popupAppt.text);
        const newPhone = popupEditForm.phone.trim();
        if (newPhone !== currentPhone.trim()) {
          const newMain = [name, time, newPhone, currentAddr].map(s => s.trim()).filter(Boolean).join(" · ");
          const newText = `📅 Appointment – ${newMain}${apptNotes ? `\n${apptNotes}` : ""}`;
          const pr = await fetch(`/api/${companyId}/follow-ups/${popupAppt.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: newText }),
          });
          if (pr.ok) {
            const updated = await pr.json();
            const a: Appointment = { id: updated.id, text: updated.text, dueDate: updated.dueDate };
            setAppointments(prev => prev.map(x => x.id === popupAppt.id ? a : x));
            setUpcoming(prev => prev.map(x => x.id === popupAppt.id ? a : x));
            setPopupAppt(a);
          }
        }
      }

      setPopupLead(prev => prev ? {
        ...prev,
        displayName: popupEditForm.name || prev.displayName,
        lead: prev.lead ? { ...prev.lead, name: popupEditForm.name || prev.lead.name, email: popupEditForm.email || null, phone: popupEditForm.phone || null, address: popupEditForm.address || null, city: popupEditForm.city || null, state: popupEditForm.state || null, zip: popupEditForm.zip || null, projectType: popupEditForm.projectType || null } : prev.lead,
      } : prev);
      setPopupEditing(false);
    } catch (err) {
      setPopupSaveError(err instanceof Error ? err.message : "Save failed — please try again");
    } finally { setPopupSaving(false); }
  }

  function closePopup() {
    setPopupAppt(null); setPopupLead(null); setPopupLeadId(null);
    setPopupNotes([]); setPopupEditing(false);
  }

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

  // Inline time picker JSX
  function timeRow(
    h: string, m: string, ap: "AM" | "PM",
    setH: (v: string) => void, setM: (v: string) => void, setAp: (v: "AM" | "PM") => void,
    date: string, setDate: (v: string) => void
  ) {
    return (
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <input
            type="text" inputMode="numeric" placeholder="12" maxLength={2} value={h}
            onChange={e => setH(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="w-10 bg-transparent text-sm outline-none text-center py-2"
            style={{ color: "#e6edf3" }}
          />
          <span className="text-sm font-bold px-0.5 select-none" style={{ color: "#C9A84C" }}>:</span>
          <input
            type="text" inputMode="numeric" placeholder="00" maxLength={2} value={m}
            onChange={e => setM(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="w-10 bg-transparent text-sm outline-none text-center py-2"
            style={{ color: "#e6edf3" }}
          />
          <button
            type="button"
            onClick={() => setAp(ap === "AM" ? "PM" : "AM")}
            className="px-3 py-2 text-xs font-bold"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            {ap}
          </button>
        </div>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: "1px solid #30373f", color: "#e6edf3" }}
        />
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-2xl px-4 py-3 sm:px-6 sm:py-5" style={{ background: "#0a0e1a", border: "1px solid #C9A84C33" }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center text-[22px] sm:text-6xl font-black leading-none tracking-tight" style={{ color: "#C9A84C" }}>
          Today&apos;s appointments
        </div>
        <button
          onClick={showPicker || showForm || showNewContact ? () => { setShowPicker(false); setShowForm(false); setShowNewContact(false); setSelectedLead(null); setError(""); } : openPicker}
          className="shrink-0 text-sm px-3 py-1 rounded font-medium transition-colors"
          style={{ border: "1px solid #C9A84C66", color: "#C9A84C", background: (showPicker || showForm || showNewContact) ? "#C9A84C22" : "transparent" }}
        >
          {showPicker || showForm || showNewContact ? "×" : "+"}
        </button>
      </div>

      {/* Lead picker */}
      {showPicker && (
        <div className="mt-4 rounded-xl flex flex-col gap-2" style={{ background: "#161b22", border: "1px solid #C9A84C33" }}>
          <div className="p-3 pb-0">
            <input type="text" placeholder="Search leads, prospects, clients…" value={search} onChange={e => setSearch(e.target.value)}
              autoFocus className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
              style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
          </div>
          <div className="overflow-y-auto px-3 pb-3" style={{ maxHeight: 300 }}>
            {loadingLeads && <p className="text-xs py-4 text-center" style={{ color: "#8b949e" }}>Loading contacts…</p>}
            {!loadingLeads && filteredLeads.length === 0 && (
              <p className="text-xs py-3 text-center" style={{ color: "#484f58" }}>
                No contact matches{search ? ` "${search}"` : ""}
              </p>
            )}
            {filteredLeads.map(lead => {
              const isClient = lead.id.startsWith("client_");
              return (
                <button key={lead.id} onClick={() => selectLead(lead)}
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-[#1e2736] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{lead.displayName}</div>
                    <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                      {isClient && lead.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                          background: lead.source === "ACTIVE" ? "#22c55e22" : lead.source === "PIPELINE" ? "#3b82f622" : "#C9A84C22",
                          color: lead.source === "ACTIVE" ? "#22c55e" : lead.source === "PIPELINE" ? "#3b82f6" : "#C9A84C",
                        }}>
                          {lead.source.charAt(0) + lead.source.slice(1).toLowerCase()}
                        </span>
                      )}
                      {lead.lead?.projectType && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C" }}>{lead.lead.projectType}</span>}
                      {lead.lead?.phone && <span className="text-[10px]" style={{ color: "#8b949e" }}>{lead.lead.phone}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: "#C9A84C" }}>Select →</span>
                </button>
              );
            })}

            {/* Always-visible "create new contact" button */}
            <button onClick={openNewContact}
              className="w-full text-center mt-2 px-3 py-2.5 rounded-lg transition-colors"
              style={{ background: "#0d1117", border: "1px dashed #C9A84C44", color: "#C9A84C" }}>
              + Create new contact{search ? ` "${search}"` : ""} as Prospect
            </button>
          </div>
        </div>
      )}

      {/* New contact inline form */}
      {showNewContact && (
        <div className="mt-4 p-4 rounded-xl flex flex-col gap-3" style={{ background: "#161b22", border: "1px solid #C9A84C33" }}>
          <div className="text-xs font-semibold" style={{ color: "#C9A84C" }}>
            Create new prospect
          </div>
          <input type="text" placeholder="Name *" value={newName} onChange={e => setNewName(e.target.value)} autoFocus
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
          <input type="tel" placeholder="Phone (optional)" value={newPhone} onChange={e => setNewPhone(e.target.value)}
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
          <input type="email" placeholder="Email (optional)" value={newEmail} onChange={e => setNewEmail(e.target.value)}
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
          <div className="flex gap-2">
            <button onClick={saveNewContact} disabled={newSaving || !newName.trim()}
              className="flex-1 text-sm font-bold py-2 rounded-lg disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#0d1117" }}>
              {newSaving ? "Saving…" : "Add as Prospect & continue"}
            </button>
            <button onClick={() => { setShowNewContact(false); setShowPicker(true); }}
              className="text-sm px-3 py-2 rounded-lg"
              style={{ color: "#8b949e", border: "1px solid #30373f" }}>
              ← Back
            </button>
          </div>
          {newError && <p className="text-xs" style={{ color: "#ef4444" }}>{newError}</p>}
        </div>
      )}

      {/* Compose form */}
      {showForm && selectedLead && (
        <div className="mt-4 p-4 rounded-xl flex flex-col gap-3" style={{ background: "#161b22", border: "1px solid #C9A84C33" }}>
          <div className="text-xs font-semibold" style={{ color: "#C9A84C" }}>
            Appointment for <span style={{ color: "#e6edf3" }}>{selectedLead.displayName}</span>
          </div>
          {timeRow(addH, addM, addAp, setAddH, setAddM, setAddAp, addDate, setAddDate)}
          <input type="text" placeholder="Address (optional)" value={addAddress} onChange={e => setAddAddress(e.target.value)}
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
          <textarea rows={3} placeholder="Notes (optional)…" value={addNotes} onChange={e => setAddNotes(e.target.value)}
            className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }} />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 text-sm font-bold py-2 rounded-lg disabled:opacity-50"
              style={{ background: "#C9A84C", color: "#0d1117" }}>
              {saving ? "Saving…" : "Save appointment"}
            </button>
            <button onClick={() => { setShowForm(false); setShowPicker(true); }}
              className="text-sm px-3 py-2 rounded-lg"
              style={{ color: "#8b949e", border: "1px solid #30373f" }}>
              ← Back
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        </div>
      )}

      {/* Today list */}
      {appointments.length === 0 && !showPicker && !showForm
        ? <p className="text-base text-center mt-3" style={{ color: "#484f58" }}>No appointments scheduled for today</p>
        : appointments.length > 0 && (
          <div className="space-y-3 mt-4">
            {appointments.map(appt => {
              const { name, time, phone: apptPhone, address: apptAddr, notes } = parseAppt(appt.text);
              const leadInfo = leadMap.get(name.toLowerCase());
              const phone = apptPhone || leadInfo?.phone || "";
              const address = apptAddr || leadInfo?.address || "";
              return (
                <div key={appt.id} className="rounded-xl" style={{ background: "#161b22", border: "1px solid #C9A84C22" }}>
                  <div className="flex flex-col p-4 gap-1.5">
                    {/* Name + time + Edit/Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                        <span className="text-base font-black" style={{ color: "#e6edf3" }}>{name}</span>
                        {time && <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>{time}</span>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openEdit(appt)} className="rounded-md px-3 py-1 text-xs font-bold"
                          style={{ background: "#C9A84C", color: "#0d1117" }}>Edit</button>
                        <button onClick={() => deleteAppt(appt.id)} className="rounded-md px-2 py-1 text-xs font-bold"
                          style={{ background: "#ef4444", color: "#fff" }}>×</button>
                      </div>
                    </div>
                    {/* Phone + address in yellow */}
                    {(phone || address) && (
                      <div className="flex gap-4 flex-wrap">
                        {phone && (
                          <a href={`tel:${phone.replace(/\D/g, "")}`} onClick={e => e.stopPropagation()}
                            className="text-sm font-semibold"
                            style={{ color: "#C9A84C", textDecoration: "none" }}>
                            {formatPhone(phone)}
                          </a>
                        )}
                        {address && <span className="text-sm font-semibold" style={{ color: "#C9A84C" }}>📍 {address}</span>}
                      </div>
                    )}
                    {/* Notes + tap for details (right-aligned) */}
                    <div className="flex items-end justify-between gap-2">
                      {notes
                        ? <p className="text-xs flex-1" style={{ color: "#8b949e", whiteSpace: "pre-wrap" }}>{notes}</p>
                        : <span />
                      }
                      <button onClick={() => openLeadPopup(appt)}
                        className="text-xs shrink-0 font-semibold"
                        style={{ color: "#C9A84C99" }}>
                        Tap for details →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {/* Upcoming section */}
      {upcoming.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowUpcoming(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: "#161b2288", border: "1px solid #C9A84C22" }}>
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
                      onClick={() => setExpandedDates(prev => { const n = new Set(prev); if (isOpen) { n.delete(dateKey); } else { n.add(dateKey); } return n; })}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1e2736]"
                      style={{ background: "#161b22" }}>
                      <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C" }}>{appts.length}</span>
                        <span style={{ color: "#484f58", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: "1px solid #30373f" }}>
                        {appts.map(appt => {
                          const { name, time, phone: apptPhone2, address: apptAddr2, notes } = parseAppt(appt.text);
                          const leadInfo2 = leadMap.get(name.toLowerCase());
                          const phone2 = apptPhone2 || leadInfo2?.phone || "";
                          const address = apptAddr2 || leadInfo2?.address || "";
                          return (
                            <div key={appt.id} style={{ background: "#0d1117", borderBottom: "1px solid #1e2736" }}>
                              <div className="flex flex-col px-4 py-3 gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                                    <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{name}</span>
                                    {time && <span className="text-xs font-semibold" style={{ color: "#C9A84C" }}>{time}</span>}
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={() => openEdit(appt)} className="rounded-md px-3 py-1 text-xs font-bold"
                                      style={{ background: "#C9A84C", color: "#0d1117" }}>Edit</button>
                                    <button onClick={() => deleteAppt(appt.id)} className="rounded-md px-2 py-1 text-xs font-bold"
                                      style={{ background: "#ef4444", color: "#fff" }}>×</button>
                                  </div>
                                </div>
                                {phone2 && (
                                  <a href={`tel:${phone2.replace(/\D/g, "")}`} onClick={e => e.stopPropagation()}
                                    className="text-xs font-semibold" style={{ color: "#C9A84C", textDecoration: "none" }}>
                                    📞 {formatPhone(phone2)}
                                  </a>
                                )}
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

      {/* Past appointments — collapsible, gray */}
      {past.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowPast(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: "#8b949e11", border: "1px solid #8b949e22" }}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>
              Past appointments ({past.length})
            </span>
            <span style={{ color: "#8b949e", fontSize: 14 }}>{showPast ? "▲" : "▼"}</span>
          </button>
          {showPast && (
            <div className="mt-2 space-y-2">
              {past.map(appt => {
                const { name, time, phone: apptPhone, address: apptAddr, notes } = parseAppt(appt.text);
                const leadInfo = leadMap.get(name.toLowerCase());
                const phone = apptPhone || leadInfo?.phone || "";
                const address = apptAddr || leadInfo?.address || "";
                return (
                  <div key={appt.id} className="rounded-xl" style={{ background: "#161b2288", border: "1px solid #30373f" }}>
                    <div className="flex flex-col p-3 gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                          <span className="text-sm font-bold" style={{ color: "#8b949e" }}>{name}</span>
                          {time && <span className="text-xs" style={{ color: "#484f58" }}>{time}</span>}
                          {appt.dueDate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#30373f", color: "#484f58" }}>
                              {formatDueDate(appt.dueDate)}
                            </span>
                          )}
                        </div>
                        <button onClick={() => openLeadPopup(appt)}
                          className="text-xs shrink-0" style={{ color: "#484f58" }}>
                          Details →
                        </button>
                      </div>
                      {(phone || address) && (
                        <div className="flex gap-3 flex-wrap">
                          {phone && (
                            <a href={`tel:${phone.replace(/\D/g, "")}`} onClick={e => e.stopPropagation()}
                              className="text-xs" style={{ color: "#8b949e66", textDecoration: "none" }}>
                              {formatPhone(phone)}
                            </a>
                          )}
                          {address && <span className="text-xs" style={{ color: "#484f58" }}>{address}</span>}
                        </div>
                      )}
                      {notes && <p className="text-xs" style={{ color: "#484f58", whiteSpace: "pre-wrap" }}>{notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit appointment modal */}
      {editingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setEditingAppt(null)}>
          <div className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "#161b22", border: "1px solid #C9A84C66" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>Edit: {parseAppt(editingAppt.text).name}</span>
              <button onClick={() => setEditingAppt(null)} style={{ color: "#8b949e", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            {timeRow(editH, editM, editAp, setEditH, setEditM, setEditAp, editDate, setEditDate)}
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
              <button onClick={() => setEditingAppt(null)} className="text-sm px-4 py-2 rounded-lg"
                style={{ color: "#8b949e", border: "1px solid #30373f" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Lead popup */}
      {(popupLoading || popupAppt) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={closePopup}>
          <div className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-4 overflow-y-auto"
            style={{ background: "#161b22", border: "1px solid #C9A84C44", maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}>

            {/* Appointment summary */}
            {popupAppt && (() => {
              const { name, time, address, notes } = parseAppt(popupAppt.text);
              return (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>{name}</h2>
                    <button onClick={closePopup} style={{ color: "#8b949e", fontSize: 20, lineHeight: 1 }}>×</button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {popupAppt.dueDate && <span style={{ color: "#C9A84C" }}>📅 {formatDueDate(popupAppt.dueDate)}</span>}
                    {time && <span style={{ color: "#C9A84C" }}>⏰ {time}</span>}
                    {address && <span style={{ color: "#8b949e" }}>📍 {address}</span>}
                  </div>
                  {notes && <p className="text-xs mt-2 p-2 rounded-lg" style={{ color: "#e6edf3", background: "#0d1117", whiteSpace: "pre-wrap" }}>{notes}</p>}
                </div>
              );
            })()}

            {popupLoading && <p className="text-sm text-center py-4" style={{ color: "#484f58" }}>Loading lead…</p>}

            {!popupLoading && (
              <>
                {/* Lead info + edit */}
                <div style={{ borderTop: "1px solid #30373f", paddingTop: 12 }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#484f58" }}>Lead Info</p>
                    {!popupEditing && (
                      <button onClick={openPopupEdit}
                        className="text-xs px-3 py-1 rounded-md font-bold"
                        style={{ background: "#C9A84C", color: "#0d1117" }}>
                        ✏️ Edit lead
                      </button>
                    )}
                  </div>

                  {popupEditing ? (
                    <div className="flex flex-col gap-3">
                      {popupFormLoading ? (
                        <p className="text-xs text-center py-2" style={{ color: "#484f58" }}>Loading…</p>
                      ) : (
                        <>
                          {(["name", "email", "phone", "address", "city", "state", "zip"] as const).map(field => (
                            <div key={field}>
                              <label className="text-[10px] font-semibold block mb-1 capitalize" style={{ color: "#8b949e" }}>{field}</label>
                              <input
                                type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                                value={popupEditForm[field]}
                                onChange={e => setPopupEditForm(f => ({ ...f, [field]: e.target.value }))}
                                className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none"
                                style={{ border: "1px solid #30373f", color: "#e6edf3", background: "#0d1117", boxSizing: "border-box" as const }}
                              />
                            </div>
                          ))}
                          <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: "#8b949e" }}>Project Type</label>
                            <ProjectTypeSelector value={popupEditForm.projectType} onChange={v => setPopupEditForm(f => ({ ...f, projectType: v }))} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: "#8b949e" }}>Message</label>
                            <textarea rows={3} value={popupEditForm.message}
                              onChange={e => setPopupEditForm(f => ({ ...f, message: e.target.value }))}
                              className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none resize-none"
                              style={{ border: "1px solid #30373f", color: "#e6edf3", background: "#0d1117", boxSizing: "border-box" as const }} />
                          </div>
                          <div style={{ borderTop: "1px solid #30373f", paddingTop: 10 }}>
                            <label className="text-[10px] font-semibold block mb-1" style={{ color: "#8b949e" }}>Add note</label>
                            <textarea rows={2} value={popupNewNote} onChange={e => setPopupNewNote(e.target.value)}
                              placeholder="Type a note…"
                              className="w-full bg-transparent text-sm px-3 py-2 rounded-lg outline-none resize-none"
                              style={{ border: "1px solid #30373f", color: "#e6edf3", background: "#0d1117", boxSizing: "border-box" as const }} />
                          </div>
                        </>
                      )}
                      {!popupLeadId && (
                        <p className="text-xs" style={{ color: "#ef4444" }}>⚠️ Lead record not found — changes cannot be saved</p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={savePopupEdits} disabled={popupSaving || !popupLeadId || popupFormLoading}
                          className="flex-1 text-sm font-bold py-2 rounded-lg disabled:opacity-50"
                          style={{ background: "#C9A84C", color: "#0d1117" }}>
                          {popupSaving ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => { setPopupEditing(false); setPopupSaveError(""); }}
                          className="text-sm px-4 py-2 rounded-lg"
                          style={{ color: "#8b949e", border: "1px solid #30373f" }}>Cancel</button>
                      </div>
                      {popupSaveError && (
                        <p className="text-xs" style={{ color: "#ef4444" }}>⚠️ {popupSaveError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm space-y-1" style={{ color: "#8b949e" }}>
                      {popupLead ? (
                        <>
                          {popupLead.lead?.projectType && <div><span style={{ color: "#C9A84C" }}>Project:</span> {popupLead.lead.projectType}</div>}
                          {popupLead.lead?.phone
                            ? <div><span style={{ color: "#C9A84C" }}>Phone:</span>{" "}
                                <a href={`tel:${popupLead.lead.phone.replace(/\D/g, "")}`}
                                  style={{ color: "#e6edf3", textDecoration: "none" }}>
                                  {formatPhone(popupLead.lead.phone)}
                                </a>
                              </div>
                            : <div className="italic text-xs" style={{ color: "#484f58" }}>No phone on file — tap Edit lead to add</div>
                          }
                          {popupLead.lead?.email && <div><span style={{ color: "#C9A84C" }}>Email:</span> {popupLead.lead.email}</div>}
                          {popupLead.lead?.address && <div><span style={{ color: "#C9A84C" }}>Address:</span> {popupLead.lead.address}{popupLead.lead.city ? `, ${popupLead.lead.city}` : ""}{popupLead.lead.state ? `, ${popupLead.lead.state}` : ""}{popupLead.lead.zip ? ` ${popupLead.lead.zip}` : ""}</div>}
                          {popupLead.source && <div><span style={{ color: "#C9A84C" }}>Source:</span> {popupLead.source}</div>}
                        </>
                      ) : (
                        <p className="italic text-xs" style={{ color: "#484f58" }}>Lead not found in system</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div style={{ borderTop: "1px solid #30373f", paddingTop: 12 }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#484f58" }}>Notes</p>
                  {popupNotes.length === 0
                    ? <p className="text-xs italic" style={{ color: "#484f58" }}>No notes yet</p>
                    : (
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
                    )
                  }
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
