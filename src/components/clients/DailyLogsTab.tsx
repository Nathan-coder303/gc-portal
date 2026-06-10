"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { put } from "@vercel/blob/client";

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

type Sub = { name: string; company: string; trade: string };
type ListItem = { item: string; qty: string; supplier?: string };
type Note = { addedBy: string; title: string; content: string };
type Inspection = { type: string; status: string };
type Meeting = { name: string; leader: string; attendees: string; status: string };

type LogForm = {
  arrivalDate: string;
  arrivalTime: string;
  departureTime: string;
  status: string;
  siteCondition: string;
  weatherCondition: string;
  temperature: string;
  weatherNote: string;
  weatherDelay: boolean;
  scheduleDelay: boolean;
  jobsiteConditionNotes: string;
  tasksPerformed: string;
  employeesOnSite: string;
  visitorsOnSite: boolean;
  employeeWorkNotes: string;
  subsOnJobsite: Sub[];
  materialNotes: string;
  materialDelivered: ListItem[];
  materialUsed: ListItem[];
  equipmentNotes: string;
  equipmentUsed: ListItem[];
  equipmentDelivered: ListItem[];
  projectNotes: Note[];
  inspections: Inspection[];
  safetyMeetings: Meeting[];
  siteAuditConducted: boolean;
  areasOfConcern: string;
  workCompletedPct: string;
  estimatedCompletion: string;
  groundConditions: string;
  crewsPresent: string[];
  equipmentDamaged: string;
  equipmentDamageNotes: string;
  signatureData: string;
};

type DailyLog = {
  id: string;
  arrivalDate: string;
  departureTime: string | null;
  status: string;
  siteCondition: string | null;
  weatherCondition: string | null;
  temperature: string | null;
  weatherNote: string | null;
  weatherDelay: boolean;
  scheduleDelay: boolean;
  jobsiteConditionNotes: string | null;
  tasksPerformed: string | null;
  employeesOnSite: string | null;
  visitorsOnSite: boolean;
  employeeWorkNotes: string | null;
  subsOnJobsite: string | null;
  materialNotes: string | null;
  materialDelivered: string | null;
  materialUsed: string | null;
  equipmentNotes: string | null;
  equipmentUsed: string | null;
  equipmentDelivered: string | null;
  projectNotes: string | null;
  inspections: string | null;
  safetyMeetings: string | null;
  siteAuditConducted: boolean;
  areasOfConcern: string | null;
  workCompletedPct: string | null;
  estimatedCompletion: string | null;
  groundConditions: string | null;
  crewsPresent: string | null;
  equipmentDamaged: string | null;
  equipmentDamageNotes: string | null;
  signatureData: string | null;
  createdBy: string | null;
  createdAt: string;
  emailSentAt: string | null;
};

const SECTIONS = [
  { key: "details", label: "Details" },
  { key: "people", label: "People" },
  { key: "notes", label: "Notes" },
  { key: "mtl", label: "MTL" },
  { key: "equip", label: "EQUIP" },
  { key: "files", label: "Files" },
  { key: "custom", label: "Custom" },
] as const;
type Section = typeof SECTIONS[number]["key"];

const WEATHER_OPTIONS = ["Sunny", "Partly Cloudy", "Cloudy", "Overcast", "Rainy", "Stormy", "Foggy", "Snowy", "Windy"];
const SITE_CONDITIONS = ["Clean", "Average", "Poor", "Hazardous"];
const GROUND_CONDITIONS = ["Dry", "Damp", "Wet", "Muddy", "Frozen", "Sandy"];
const STATUS_OPTIONS = [
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETE", label: "Complete" },
  { value: "ON_HOLD", label: "On Hold" },
];
const CREWS = ["Framing", "Electrical", "Plumbing", "Roofing", "HVAC", "Drywall", "Painting", "Flooring", "Trim", "Concrete", "Landscaping", "Other"];

function blankForm(): LogForm {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    arrivalDate: now.toISOString().split("T")[0],
    arrivalTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    departureTime: "",
    status: "IN_PROGRESS",
    siteCondition: "",
    weatherCondition: "",
    temperature: "",
    weatherNote: "",
    weatherDelay: false,
    scheduleDelay: false,
    jobsiteConditionNotes: "",
    tasksPerformed: "",
    employeesOnSite: "",
    visitorsOnSite: false,
    employeeWorkNotes: "",
    subsOnJobsite: [],
    materialNotes: "",
    materialDelivered: [],
    materialUsed: [],
    equipmentNotes: "",
    equipmentUsed: [],
    equipmentDelivered: [],
    projectNotes: [],
    inspections: [],
    safetyMeetings: [],
    siteAuditConducted: false,
    areasOfConcern: "",
    workCompletedPct: "",
    estimatedCompletion: "",
    groundConditions: "",
    crewsPresent: [],
    equipmentDamaged: "NO",
    equipmentDamageNotes: "",
    signatureData: "",
  };
}

function logToForm(log: DailyLog): LogForm {
  const d = new Date(log.arrivalDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parseJson = <T,>(s: string | null, fallback: T): T => {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };
  return {
    arrivalDate: d.toISOString().split("T")[0],
    arrivalTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    departureTime: log.departureTime ?? "",
    status: log.status,
    siteCondition: log.siteCondition ?? "",
    weatherCondition: log.weatherCondition ?? "",
    temperature: log.temperature ?? "",
    weatherNote: log.weatherNote ?? "",
    weatherDelay: log.weatherDelay,
    scheduleDelay: log.scheduleDelay,
    jobsiteConditionNotes: log.jobsiteConditionNotes ?? "",
    tasksPerformed: log.tasksPerformed ?? "",
    employeesOnSite: log.employeesOnSite ?? "",
    visitorsOnSite: log.visitorsOnSite,
    employeeWorkNotes: log.employeeWorkNotes ?? "",
    subsOnJobsite: parseJson<Sub[]>(log.subsOnJobsite, []),
    materialNotes: log.materialNotes ?? "",
    materialDelivered: parseJson<ListItem[]>(log.materialDelivered, []),
    materialUsed: parseJson<ListItem[]>(log.materialUsed, []),
    equipmentNotes: log.equipmentNotes ?? "",
    equipmentUsed: parseJson<ListItem[]>(log.equipmentUsed, []),
    equipmentDelivered: parseJson<ListItem[]>(log.equipmentDelivered, []),
    projectNotes: parseJson<Note[]>(log.projectNotes, []),
    inspections: parseJson<Inspection[]>(log.inspections, []),
    safetyMeetings: parseJson<Meeting[]>(log.safetyMeetings, []),
    siteAuditConducted: log.siteAuditConducted,
    areasOfConcern: log.areasOfConcern ?? "",
    workCompletedPct: log.workCompletedPct ?? "",
    estimatedCompletion: log.estimatedCompletion ?? "",
    groundConditions: log.groundConditions ?? "",
    crewsPresent: parseJson<string[]>(log.crewsPresent, []),
    equipmentDamaged: log.equipmentDamaged ?? "NO",
    equipmentDamageNotes: log.equipmentDamageNotes ?? "",
    signatureData: log.signatureData ?? "",
  };
}

function formToPayload(f: LogForm) {
  const [y, m, d] = f.arrivalDate.split("-").map(Number);
  const [h, min] = f.arrivalTime.split(":").map(Number);
  const arrivalDate = new Date(y, m - 1, d, h || 0, min || 0).toISOString();
  return {
    arrivalDate,
    departureTime: f.departureTime || null,
    status: f.status,
    siteCondition: f.siteCondition || null,
    weatherCondition: f.weatherCondition || null,
    temperature: f.temperature || null,
    weatherNote: f.weatherNote || null,
    weatherDelay: f.weatherDelay,
    scheduleDelay: f.scheduleDelay,
    jobsiteConditionNotes: f.jobsiteConditionNotes || null,
    tasksPerformed: f.tasksPerformed || null,
    employeesOnSite: f.employeesOnSite || null,
    visitorsOnSite: f.visitorsOnSite,
    employeeWorkNotes: f.employeeWorkNotes || null,
    subsOnJobsite: f.subsOnJobsite,
    materialNotes: f.materialNotes || null,
    materialDelivered: f.materialDelivered,
    materialUsed: f.materialUsed,
    equipmentNotes: f.equipmentNotes || null,
    equipmentUsed: f.equipmentUsed,
    equipmentDelivered: f.equipmentDelivered,
    projectNotes: f.projectNotes,
    inspections: f.inspections,
    safetyMeetings: f.safetyMeetings,
    siteAuditConducted: f.siteAuditConducted,
    areasOfConcern: f.areasOfConcern || null,
    workCompletedPct: f.workCompletedPct || null,
    estimatedCompletion: f.estimatedCompletion || null,
    groundConditions: f.groundConditions || null,
    crewsPresent: f.crewsPresent,
    equipmentDamaged: f.equipmentDamaged || null,
    equipmentDamageNotes: f.equipmentDamageNotes || null,
    signatureData: f.signatureData || null,
  };
}

// ── Shared field components ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>{children}</p>;
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm"
      style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
  );
}

function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm resize-none"
      style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
  );
}

function BulletTextarea({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: pos, selectionEnd: posEnd, value: v } = ta;
    if (pos !== posEnd) return; // has selection — let browser handle

    if (e.key === "Enter") {
      e.preventDefault();
      const hasBullets = v.includes("• ");

      let newValue: string;
      let newPos: number;

      if (!hasBullets) {
        // First Enter: convert all existing lines to bullets, add new bullet line
        const beforeCursor = v.slice(0, pos);
        const afterCursor = v.slice(pos);
        const bulletsBefore = beforeCursor
          .split("\n")
          .map(l => (l ? `• ${l}` : l))
          .join("\n");
        newValue = bulletsBefore + "\n• " + afterCursor;
        newPos = bulletsBefore.length + "\n• ".length;
      } else {
        // Already in bullet mode — insert a new bullet line
        newValue = v.slice(0, pos) + "\n• " + v.slice(pos);
        newPos = pos + "\n• ".length;
      }

      onChange(newValue);
      requestAnimationFrame(() => ta.setSelectionRange(newPos, newPos));

    } else if (e.key === "Backspace") {
      const lineStart = v.lastIndexOf("\n", pos - 1) + 1;
      // Cursor is right after "• " with nothing typed yet on this line
      if (pos === lineStart + 2 && v.slice(lineStart, pos) === "• ") {
        e.preventDefault();
        // Remove the "• " and the preceding newline
        const removeFrom = lineStart > 0 ? lineStart - 1 : 0;
        const newValue = v.slice(0, removeFrom) + v.slice(pos);
        const newPos = removeFrom;
        onChange(newValue);
        requestAnimationFrame(() => ta.setSelectionRange(newPos, newPos));
      }
    }
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm resize-none"
      style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
    />
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[] | { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-sm"
      style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: value ? TEXT : MUTED, outline: "none" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => {
        const val = typeof o === "string" ? o : o.value;
        const lbl = typeof o === "string" ? o : o.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {["Yes", "No"].map(opt => (
        <button key={opt} onClick={() => onChange(opt === "Yes")}
          className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
          style={{
            background: (opt === "Yes") === value ? GOLD : "#1e2736",
            color: (opt === "Yes") === value ? "#0d1117" : MUTED,
            border: `1px solid ${(opt === "Yes") === value ? GOLD : BORDER}`,
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

function AddableList<T extends object>({
  label, items, onAdd, onRemove, renderItem, blankItem, renderAddForm,
}: {
  label: string;
  items: T[];
  onAdd: (item: T) => void;
  onRemove: (i: number) => void;
  renderItem: (item: T, i: number) => React.ReactNode;
  blankItem: T;
  renderAddForm?: (draft: T, setDraft: (v: T) => void, onSubmit: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T>(blankItem);

  function submit() {
    onAdd(draft);
    setDraft(blankItem);
    setOpen(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold" style={{ color: TEXT }}>{label}</p>
        <button onClick={() => setOpen(o => !o)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold"
          style={{ background: "#1e2736", color: GOLD, border: `1px solid ${BORDER}` }}>+</button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start justify-between gap-2 rounded-lg px-3 py-2 mb-1"
          style={{ background: "#0d1117", border: `1px solid ${BORDER}` }}>
          <div className="flex-1 min-w-0">{renderItem(item, i)}</div>
          <button onClick={() => onRemove(i)} className="text-xs shrink-0" style={{ color: "#ef4444" }}>✕</button>
        </div>
      ))}
      {open && renderAddForm && (
        <div className="rounded-lg p-3 space-y-2 mt-1" style={{ background: "#0d1117", border: `1px solid ${GOLD}44` }}>
          {renderAddForm(draft, setDraft, submit)}
          <div className="flex gap-2 pt-1">
            <button onClick={submit} className="flex-1 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: GOLD, color: "#0d1117" }}>Add</button>
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section renderers ─────────────────────────────────────────────────────────

function DetailsSection({ form, set }: { form: LogForm; set: (k: keyof LogForm, v: LogForm[keyof LogForm]) => void }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Details</p>
        <div>
          <FieldLabel>Arrival Date / Time</FieldLabel>
          <div className="flex gap-2">
            <input type="date" value={form.arrivalDate} onChange={e => set("arrivalDate", e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
            <input type="time" value={form.arrivalTime} onChange={e => set("arrivalTime", e.target.value)}
              className="w-32 rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
          </div>
        </div>
        <div>
          <FieldLabel>Departure Time</FieldLabel>
          <input type="time" value={form.departureTime} onChange={e => set("departureTime", e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
        </div>
        <div>
          <FieldLabel>Log Status</FieldLabel>
          <Select value={form.status} onChange={v => set("status", v)} options={STATUS_OPTIONS} />
        </div>
        <div>
          <FieldLabel>Site Condition</FieldLabel>
          <Select value={form.siteCondition} onChange={v => set("siteCondition", v)} options={SITE_CONDITIONS} placeholder="Select condition" />
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Weather</p>
        <div>
          <FieldLabel>Condition</FieldLabel>
          <Select value={form.weatherCondition} onChange={v => set("weatherCondition", v)} options={WEATHER_OPTIONS} placeholder="Select weather" />
        </div>
        <div>
          <FieldLabel>Temperature (°F)</FieldLabel>
          <TextInput value={form.temperature} onChange={v => set("temperature", v)} placeholder="e.g. 78" />
        </div>
        <div>
          <FieldLabel>Weather Note</FieldLabel>
          <TextArea value={form.weatherNote} onChange={v => set("weatherNote", v)} rows={2} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: TEXT }}>Any Weather Delays?</p>
          <Toggle value={form.weatherDelay} onChange={v => set("weatherDelay", v)} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: TEXT }}>Any Schedule Delays?</p>
          <Toggle value={form.scheduleDelay} onChange={v => set("scheduleDelay", v)} />
        </div>
      </SectionCard>

      <SectionCard>
        <div>
          <FieldLabel>Jobsite Condition Notes</FieldLabel>
          <TextArea value={form.jobsiteConditionNotes} onChange={v => set("jobsiteConditionNotes", v)} rows={3} />
        </div>
        <div>
          <FieldLabel>Tasks Performed</FieldLabel>
          <BulletTextarea value={form.tasksPerformed} onChange={v => set("tasksPerformed", v)} rows={4} placeholder="Describe the work performed today..." />
        </div>
      </SectionCard>
    </div>
  );
}

function PeopleSection({ form, set }: { form: LogForm; set: (k: keyof LogForm, v: LogForm[keyof LogForm]) => void }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>People on Site</p>
        <div>
          <FieldLabel>Employees on Site</FieldLabel>
          <TextArea value={form.employeesOnSite} onChange={v => set("employeesOnSite", v)} rows={3} placeholder="Names separated by commas or new lines..." />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: TEXT }}>Any Visitors on Site?</p>
          <Toggle value={form.visitorsOnSite} onChange={v => set("visitorsOnSite", v)} />
        </div>
        <div>
          <FieldLabel>Employee Work Notes</FieldLabel>
          <TextArea value={form.employeeWorkNotes} onChange={v => set("employeeWorkNotes", v)} rows={3} />
        </div>
      </SectionCard>

      <SectionCard>
        <AddableList<Sub>
          label="Subs on Jobsite"
          items={form.subsOnJobsite}
          onAdd={item => set("subsOnJobsite", [...form.subsOnJobsite, item])}
          onRemove={i => set("subsOnJobsite", form.subsOnJobsite.filter((_, idx) => idx !== i))}
          blankItem={{ name: "", company: "", trade: "" }}
          renderItem={s => (
            <div>
              <p className="text-xs font-semibold" style={{ color: TEXT }}>{s.name}</p>
              <p className="text-xs" style={{ color: MUTED }}>{[s.company, s.trade].filter(Boolean).join(" · ")}</p>
            </div>
          )}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.name} onChange={v => setDraft({ ...draft, name: v })} placeholder="Name" />
              <TextInput value={draft.company} onChange={v => setDraft({ ...draft, company: v })} placeholder="Company" />
              <TextInput value={draft.trade} onChange={v => setDraft({ ...draft, trade: v })} placeholder="Trade" />
            </div>
          )}
        />
      </SectionCard>
    </div>
  );
}

function NotesSection({ form, set }: { form: LogForm; set: (k: keyof LogForm, v: LogForm[keyof LogForm]) => void }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <AddableList<Note>
          label="Project Notes"
          items={form.projectNotes}
          onAdd={item => set("projectNotes", [...form.projectNotes, item])}
          onRemove={i => set("projectNotes", form.projectNotes.filter((_, idx) => idx !== i))}
          blankItem={{ addedBy: "", title: "", content: "" }}
          renderItem={n => (
            <div>
              <p className="text-xs font-semibold" style={{ color: TEXT }}>{n.title}</p>
              <p className="text-xs" style={{ color: MUTED }}>{n.addedBy}{n.content ? ` — ${n.content.slice(0, 60)}` : ""}</p>
            </div>
          )}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.addedBy} onChange={v => setDraft({ ...draft, addedBy: v })} placeholder="Added By" />
              <TextInput value={draft.title} onChange={v => setDraft({ ...draft, title: v })} placeholder="Title" />
              <TextArea value={draft.content} onChange={v => setDraft({ ...draft, content: v })} rows={2} placeholder="Note content..." />
            </div>
          )}
        />
      </SectionCard>

      <SectionCard>
        <AddableList<Inspection>
          label="Jobsite Inspections"
          items={form.inspections}
          onAdd={item => set("inspections", [...form.inspections, item])}
          onRemove={i => set("inspections", form.inspections.filter((_, idx) => idx !== i))}
          blankItem={{ type: "", status: "Passed" }}
          renderItem={n => (
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: TEXT }}>{n.type}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: n.status === "Passed" ? "#0d2a1a" : "#2a1010", color: n.status === "Passed" ? "#22c55e" : "#ef4444", border: `1px solid ${n.status === "Passed" ? "#22c55e44" : "#ef444444"}` }}>
                {n.status}
              </span>
            </div>
          )}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.type} onChange={v => setDraft({ ...draft, type: v })} placeholder="Inspection Type" />
              <Select value={draft.status} onChange={v => setDraft({ ...draft, status: v })} options={["Passed", "Failed", "Pending", "Scheduled"]} />
            </div>
          )}
        />
      </SectionCard>

      <SectionCard>
        <AddableList<Meeting>
          label="Safety Meetings"
          items={form.safetyMeetings}
          onAdd={item => set("safetyMeetings", [...form.safetyMeetings, item])}
          onRemove={i => set("safetyMeetings", form.safetyMeetings.filter((_, idx) => idx !== i))}
          blankItem={{ name: "", leader: "", attendees: "", status: "Completed" }}
          renderItem={n => (
            <div>
              <p className="text-xs font-semibold" style={{ color: TEXT }}>{n.name}</p>
              <p className="text-xs" style={{ color: MUTED }}>Leader: {n.leader} · {n.attendees} attendees · {n.status}</p>
            </div>
          )}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.name} onChange={v => setDraft({ ...draft, name: v })} placeholder="Meeting Name" />
              <TextInput value={draft.leader} onChange={v => setDraft({ ...draft, leader: v })} placeholder="Leader" />
              <TextInput value={draft.attendees} onChange={v => setDraft({ ...draft, attendees: v })} placeholder="# of Attendees" />
              <Select value={draft.status} onChange={v => setDraft({ ...draft, status: v })} options={["Completed", "Scheduled", "Cancelled"]} />
            </div>
          )}
        />
      </SectionCard>
    </div>
  );
}

function MaterialSection({ form, set }: { form: LogForm; set: (k: keyof LogForm, v: LogForm[keyof LogForm]) => void }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <div>
          <FieldLabel>Material Notes</FieldLabel>
          <TextArea value={form.materialNotes} onChange={v => set("materialNotes", v)} rows={3} />
        </div>
      </SectionCard>

      <SectionCard>
        <AddableList<ListItem>
          label="Material Items Delivered"
          items={form.materialDelivered}
          onAdd={item => set("materialDelivered", [...form.materialDelivered, item])}
          onRemove={i => set("materialDelivered", form.materialDelivered.filter((_, idx) => idx !== i))}
          blankItem={{ item: "", qty: "", supplier: "" }}
          renderItem={n => <p className="text-xs" style={{ color: TEXT }}>{n.item}{n.qty ? ` — ${n.qty}` : ""}{n.supplier ? ` (${n.supplier})` : ""}</p>}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.item} onChange={v => setDraft({ ...draft, item: v })} placeholder="Item / Material" />
              <TextInput value={draft.qty} onChange={v => setDraft({ ...draft, qty: v })} placeholder="Quantity" />
              <TextInput value={draft.supplier ?? ""} onChange={v => setDraft({ ...draft, supplier: v })} placeholder="Supplier" />
            </div>
          )}
        />
      </SectionCard>

      <SectionCard>
        <AddableList<ListItem>
          label="Material Items Used"
          items={form.materialUsed}
          onAdd={item => set("materialUsed", [...form.materialUsed, item])}
          onRemove={i => set("materialUsed", form.materialUsed.filter((_, idx) => idx !== i))}
          blankItem={{ item: "", qty: "" }}
          renderItem={n => <p className="text-xs" style={{ color: TEXT }}>{n.item}{n.qty ? ` — ${n.qty}` : ""}</p>}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.item} onChange={v => setDraft({ ...draft, item: v })} placeholder="Item / Material" />
              <TextInput value={draft.qty} onChange={v => setDraft({ ...draft, qty: v })} placeholder="Quantity" />
            </div>
          )}
        />
      </SectionCard>
    </div>
  );
}

function EquipmentSection({ form, set }: { form: LogForm; set: (k: keyof LogForm, v: LogForm[keyof LogForm]) => void }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <div>
          <FieldLabel>Equipment Notes</FieldLabel>
          <TextArea value={form.equipmentNotes} onChange={v => set("equipmentNotes", v)} rows={3} />
        </div>
      </SectionCard>

      <SectionCard>
        <AddableList<ListItem>
          label="Equipment Items Used"
          items={form.equipmentUsed}
          onAdd={item => set("equipmentUsed", [...form.equipmentUsed, item])}
          onRemove={i => set("equipmentUsed", form.equipmentUsed.filter((_, idx) => idx !== i))}
          blankItem={{ item: "", qty: "" }}
          renderItem={n => <p className="text-xs" style={{ color: TEXT }}>{n.item}{n.qty ? ` — ${n.qty}` : ""}</p>}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.item} onChange={v => setDraft({ ...draft, item: v })} placeholder="Equipment Name" />
              <TextInput value={draft.qty} onChange={v => setDraft({ ...draft, qty: v })} placeholder="Quantity" />
            </div>
          )}
        />
      </SectionCard>

      <SectionCard>
        <AddableList<ListItem>
          label="Equipment Items Delivered"
          items={form.equipmentDelivered}
          onAdd={item => set("equipmentDelivered", [...form.equipmentDelivered, item])}
          onRemove={i => set("equipmentDelivered", form.equipmentDelivered.filter((_, idx) => idx !== i))}
          blankItem={{ item: "", qty: "" }}
          renderItem={n => <p className="text-xs" style={{ color: TEXT }}>{n.item}{n.qty ? ` — ${n.qty}` : ""}</p>}
          renderAddForm={(draft, setDraft) => (
            <div className="space-y-2">
              <TextInput value={draft.item} onChange={v => setDraft({ ...draft, item: v })} placeholder="Equipment Name" />
              <TextInput value={draft.qty} onChange={v => setDraft({ ...draft, qty: v })} placeholder="Quantity" />
            </div>
          )}
        />
      </SectionCard>
    </div>
  );
}

type Attachment = { id: string; name: string; url: string; size: number; mimeType: string };

type UploadingFile = { name: string; pct: number };

function FilesSection({ companyId, clientId, logId }: { companyId: string; clientId: string; logId?: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseUrl = logId ? `/api/${companyId}/clients/${clientId}/daily-logs/${logId}/attachments` : null;

  useEffect(() => {
    if (!baseUrl) return;
    fetch(baseUrl).then(r => r.json()).then(setAttachments).catch(() => {});
  }, [baseUrl]);

  async function handleFiles(files: FileList | null) {
    if (!files || !baseUrl) return;
    setError("");
    for (const file of Array.from(files)) {
      setUploading(prev => [...prev, { name: file.name, pct: 0 }]);
      try {
        // Get a client token so the browser uploads directly to Vercel Blob
        const tokenRes = await fetch(`${baseUrl}/upload-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        if (!tokenRes.ok) throw new Error("Could not get upload token");
        const { token, pathname } = await tokenRes.json() as { token: string; pathname: string };

        const blob = await put(pathname, file, {
          access: "private",
          token,
          onUploadProgress: ({ percentage }) => {
            setUploading(prev => prev.map(u => u.name === file.name ? { ...u, pct: Math.min(Math.round(percentage), 95) } : u));
          },
        });

        // Register the uploaded file's metadata with the server
        const metaRes = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, url: blob.url, size: file.size, mimeType: file.type || "application/octet-stream" }),
        });
        if (!metaRes.ok) throw new Error("Failed to save attachment");
        const saved = await metaRes.json() as Attachment;
        setAttachments(prev => [...prev, saved]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(prev => prev.filter(u => u.name !== file.name));
      }
    }
  }

  async function handleDelete(id: string) {
    if (!baseUrl || !confirm("Remove this attachment?")) return;
    await fetch(`${baseUrl}?id=${id}`, { method: "DELETE" });
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  if (!logId) {
    return (
      <div className="space-y-4">
        <SectionCard>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>Attachments</p>
          <p className="text-sm" style={{ color: MUTED }}>Save the log first, then you can attach photos and files.</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Attachments {attachments.length > 0 && <span style={{ color: MUTED }}>({attachments.length})</span>}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-80"
          style={{ background: GOLD, color: "#0d1117" }}>
          + Add
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-xs p-2 rounded-lg" style={{ background: "#2a1010", color: "#ef4444" }}>{error}</p>}

      {/* Upload progress bars */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map(u => (
            <div key={u.name} className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs truncate max-w-[200px]" style={{ color: TEXT }}>{u.name}</p>
                <p className="text-xs font-bold shrink-0 ml-2" style={{ color: GOLD }}>{u.pct}%</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${u.pct}%`, background: u.pct === 100 ? "#22c55e" : GOLD }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && uploading.length === 0 && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl p-8 text-center border-2 border-dashed transition-colors hover:border-opacity-80"
          style={{ borderColor: BORDER, background: CARD }}>
          <p className="text-2xl mb-2">📎</p>
          <p className="text-sm font-semibold mb-1" style={{ color: TEXT }}>No attachments yet</p>
          <p className="text-xs" style={{ color: MUTED }}>Tap to add photos, PDFs, or documents</p>
        </button>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map(a => {
            const isImage = a.mimeType.startsWith("image/");
            const isPdf = a.mimeType.includes("pdf");
            const displayUrl = `${baseUrl}/${a.id}`;
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                {isImage ? (
                  <a href={displayUrl} target="_blank" rel="noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={displayUrl} alt={a.name} className="w-12 h-12 rounded-lg object-cover" />
                  </a>
                ) : (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-xl"
                    style={{ background: isPdf ? "#2a1a10" : "#1a1a2e" }}>
                    {isPdf ? "📄" : "📁"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <a href={displayUrl} target="_blank" rel="noreferrer"
                    className="text-sm font-medium truncate block hover:underline" style={{ color: TEXT }}>
                    {a.name}
                  </a>
                  <p className="text-xs" style={{ color: MUTED }}>{fmtSize(a.size)}</p>
                </div>
                <button onClick={() => handleDelete(a.id)}
                  className="shrink-0 text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                  style={{ color: "#ef4444", background: "#2a1010", border: "1px solid #ef444433" }}>
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomSection({ form, set }: { form: LogForm; set: (k: keyof LogForm, v: LogForm[keyof LogForm]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY };
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Site Audit</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: TEXT }}>Site audit conducted before leaving?</p>
          <Toggle value={form.siteAuditConducted} onChange={v => set("siteAuditConducted", v)} />
        </div>
        <div>
          <FieldLabel>Areas of Concern</FieldLabel>
          <TextArea value={form.areasOfConcern} onChange={v => set("areasOfConcern", v)} rows={3} placeholder="List any areas that need attention..." />
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Progress</p>
        <div>
          <FieldLabel>% of Work Completed (Whole Project)</FieldLabel>
          <TextInput value={form.workCompletedPct} onChange={v => set("workCompletedPct", v)} placeholder="0–100" />
        </div>
        <div>
          <FieldLabel>Estimated Completion Date</FieldLabel>
          <input type="date" value={form.estimatedCompletion} onChange={e => set("estimatedCompletion", e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "#0d1117", border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
        </div>
        <div>
          <FieldLabel>Ground Conditions</FieldLabel>
          <Select value={form.groundConditions} onChange={v => set("groundConditions", v)} options={GROUND_CONDITIONS} placeholder="Select condition" />
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Crews Present</p>
        <div className="flex flex-wrap gap-2">
          {CREWS.map(crew => {
            const on = form.crewsPresent.includes(crew);
            return (
              <button key={crew} onClick={() => {
                const next = on ? form.crewsPresent.filter(c => c !== crew) : [...form.crewsPresent, crew];
                set("crewsPresent", next);
              }}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{ background: on ? GOLD : "#1e2736", color: on ? "#0d1117" : MUTED, border: `1px solid ${on ? GOLD : BORDER}` }}>
                {crew}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Equipment Status</p>
        <p className="text-sm font-medium mb-2" style={{ color: TEXT }}>Was any equipment damaged or in need of repair?</p>
        <div className="flex gap-3">
          {["YES", "NO", "OTHER"].map(opt => (
            <button key={opt} onClick={() => set("equipmentDamaged", opt)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={{
                background: form.equipmentDamaged === opt ? GOLD : "#1e2736",
                color: form.equipmentDamaged === opt ? "#0d1117" : MUTED,
                border: `1px solid ${form.equipmentDamaged === opt ? GOLD : BORDER}`,
              }}>
              {opt.charAt(0) + opt.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {form.equipmentDamaged === "OTHER" && (
          <div className="mt-2">
            <TextInput value={form.equipmentDamageNotes} onChange={v => set("equipmentDamageNotes", v)} placeholder="Describe damage or repair needed..." />
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>Supervisor Signature</p>
        {form.signatureData ? (
          <div>
            <img src={form.signatureData} alt="Signature" className="w-full rounded-lg" style={{ border: `1px solid ${BORDER}`, background: "#fff" }} />
            <button onClick={() => set("signatureData", "")} className="mt-2 text-xs" style={{ color: "#ef4444" }}>Clear Signature</button>
          </div>
        ) : (
          <div>
            <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${BORDER}`, background: "#fff", touchAction: "none" }}>
              <canvas ref={canvasRef} width={600} height={140} className="w-full" style={{ cursor: "crosshair", display: "block" }}
                onMouseDown={e => { drawing.current = true; lastPos.current = getPos(e.nativeEvent, canvasRef.current!); e.preventDefault(); }}
                onMouseMove={e => {
                  if (!drawing.current || !canvasRef.current) return;
                  const ctx = canvasRef.current.getContext("2d")!;
                  const pos = getPos(e.nativeEvent, canvasRef.current);
                  if (lastPos.current) { ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke(); }
                  lastPos.current = pos; e.preventDefault();
                }}
                onMouseUp={() => { drawing.current = false; if (canvasRef.current) set("signatureData", canvasRef.current.toDataURL("image/png")); }}
                onMouseLeave={() => { drawing.current = false; if (canvasRef.current) set("signatureData", canvasRef.current.toDataURL("image/png")); }}
                onTouchStart={e => { drawing.current = true; lastPos.current = getPos(e.nativeEvent, canvasRef.current!); e.preventDefault(); }}
                onTouchMove={e => {
                  if (!drawing.current || !canvasRef.current) return;
                  const ctx = canvasRef.current.getContext("2d")!;
                  const pos = getPos(e.nativeEvent, canvasRef.current);
                  if (lastPos.current) { ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke(); }
                  lastPos.current = pos; e.preventDefault();
                }}
                onTouchEnd={() => { drawing.current = false; if (canvasRef.current) set("signatureData", canvasRef.current.toDataURL("image/png")); }}
              />
            </div>
            <p className="text-xs mt-1 text-center" style={{ color: MUTED }}>Draw signature above</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Log Editor ────────────────────────────────────────────────────────────────

function LogEditor({
  companyId, clientId, clientName, initial, onSave, onCancel,
}: {
  companyId: string;
  clientId: string;
  clientName: string;
  initial: DailyLog | null;
  onSave: (log: DailyLog) => void;
  onCancel: () => void;
}) {
  const [section, setSection] = useState<Section>("details");
  const [form, setForm] = useState<LogForm>(initial ? logToForm(initial) : blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = useCallback(<K extends keyof LogForm>(k: K, v: LogForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = formToPayload(form);
      const url = initial
        ? `/api/${companyId}/clients/${clientId}/daily-logs/${initial.id}`
        : `/api/${companyId}/clients/${clientId}/daily-logs`;
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onSave(data);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  const sectionContent = {
    details: <DetailsSection form={form} set={setField} />,
    people: <PeopleSection form={form} set={setField} />,
    notes: <NotesSection form={form} set={setField} />,
    mtl: <MaterialSection form={form} set={setField} />,
    equip: <EquipmentSection form={form} set={setField} />,
    files: <FilesSection companyId={companyId} clientId={clientId} logId={initial?.id} />,
    custom: <CustomSection form={form} set={setField} />,
  };

  return (
    <div className="flex flex-col" style={{ background: BG, minHeight: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "#161b22", borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={onCancel} className="text-sm font-medium px-3 py-1.5 rounded-lg"
          style={{ color: MUTED, background: "#1e2736", border: `1px solid ${BORDER}` }}>
          Cancel
        </button>
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: TEXT }}>Daily Log</p>
          <p className="text-xs" style={{ color: MUTED }}>{clientName}</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="text-sm font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: GOLD, color: "#0d1117" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Tab bar — top on both mobile and desktop */}
      <div className="flex shrink-0 overflow-x-auto scrollbar-none"
        style={{ background: "#161b22", borderBottom: `1px solid ${BORDER}` }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className="flex-1 min-w-[56px] py-2.5 text-center whitespace-nowrap transition-all"
            style={{
              borderBottom: section === s.key ? `2px solid ${GOLD}` : "2px solid transparent",
              color: section === s.key ? GOLD : MUTED,
            }}>
            <p className="text-[11px] font-semibold">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {error && <p className="text-sm mb-3 p-3 rounded-lg" style={{ background: "#2a1010", color: "#ef4444", border: "1px solid #ef444444" }}>{error}</p>}
        {sectionContent[section]}
      </div>
    </div>
  );
}

// ── Log Card (list view) ──────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    IN_PROGRESS: { bg: "#2a1f00", color: "#f59e0b", label: "In Progress" },
    COMPLETE: { bg: "#0d2a1a", color: "#22c55e", label: "Complete" },
    ON_HOLD: { bg: "#1a1a2e", color: "#8b949e", label: "On Hold" },
  };
  const s = map[status] ?? map.IN_PROGRESS;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44` }}>
      {s.label}
    </span>
  );
}

function LogCard({ log, onClick }: { log: DailyLog; onClick: () => void }) {
  const date = new Date(log.arrivalDate);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dayStr = date.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <button onClick={onClick} className="w-full text-left rounded-xl p-4 transition-all hover:border-opacity-60"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-base font-bold" style={{ color: TEXT }}>{dateStr}</p>
          <p className="text-xs" style={{ color: MUTED }}>{dayStr}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {statusBadge(log.status)}
          {log.emailSentAt ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#0d2a1a", color: "#22c55e", border: "1px solid #22c55e44" }}>
              ✓ Sent {new Date(log.emailSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#2a1010", color: "#f87171", border: "1px solid #ef444466" }}>
              ⚠ Ready to send
            </span>
          )}
        </div>
      </div>
      {log.tasksPerformed && (
        <p className="text-sm mb-2 line-clamp-2" style={{ color: "#c9d1d9" }}>{log.tasksPerformed}</p>
      )}
      <div className="flex flex-wrap gap-3 mt-1">
        {log.weatherCondition && (
          <span className="text-xs" style={{ color: MUTED }}>
            🌤 {log.weatherCondition}{log.temperature ? ` · ${log.temperature}°F` : ""}
          </span>
        )}
        {log.employeesOnSite && (
          <span className="text-xs" style={{ color: MUTED }}>
            👷 {log.employeesOnSite.split(/[,\n]/).filter(Boolean).length} on site
          </span>
        )}
        {log.weatherDelay && <span className="text-xs" style={{ color: "#f59e0b" }}>⚠ Weather delay</span>}
        {log.scheduleDelay && <span className="text-xs" style={{ color: "#ef4444" }}>⚠ Schedule delay</span>}
        {log.createdBy && <span className="text-xs" style={{ color: MUTED }}>By {log.createdBy}</span>}
      </div>
    </button>
  );
}

// ── Send Email Modal ─────────────────────────────────────────────────────────

function SendLogEmailModal({
  companyId, clientId, logId, onClose,
}: { companyId: string; clientId: string; logId: string; onClose: () => void }) {
  const MY_EMAIL = "mikebaruh@gmail.com";
  const [to, setTo] = useState("");
  const [cc, setCc] = useState(MY_EMAIL);
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch(`/api/${companyId}/clients/${clientId}/daily-logs/${logId}/send-email`)
      .then(r => r.json())
      .then(d => {
        setTo(d.to ?? "");
        setSubject(d.defaultSubject ?? "");
        setBody(d.defaultBody ?? "");
        setPhotoCount(d.photoCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, [companyId, clientId, logId]);

  async function send() {
    if (!to.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/daily-logs/${logId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), cc: cc.trim() || undefined, bcc: bcc.trim() || undefined, subject, body }),
      });
      const text = await res.text();
      let data: { error?: string; photoLoaded?: number; photoTotal?: number } = {};
      try { data = JSON.parse(text); } catch { /* response wasn't JSON */ }
      if (res.ok) {
        const { photoLoaded, photoTotal } = data as { photoLoaded: number; photoTotal: number };
        const photoMsg = photoTotal > 0
          ? ` · ${photoLoaded}/${photoTotal} photos included`
          : "";
        setResult({ ok: true, msg: `Email sent!${photoMsg}` });
        setTimeout(() => onClose(), 2500);
      } else {
        const snippet = text.slice(0, 300).replace(/<[^>]+>/g, " ").trim();
        setResult({ ok: false, msg: data.error ?? `HTTP ${res.status}: ${snippet || res.statusText}` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, msg: `Network/fetch error: ${msg}` });
    } finally { setSending(false); }
  }

  const inputStyle = { background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 overflow-y-auto" style={{ background: CARD, border: `1px solid ${BORDER}`, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold" style={{ color: TEXT }}>Send Daily Log PDF</p>
          <button onClick={onClose} style={{ color: MUTED, fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <p className="text-sm py-4 text-center" style={{ color: MUTED }}>Loading…</p>
        ) : (
          <>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: MUTED }}>To</label>
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="client@email.com"
                className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: MUTED }}>CC</label>
              <input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@email.com"
                className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: MUTED }}>BCC</label>
              <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@email.com (optional)"
                className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: MUTED }}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: MUTED }}>Message</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={12}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </>
        )}

        {result && (
          <p className="text-sm font-medium px-3 py-2 rounded-lg" style={{ background: result.ok ? "#0d2a1a" : "#2a1010", color: result.ok ? "#22c55e" : "#ef4444" }}>
            {result.msg}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={send}
            disabled={sending || loading || !to.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            {sending
              ? photoCount > 0 ? `Generating PDF with ${photoCount} photo${photoCount > 1 ? "s" : ""}…` : "Sending…"
              : photoCount > 0 ? `Send Email + PDF (${photoCount} photo${photoCount > 1 ? "s" : ""})` : "Send Email + PDF"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm"
            style={{ background: "#30373f", color: TEXT }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DailyLogsTab({
  companyId,
  clientId,
  clientName,
  clientEmail,
  initialLogs,
  initialDailyLogEmailEnabled,
  canEdit,
}: {
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  initialLogs: DailyLog[];
  initialDailyLogEmailEnabled?: boolean;
  canEdit: boolean;
}) {
  const [logs, setLogs] = useState<DailyLog[]>(initialLogs);
  const [editing, setEditing] = useState<DailyLog | null | "new">(null);
  const [search, setSearch] = useState("");
  const [autoSend, setAutoSend] = useState(initialDailyLogEmailEnabled ?? false);
  const [togglingAutoSend, setTogglingAutoSend] = useState(false);
  const [sendingLogId, setSendingLogId] = useState<string | null>(null);

  function handleSaved(log: DailyLog) {
    setLogs(prev => {
      const idx = prev.findIndex(l => l.id === log.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = log; return next; }
      return [log, ...prev];
    });
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this daily log?")) return;
    await fetch(`/api/${companyId}/clients/${clientId}/daily-logs/${id}`, { method: "DELETE" });
    setLogs(prev => prev.filter(l => l.id !== id));
  }

  async function toggleAutoSend() {
    setTogglingAutoSend(true);
    const next = !autoSend;
    try {
      await fetch(`/api/${companyId}/clients/${clientId}/daily-log-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLogEmailEnabled: next }),
      });
      setAutoSend(next);
    } finally { setTogglingAutoSend(false); }
  }

  if (editing !== null) {
    return (
      <LogEditor
        companyId={companyId}
        clientId={clientId}
        clientName={clientName}
        initial={editing === "new" ? null : editing}
        onSave={handleSaved}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.tasksPerformed ?? "").toLowerCase().includes(q) ||
      new Date(l.arrivalDate).toLocaleDateString().includes(q) ||
      (l.status ?? "").toLowerCase().includes(q) ||
      (l.employeesOnSite ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {sendingLogId && (
        <SendLogEmailModal
          companyId={companyId}
          clientId={clientId}
          logId={sendingLogId}
          onClose={() => setSendingLogId(null)}
        />
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: MUTED }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search daily logs…"
            className="w-full rounded-xl pl-8 pr-3 py-2 text-sm"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
        </div>

        {/* Auto-send toggle */}
        <button onClick={toggleAutoSend} disabled={togglingAutoSend}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all disabled:opacity-50"
          style={{ background: autoSend ? "#0d2a1a" : CARD, border: `1px solid ${autoSend ? "#22c55e66" : BORDER}`, color: autoSend ? "#22c55e" : MUTED }}>
          <span className={`w-7 h-4 rounded-full flex items-center transition-colors ${autoSend ? "justify-end" : "justify-start"}`}
            style={{ background: autoSend ? "#22c55e" : "#30373f", padding: "2px" }}>
            <span className="w-3 h-3 rounded-full bg-white block" />
          </span>
          Auto-send to client
        </button>

        {canEdit && (
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shrink-0 transition-opacity hover:opacity-80"
            style={{ background: GOLD, color: "#0d1117" }}>
            + New Log
          </button>
        )}
      </div>

      {autoSend && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#0d2a1a", color: "#22c55e", border: "1px solid #22c55e33" }}>
          Auto-send is ON — each saved log will be emailed to {clientEmail ?? "the client"} automatically.
        </p>
      )}

      {/* Log list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm font-semibold mb-1" style={{ color: TEXT }}>{search ? "No logs match your search" : "No daily logs yet"}</p>
          <p className="text-xs" style={{ color: MUTED }}>{search ? "Try a different search" : "Tap '+ New Log' to create the first one"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const pdfBase = `/api/${companyId}/clients/${clientId}/daily-logs/${log.id}/pdf`;
            return (
              <div key={log.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                <LogCard log={log} onClick={() => setEditing(log)} />
                {/* Action bar */}
                <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#0d1117", borderTop: `1px solid ${BORDER}` }}>
                  <a href={pdfBase} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}>
                    View PDF
                  </a>
                  <a href={`${pdfBase}?download=1`} download
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}>
                    Download
                  </a>
                  <button onClick={() => setSendingLogId(log.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80"
                    style={{ background: GOLD + "22", color: GOLD, border: `1px solid ${GOLD}44` }}>
                    Send
                  </button>
                  {canEdit && (
                    <button onClick={() => handleDelete(log.id)}
                      className="ml-auto text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
                      style={{ color: "#ef4444", background: "#2a1010", border: "1px solid #ef444433" }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
