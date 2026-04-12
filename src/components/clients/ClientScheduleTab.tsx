"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { differenceInDays, addDays, format } from "date-fns";

const GOLD = "#C9A84C";
const CELL_WIDTH = 28;
const ROW_HEIGHT = 36;
const PHASE_ROW_HEIGHT = 28;
const LABEL_WIDTH = 240;
const HEADER_H = 22;
const RESIZE_HANDLE_W = 8;

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: GOLD,
  IN_PROGRESS: "#3b82f6",
  DONE: "#22c55e",
  BLOCKED: "#f97316",
};
const STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"];

const INPUT: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #30373f",
  color: "#e6edf3",
  WebkitTextFillColor: "#e6edf3",
  colorScheme: "dark",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  width: "100%",
};

type ClientTask = {
  id: string;
  phase: string;
  name: string;
  durationDays: number;
  startDate: string | null;
  endDate: string | null;
  predecessorIds: string[];
  parentId: string | null;
  trade: string | null;
  assignee: string | null;
  isMilestone: boolean;
  status: string;
  percentComplete: number;
  notes: string | null;
};

type DragState = {
  taskId: string;
  type: "move" | "resize";
  originalStart: Date;
  originalEnd: Date;
  mouseStartX: number;
  currentDeltaDays: number;
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

// ── Schedule Templates ─────────────────────────────────────────────────────────

type TplTask = { phase: string; name: string; durationDays: number; offsetDays: number; trade?: string; isMilestone?: boolean };
type ScheduleTemplate = { id: string; label: string; emoji: string; description: string; tasks: TplTask[] };

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "roofing",
    label: "Roofing Replacement",
    emoji: "🏠",
    description: "Full tear-off & reroof · ~4 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 5, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Material Order – Shingles & Underlayment", durationDays: 5, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Crew Scheduling", durationDays: 2, offsetDays: 0 },
      { phase: "Removal", name: "Tear-Off Old Roofing", durationDays: 2, offsetDays: 7, trade: "Roofing" },
      { phase: "Removal", name: "Deck Inspection", durationDays: 1, offsetDays: 9, trade: "Roofing" },
      { phase: "Removal", name: "Deck Repairs", durationDays: 2, offsetDays: 10, trade: "Roofing" },
      { phase: "Installation", name: "Underlayment & Ice Shield", durationDays: 1, offsetDays: 12, trade: "Roofing" },
      { phase: "Installation", name: "Shingle Installation", durationDays: 3, offsetDays: 13, trade: "Roofing" },
      { phase: "Installation", name: "Ridge Cap & Flashing", durationDays: 1, offsetDays: 16, trade: "Roofing" },
      { phase: "Installation", name: "Gutters & Downspouts", durationDays: 2, offsetDays: 17, trade: "Roofing" },
      { phase: "Closeout", name: "Final Inspection", durationDays: 1, offsetDays: 21, isMilestone: true },
      { phase: "Closeout", name: "Site Cleanup", durationDays: 1, offsetDays: 21 },
      { phase: "Closeout", name: "Customer Walkthrough", durationDays: 1, offsetDays: 22, isMilestone: true },
    ],
  },
  {
    id: "bathroom",
    label: "Bathroom Remodel",
    emoji: "🚿",
    description: "Full gut & remodel · ~6 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Design & Selections", durationDays: 7, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Material & Fixture Order", durationDays: 10, offsetDays: 0 },
      { phase: "Demo", name: "Demolition", durationDays: 2, offsetDays: 10, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal", durationDays: 1, offsetDays: 12 },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 3, offsetDays: 13, trade: "Plumbing" },
      { phase: "Rough-In", name: "Rough Electrical", durationDays: 2, offsetDays: 13, trade: "Electrical" },
      { phase: "Rough-In", name: "Backer Board / Cement Board", durationDays: 2, offsetDays: 16, trade: "Drywall" },
      { phase: "Finishes", name: "Tile – Shower & Floor", durationDays: 5, offsetDays: 18, trade: "Tile" },
      { phase: "Finishes", name: "Drywall & Painting", durationDays: 4, offsetDays: 18, trade: "Drywall" },
      { phase: "Finishes", name: "Vanity & Mirror Install", durationDays: 2, offsetDays: 23, trade: "Carpenter" },
      { phase: "Finishes", name: "Glass Shower Door", durationDays: 2, offsetDays: 25, trade: "Glass" },
      { phase: "Final", name: "Plumbing Fixtures", durationDays: 1, offsetDays: 27, trade: "Plumbing" },
      { phase: "Final", name: "Electrical Fixtures & Exhaust Fan", durationDays: 1, offsetDays: 27, trade: "Electrical" },
      { phase: "Final", name: "Final Inspection", durationDays: 1, offsetDays: 29, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 3, offsetDays: 30 },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen Remodel",
    emoji: "🍳",
    description: "Full gut & remodel · ~10 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Design & Architectural Plans", durationDays: 10, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Cabinet & Material Order", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 10, offsetDays: 0 },
      { phase: "Demo", name: "Demolition – Cabinets & Flooring", durationDays: 2, offsetDays: 14, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal", durationDays: 1, offsetDays: 16 },
      { phase: "Rough-In", name: "Rough Plumbing Relocation", durationDays: 3, offsetDays: 17, trade: "Plumbing" },
      { phase: "Rough-In", name: "Rough Electrical – New Circuits", durationDays: 3, offsetDays: 17, trade: "Electrical" },
      { phase: "Rough-In", name: "Framing Changes", durationDays: 2, offsetDays: 17, trade: "Framing" },
      { phase: "Drywall", name: "Drywall Hang", durationDays: 3, offsetDays: 20, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Finish & Prime", durationDays: 4, offsetDays: 23, trade: "Drywall" },
      { phase: "Finishes", name: "Tile Flooring", durationDays: 4, offsetDays: 27, trade: "Tile" },
      { phase: "Finishes", name: "Painting", durationDays: 3, offsetDays: 27, trade: "Painter" },
      { phase: "Finishes", name: "Cabinet Installation", durationDays: 5, offsetDays: 31, trade: "Carpenter" },
      { phase: "Finishes", name: "Countertop Template & Install", durationDays: 5, offsetDays: 36, trade: "Countertops" },
      { phase: "Finishes", name: "Tile Backsplash", durationDays: 3, offsetDays: 41, trade: "Tile" },
      { phase: "Final", name: "Appliance Installation", durationDays: 2, offsetDays: 44, trade: "Appliances" },
      { phase: "Final", name: "Plumbing Fixtures & Hookup", durationDays: 1, offsetDays: 46, trade: "Plumbing" },
      { phase: "Final", name: "Electrical Fixtures & Panel", durationDays: 1, offsetDays: 46, trade: "Electrical" },
      { phase: "Final", name: "Final Inspection", durationDays: 1, offsetDays: 48, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 4, offsetDays: 49 },
    ],
  },
  {
    id: "addition",
    label: "Home Addition",
    emoji: "🏗️",
    description: "New room addition · ~20 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Architectural Drawings", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Structural Engineering", durationDays: 7, offsetDays: 14 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 14, offsetDays: 21 },
      { phase: "Pre-Construction", name: "Material Procurement", durationDays: 21, offsetDays: 21 },
      { phase: "Site Work", name: "Site Preparation & Layout", durationDays: 2, offsetDays: 35, trade: "Site Work" },
      { phase: "Site Work", name: "Excavation", durationDays: 3, offsetDays: 37, trade: "Site Work" },
      { phase: "Foundation", name: "Footings – Form & Pour", durationDays: 3, offsetDays: 40, trade: "Concrete" },
      { phase: "Foundation", name: "Foundation Walls", durationDays: 5, offsetDays: 43, trade: "Concrete" },
      { phase: "Foundation", name: "Foundation Cure & Waterproofing", durationDays: 7, offsetDays: 48, trade: "Concrete" },
      { phase: "Framing", name: "Floor System", durationDays: 4, offsetDays: 55, trade: "Framing" },
      { phase: "Framing", name: "Wall Framing", durationDays: 7, offsetDays: 59, trade: "Framing" },
      { phase: "Framing", name: "Roof Framing & Sheathing", durationDays: 7, offsetDays: 66, trade: "Framing" },
      { phase: "Framing", name: "Windows & Exterior Doors", durationDays: 3, offsetDays: 66, trade: "Windows" },
      { phase: "Rough-In", name: "Rough Electrical", durationDays: 5, offsetDays: 73, trade: "Electrical" },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 5, offsetDays: 73, trade: "Plumbing" },
      { phase: "Rough-In", name: "HVAC Rough", durationDays: 4, offsetDays: 73, trade: "HVAC" },
      { phase: "Rough-In", name: "Insulation", durationDays: 3, offsetDays: 78, trade: "Insulation" },
      { phase: "Exterior", name: "Roofing", durationDays: 5, offsetDays: 73, trade: "Roofing" },
      { phase: "Exterior", name: "Exterior Siding / Stucco", durationDays: 7, offsetDays: 81, trade: "Siding" },
      { phase: "Exterior", name: "Exterior Paint", durationDays: 3, offsetDays: 88, trade: "Painter" },
      { phase: "Drywall", name: "Drywall Hang", durationDays: 5, offsetDays: 81, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Finish", durationDays: 5, offsetDays: 86, trade: "Drywall" },
      { phase: "Finishes", name: "Flooring", durationDays: 7, offsetDays: 91, trade: "Flooring" },
      { phase: "Finishes", name: "Interior Paint", durationDays: 5, offsetDays: 91, trade: "Painter" },
      { phase: "Finishes", name: "Trim & Millwork", durationDays: 5, offsetDays: 98, trade: "Carpenter" },
      { phase: "Finishes", name: "Cabinets & Countertops", durationDays: 5, offsetDays: 103, trade: "Carpenter" },
      { phase: "Final", name: "Final Electrical", durationDays: 3, offsetDays: 108, trade: "Electrical" },
      { phase: "Final", name: "Final Plumbing", durationDays: 2, offsetDays: 108, trade: "Plumbing" },
      { phase: "Final", name: "HVAC Final", durationDays: 2, offsetDays: 108, trade: "HVAC" },
      { phase: "Final", name: "Final Inspection", durationDays: 1, offsetDays: 113, isMilestone: true },
      { phase: "Final", name: "Punch List & Closeout", durationDays: 5, offsetDays: 114 },
    ],
  },
  {
    id: "renovation",
    label: "Full Interior Renovation",
    emoji: "🔨",
    description: "Full gut renovation · ~14 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Design & Selections", durationDays: 10, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Material & Fixture Orders", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 10, offsetDays: 0 },
      { phase: "Demo", name: "Full Demolition", durationDays: 5, offsetDays: 14, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal & Haul-Away", durationDays: 2, offsetDays: 19, trade: "Demo" },
      { phase: "Rough-In", name: "Rough Electrical – Full Rewire", durationDays: 7, offsetDays: 21, trade: "Electrical" },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 5, offsetDays: 21, trade: "Plumbing" },
      { phase: "Rough-In", name: "HVAC Ductwork & Rough", durationDays: 5, offsetDays: 21, trade: "HVAC" },
      { phase: "Rough-In", name: "Framing Changes", durationDays: 5, offsetDays: 21, trade: "Framing" },
      { phase: "Rough-In", name: "Insulation", durationDays: 4, offsetDays: 28, trade: "Insulation" },
      { phase: "Rough-In", name: "Inspections – Rough", durationDays: 1, offsetDays: 32, isMilestone: true },
      { phase: "Drywall", name: "Drywall Hang", durationDays: 7, offsetDays: 33, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Finish – 3 Coats", durationDays: 7, offsetDays: 40, trade: "Drywall" },
      { phase: "Finishes", name: "Flooring – All Areas", durationDays: 10, offsetDays: 47, trade: "Flooring" },
      { phase: "Finishes", name: "Interior Paint – Full House", durationDays: 10, offsetDays: 47, trade: "Painter" },
      { phase: "Finishes", name: "Tile – Kitchen & Baths", durationDays: 7, offsetDays: 47, trade: "Tile" },
      { phase: "Finishes", name: "Cabinets – Kitchen", durationDays: 5, offsetDays: 57, trade: "Carpenter" },
      { phase: "Finishes", name: "Countertops", durationDays: 5, offsetDays: 62, trade: "Countertops" },
      { phase: "Finishes", name: "Trim, Doors & Millwork", durationDays: 7, offsetDays: 57, trade: "Carpenter" },
      { phase: "Final", name: "Final Electrical & Fixtures", durationDays: 4, offsetDays: 67, trade: "Electrical" },
      { phase: "Final", name: "Final Plumbing & Fixtures", durationDays: 3, offsetDays: 67, trade: "Plumbing" },
      { phase: "Final", name: "HVAC Final & Balancing", durationDays: 2, offsetDays: 67, trade: "HVAC" },
      { phase: "Final", name: "Appliance Install", durationDays: 2, offsetDays: 71, trade: "Appliances" },
      { phase: "Final", name: "Final Inspections", durationDays: 1, offsetDays: 73, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 5, offsetDays: 74 },
      { phase: "Final", name: "Deep Clean & Move-In Ready", durationDays: 2, offsetDays: 79 },
    ],
  },
  {
    id: "commercial",
    label: "Commercial Build-Out",
    emoji: "🏢",
    description: "Office / retail build-out · ~22 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Space Planning & Design", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Architectural & Engineering Drawings", durationDays: 21, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 21, offsetDays: 21 },
      { phase: "Pre-Construction", name: "Material & Equipment Procurement", durationDays: 21, offsetDays: 21 },
      { phase: "Demo", name: "Demolition – Existing Build-Out", durationDays: 7, offsetDays: 42, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal", durationDays: 2, offsetDays: 49, trade: "Demo" },
      { phase: "Rough-In", name: "Structural – New Walls & Openings", durationDays: 10, offsetDays: 51, trade: "Framing" },
      { phase: "Rough-In", name: "Rough Electrical – New Service", durationDays: 10, offsetDays: 51, trade: "Electrical" },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 7, offsetDays: 51, trade: "Plumbing" },
      { phase: "Rough-In", name: "HVAC Ductwork", durationDays: 10, offsetDays: 51, trade: "HVAC" },
      { phase: "Rough-In", name: "Fire Sprinkler Rough", durationDays: 7, offsetDays: 51, trade: "Fire Suppression" },
      { phase: "Rough-In", name: "Low Voltage – Data & A/V Rough", durationDays: 5, offsetDays: 51, trade: "Low Voltage" },
      { phase: "Rough-In", name: "Rough Inspections", durationDays: 1, offsetDays: 62, isMilestone: true },
      { phase: "Drywall", name: "Insulation", durationDays: 4, offsetDays: 63, trade: "Insulation" },
      { phase: "Drywall", name: "Drywall Hang & Finish", durationDays: 14, offsetDays: 67, trade: "Drywall" },
      { phase: "Finishes", name: "Flooring – LVT / Carpet / Tile", durationDays: 10, offsetDays: 81, trade: "Flooring" },
      { phase: "Finishes", name: "Paint & Wall Finishes", durationDays: 10, offsetDays: 81, trade: "Painter" },
      { phase: "Finishes", name: "Acoustical Ceiling", durationDays: 7, offsetDays: 81, trade: "Ceiling" },
      { phase: "Finishes", name: "Storefront & Glass", durationDays: 5, offsetDays: 81, trade: "Glass" },
      { phase: "Finishes", name: "Interior Doors & Hardware", durationDays: 5, offsetDays: 91, trade: "Carpenter" },
      { phase: "Finishes", name: "Millwork & Casework", durationDays: 7, offsetDays: 91, trade: "Carpenter" },
      { phase: "Final", name: "Final Electrical & Fixtures", durationDays: 5, offsetDays: 98, trade: "Electrical" },
      { phase: "Final", name: "Final Plumbing & Fixtures", durationDays: 3, offsetDays: 98, trade: "Plumbing" },
      { phase: "Final", name: "HVAC Final & Balancing", durationDays: 4, offsetDays: 98, trade: "HVAC" },
      { phase: "Final", name: "Low Voltage – Terminations", durationDays: 4, offsetDays: 98, trade: "Low Voltage" },
      { phase: "Final", name: "Sprinkler Final", durationDays: 2, offsetDays: 102, trade: "Fire Suppression" },
      { phase: "Final", name: "Final Building Inspection", durationDays: 1, offsetDays: 105, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 7, offsetDays: 106 },
      { phase: "Final", name: "Certificate of Occupancy", durationDays: 1, offsetDays: 113, isMilestone: true },
    ],
  },
];

// ── Load Template Modal ────────────────────────────────────────────────────────

function LoadTemplateModal({
  companyId,
  clientId,
  onLoaded,
  onClose,
}: {
  companyId: string;
  clientId: string;
  onLoaded: (tasks: ClientTask[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ScheduleTemplate | null>(null);
  const [startDate, setStartDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    if (!selected) return;
    setLoading(true);
    const base = parseDate(startDate) ?? new Date();
    const created: ClientTask[] = [];
    for (const t of selected.tasks) {
      const start = addDays(base, t.offsetDays);
      const end = addDays(start, t.durationDays - 1);
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: t.phase,
          name: t.name,
          durationDays: t.durationDays,
          startDate: toDateStr(start),
          endDate: toDateStr(end),
          trade: t.trade ?? null,
          isMilestone: t.isMilestone ?? false,
        }),
      });
      const task = await res.json();
      created.push(task);
    }
    setLoading(false);
    onLoaded(created);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 16, padding: 24, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: "#e6edf3" }}>Load Schedule Template</h3>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
        </div>

        {/* Template cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {SCHEDULE_TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => setSelected(tpl)}
              className="text-left p-3 rounded-xl transition-all"
              style={{
                background: selected?.id === tpl.id ? "#1e2736" : "#0d1117",
                border: `1px solid ${selected?.id === tpl.id ? GOLD : "#30373f"}`,
              }}>
              <div className="text-xl mb-1">{tpl.emoji}</div>
              <div className="text-sm font-semibold" style={{ color: selected?.id === tpl.id ? GOLD : "#e6edf3" }}>{tpl.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{tpl.description}</div>
              <div className="text-[10px] mt-1" style={{ color: "#484f58" }}>{tpl.tasks.length} tasks · {new Set(tpl.tasks.map(t => t.phase)).size} phases</div>
            </button>
          ))}
        </div>

        {selected && (
          <>
            {/* Phase preview */}
            <div className="mb-4 rounded-xl p-3 text-xs" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
              <div className="font-semibold mb-2" style={{ color: "#8b949e" }}>Phases: {Array.from(new Set(selected.tasks.map(t => t.phase))).join(" → ")}</div>
              <div className="flex flex-wrap gap-1">
                {selected.tasks.filter(t => t.isMilestone).map(t => (
                  <span key={t.name} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: "#1e2736", color: "#7c3aed", border: "1px solid #7c3aed44" }}>◆ {t.name}</span>
                ))}
              </div>
            </div>

            {/* Start date */}
            <div className="mb-4">
              <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>Project Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ ...INPUT, width: 180 }} />
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button onClick={handleLoad} disabled={!selected || loading}
            className="flex-1 py-2 text-sm font-semibold rounded-xl disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}>
            {loading ? `Loading… (${selected?.tasks.length} tasks)` : `Load ${selected?.label ?? "Template"}`}
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm rounded-xl" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  task, allTasks, companyId, clientId, onSave, onDelete, onClose,
}: {
  task: ClientTask; allTasks: ClientTask[]; companyId: string; clientId: string;
  onSave: (updated: ClientTask) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: task.name, phase: task.phase,
    durationDays: String(task.durationDays),
    startDate: task.startDate ?? "", endDate: task.endDate ?? "",
    trade: task.trade ?? "", assignee: task.assignee ?? "",
    status: task.status, percentComplete: String(task.percentComplete),
    isMilestone: task.isMilestone, parentId: task.parentId ?? "",
    predecessorIds: task.predecessorIds, notes: task.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parent = allTasks.find(t => t.id === form.parentId);
  const children = allTasks.filter(t => t.parentId === task.id);

  function togglePredecessor(id: string) {
    setForm(f => ({ ...f, predecessorIds: f.predecessorIds.includes(id) ? f.predecessorIds.filter(p => p !== id) : [...f.predecessorIds, id] }));
  }

  async function handleSave() {
    setSaving(true);
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const body = {
      name: form.name.trim(), phase: form.phase.trim() || "General",
      durationDays: dur, startDate: form.startDate || null, endDate: form.endDate || null,
      trade: form.trade.trim() || null, assignee: form.assignee.trim() || null,
      status: form.status, percentComplete: Math.min(100, Math.max(0, parseInt(form.percentComplete) || 0)),
      isMilestone: form.isMilestone, parentId: form.parentId || null,
      predecessorIds: form.predecessorIds, notes: form.notes.trim() || null,
    };
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const updated = await res.json();
      onSave({ ...task, ...updated });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, { method: "DELETE" });
    onDelete(task.id);
  }

  const otherTasks = allTasks.filter(t => t.id !== task.id);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Edit Task</h3>
          <div className="flex gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
                <button onClick={handleDelete} className="text-xs px-2 py-1 rounded font-bold" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1 rounded" style={{ background: "#2d1b1b", color: "#f87171" }}>Delete</button>
            )}
            <button onClick={onClose} className="text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Task Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} className="outline-none" autoFocus />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase</label>
              <input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} style={INPUT} className="outline-none" placeholder="General" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Duration (days)</label>
              <input type="number" min="1" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Trade</label>
              <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} style={INPUT} className="outline-none" placeholder="e.g. Framing" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Assignee</label>
              <input value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} style={INPUT} className="outline-none" placeholder="e.g. Crew A" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...INPUT, cursor: "pointer", appearance: "none" }} className="outline-none">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>% Complete</label>
              <input type="number" min="0" max="100" value={form.percentComplete} onChange={e => setForm(f => ({ ...f, percentComplete: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Parent Task</label>
            <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} style={{ ...INPUT, cursor: "pointer", appearance: "none" }} className="outline-none">
              <option value="">— None —</option>
              {otherTasks.map(t => <option key={t.id} value={t.id}>{t.phase} / {t.name}</option>)}
            </select>
            {parent && (
              <div className="mt-1 text-[10px] px-2 py-1 rounded" style={{ background: "#1e2736", color: "#8b949e" }}>
                Parent: <strong style={{ color: GOLD }}>{parent.phase} / {parent.name}</strong>
              </div>
            )}
            {children.length > 0 && (
              <div className="mt-1 text-[10px] px-2 py-1 rounded" style={{ background: "#1e2736", color: "#8b949e" }}>
                Sub-tasks: {children.map(c => <strong key={c.id} style={{ color: "#94a3b8" }}> {c.name}</strong>)}
              </div>
            )}
          </div>

          {otherTasks.length > 0 && (
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Dependencies (predecessors)</label>
              <div className="flex flex-wrap gap-1.5">
                {otherTasks.map(t => {
                  const sel = form.predecessorIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => togglePredecessor(t.id)} className="text-[10px] px-2 py-1 rounded font-medium"
                      style={{ background: sel ? "#C9A84C22" : "#1e2736", border: `1px solid ${sel ? GOLD : "#30373f"}`, color: sel ? GOLD : "#8b949e" }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs" style={{ color: "#8b949e" }}>
            <input type="checkbox" checked={form.isMilestone} onChange={e => setForm(f => ({ ...f, isMilestone: e.target.checked }))} />
            Milestone
          </label>

          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...INPUT, resize: "none" }} className="outline-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={handleSave} disabled={!form.name.trim() || saving} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Task Modal ─────────────────────────────────────────────────────────────

function AddTaskModal({ companyId, clientId, phases, onCreate, onClose }: {
  companyId: string; clientId: string; phases: string[];
  onCreate: (task: ClientTask) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ name: "", phase: phases[0] ?? "General", durationDays: "5", startDate: todayStr(), trade: "", assignee: "" });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const start = form.startDate ? new Date(form.startDate + "T00:00:00") : new Date();
    const end = addDays(start, dur - 1);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), phase: form.phase.trim() || "General", durationDays: dur, startDate: toDateStr(start), endDate: toDateStr(end), trade: form.trade.trim() || null, assignee: form.assignee.trim() || null }),
      });
      const task = await res.json();
      onCreate(task);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440 }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-4" style={{ color: "#e6edf3" }}>Add Task</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Task Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} className="outline-none" autoFocus onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase</label>
              <input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} style={INPUT} className="outline-none" list="phase-list" />
              <datalist id="phase-list">{phases.map(p => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Duration (days)</label>
              <input type="number" min="1" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Trade</label>
              <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} style={INPUT} className="outline-none" placeholder="Optional" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleCreate} disabled={!form.name.trim() || saving} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Adding…" : "Add Task"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Gantt Chart ────────────────────────────────────────────────────────────────

function ClientGanttChart({ tasks, projectStart, companyId, clientId, canEdit, onTasksChange }: {
  tasks: ClientTask[]; projectStart: Date; companyId: string; clientId: string; canEdit: boolean; onTasksChange: (tasks: ClientTask[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<ClientTask | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track last click for double-click detection
  const lastClickRef = useRef<{ time: number; taskId: string } | null>(null);

  const toggle = (phase: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(phase)) next.delete(phase); else next.add(phase);
    return next;
  });

  const phases = useMemo(() => {
    const map = new Map<string, ClientTask[]>();
    for (const t of tasks) { const arr = map.get(t.phase) ?? []; arr.push(t); map.set(t.phase, arr); }
    return map;
  }, [tasks]);

  const projectEnd = useMemo(() => {
    const dates = tasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]).filter(Boolean) as Date[];
    if (!dates.length) return addDays(projectStart, 30);
    return dates.reduce((max, d) => (d > max ? d : max), dates[0]);
  }, [tasks, projectStart]);

  const totalDays = differenceInDays(projectEnd, projectStart) + 8;
  const today = useMemo(() => new Date(), []);

  const months: { label: string; startDay: number; days: number }[] = [];
  let cursor = new Date(projectStart);
  while (cursor <= projectEnd) {
    const startDay = differenceInDays(cursor, projectStart);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const end = monthEnd < projectEnd ? monthEnd : projectEnd;
    const days = differenceInDays(end, cursor) + 1;
    months.push({ label: format(cursor, "MMM yyyy"), startDay, days });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  type Row = { kind: "phase"; phase: string; phaseTasks: ClientTask[] } | { kind: "task"; task: ClientTask; rowNum: number };
  const rows: Row[] = [];
  let rowNum = 0;
  for (const [phase, phaseTasks] of Array.from(phases.entries())) {
    rows.push({ kind: "phase", phase, phaseTasks });
    if (!collapsed.has(phase)) {
      for (const task of phaseTasks) { rows.push({ kind: "task", task, rowNum }); rowNum++; }
    }
  }

  let yOffset = HEADER_H;
  const rowYs: number[] = [];
  for (const row of rows) { rowYs.push(yOffset); yOffset += row.kind === "phase" ? PHASE_ROW_HEIGHT : ROW_HEIGHT; }
  const svgHeight = yOffset + 30;
  const svgWidth = LABEL_WIDTH + totalDays * CELL_WIDTH;

  const getSvgX = useCallback((clientX: number) => {
    if (!svgRef.current) return 0;
    return clientX - svgRef.current.getBoundingClientRect().left;
  }, []);

  // ── Drag via document-level events ──────────────────────────────────────────
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const deltaX = getSvgX(e.clientX) - d.mouseStartX;
      const deltaDays = Math.round(deltaX / CELL_WIDTH);
      setDrag(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null);
    }
    async function onUp() {
      const d = dragRef.current;
      if (!d) { setDrag(null); return; }
      if (d.currentDeltaDays === 0) { setDrag(null); return; }
      const { taskId, type, originalStart, originalEnd, currentDeltaDays } = d;
      setDrag(null);
      let newStart: Date, newEnd: Date;
      if (type === "move") { newStart = addDays(originalStart, currentDeltaDays); newEnd = addDays(originalEnd, currentDeltaDays); }
      else { newStart = originalStart; newEnd = addDays(originalEnd, currentDeltaDays); if (newEnd <= newStart) newEnd = newStart; }
      const durationDays = Math.max(1, differenceInDays(newEnd, newStart) + 1);
      setSaving(taskId);
      try {
        const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${taskId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: toDateStr(newStart), endDate: toDateStr(newEnd), durationDays }),
        });
        const updated = await res.json();
        onTasksChange(tasks.map(t => t.id === taskId ? { ...t, ...updated } : t));
      } finally { setSaving(null); }
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [drag, getSvgX, companyId, clientId, tasks, onTasksChange]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, task: ClientTask, type: "move" | "resize") => {
    if (!canEdit || task.isMilestone) return;
    e.preventDefault();
    e.stopPropagation();
    const start = parseDate(task.startDate) ?? today;
    const end = parseDate(task.endDate) ?? addDays(start, task.durationDays - 1);
    setDrag({ taskId: task.id, type, originalStart: start, originalEnd: end, mouseStartX: getSvgX(e.clientX), currentDeltaDays: 0 });
  }, [canEdit, getSvgX, today]);

  // ── Double-click via manual timing ─────────────────────────────────────────
  const handleBarClick = useCallback((task: ClientTask) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.taskId === task.id && now - last.time < 350) {
      lastClickRef.current = null;
      setEditTask(task);
    } else {
      lastClickRef.current = { time: now, taskId: task.id };
    }
  }, []);

  return (
    <>
      <div className="overflow-x-auto select-none" style={{ cursor: drag ? "grabbing" : "default" }}>
        <svg ref={svgRef} width={svgWidth} height={svgHeight} style={{ display: "block" }}>
          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#0d1117" />

          {/* Month headers */}
          {months.map(m => (
            <g key={m.label}>
              <rect x={LABEL_WIDTH + m.startDay * CELL_WIDTH} y={0} width={m.days * CELL_WIDTH} height={HEADER_H} fill="#161b22" stroke="#30373f" strokeWidth={0.5} />
              <text x={LABEL_WIDTH + m.startDay * CELL_WIDTH + 6} y={15} fontSize={10} fill="#8b949e" fontWeight={600}>{m.label}</text>
            </g>
          ))}

          {/* Weekend shading */}
          {Array.from({ length: totalDays }).map((_, d) => {
            const date = addDays(projectStart, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return <rect key={d} x={LABEL_WIDTH + d * CELL_WIDTH} y={HEADER_H} width={CELL_WIDTH} height={svgHeight - HEADER_H - 30} fill={isWeekend ? "#0a0e14" : "transparent"} />;
          })}
          {Array.from({ length: totalDays }).map((_, d) => (
            <line key={`v${d}`} x1={LABEL_WIDTH + d * CELL_WIDTH} y1={HEADER_H} x2={LABEL_WIDTH + d * CELL_WIDTH} y2={svgHeight - 30} stroke="#30373f" strokeWidth={0.5} />
          ))}

          {/* Today line */}
          {today >= projectStart && today <= addDays(projectEnd, 8) && (() => {
            const x = LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH;
            return (
              <g>
                <line x1={x} y1={0} x2={x} y2={svgHeight - 30} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" />
                <text x={x + 3} y={13} fontSize={9} fill="#ef4444">TODAY</text>
              </g>
            );
          })()}

          {/* Rows */}
          {rows.map((row, i) => {
            const y = rowYs[i];
            if (row.kind === "phase") {
              const isCollapsed = collapsed.has(row.phase);
              const phaseDates = row.phaseTasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]).filter(Boolean) as Date[];
              if (!phaseDates.length) return (
                <g key={row.phase} onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                  <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                  <text x={10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                  <text x={24} y={y + 17} fontSize={11} fill={GOLD} fontWeight={700}>{row.phase}</text>
                  <text x={24 + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58"> ({row.phaseTasks.length} tasks)</text>
                </g>
              );
              const phaseStart = phaseDates.reduce((min, d) => d < min ? d : min, phaseDates[0]);
              const phaseEnd = phaseDates.reduce((max, d) => d > max ? d : max, phaseDates[0]);
              const barX = LABEL_WIDTH + differenceInDays(phaseStart, projectStart) * CELL_WIDTH;
              const barW = Math.max((differenceInDays(phaseEnd, phaseStart) + 1) * CELL_WIDTH, CELL_WIDTH);
              const done = row.phaseTasks.filter(t => t.status === "DONE").length;
              const pct = Math.round((done / row.phaseTasks.length) * 100);
              return (
                <g key={row.phase} onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                  <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                  <text x={10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                  <text x={24} y={y + 17} fontSize={11} fill={GOLD} fontWeight={700}>{row.phase}</text>
                  <text x={24 + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58"> ({row.phaseTasks.length} tasks · {pct}%)</text>
                  <rect x={barX} y={y + 7} width={barW} height={PHASE_ROW_HEIGHT - 14} rx={3} fill="#30373f" />
                  {pct > 0 && <rect x={barX} y={y + 7} width={(barW * pct) / 100} height={PHASE_ROW_HEIGHT - 14} rx={3} fill={GOLD} opacity={0.5} />}
                </g>
              );
            }

            const { task } = row;
            const isSaving = saving === task.id;
            const isDragging = drag?.taskId === task.id;
            const deltaDays = isDragging ? drag!.currentDeltaDays : 0;
            const startDate = parseDate(task.startDate) ?? today;
            const endDate = parseDate(task.endDate) ?? addDays(startDate, task.durationDays - 1);
            const barColor = STATUS_COLORS[task.status] ?? GOLD;
            const isEven = row.rowNum % 2 === 0;
            const isChild = !!task.parentId;

            let startDay = differenceInDays(startDate, projectStart);
            let endDay = differenceInDays(endDate, projectStart);
            if (drag?.type === "move" && isDragging) { startDay += deltaDays; endDay += deltaDays; }
            if (drag?.type === "resize" && isDragging) { endDay += deltaDays; }
            const barX = LABEL_WIDTH + startDay * CELL_WIDTH;
            const barW = Math.max((endDay - startDay + 1) * CELL_WIDTH, CELL_WIDTH);

            return (
              <g key={task.id}>
                <rect x={0} y={y} width={svgWidth} height={ROW_HEIGHT} fill={isEven ? "#0d1117" : "#0a0e14"} />
                <line x1={0} y1={y + ROW_HEIGHT} x2={svgWidth} y2={y + ROW_HEIGHT} stroke="#30373f" strokeWidth={0.3} />
                <text x={isChild ? 28 : 16} y={y + ROW_HEIGHT / 2 + 4} fontSize={11} fill={task.status === "DONE" ? "#484f58" : "#e6edf3"}>
                  {task.name.length > 26 ? task.name.slice(0, 26) + "…" : task.name}
                </text>
                {task.trade && <text x={isChild ? 28 : 16} y={y + ROW_HEIGHT - 5} fontSize={9} fill="#484f58">{task.trade}</text>}
                <circle cx={isChild ? 20 : 8} cy={y + ROW_HEIGHT / 2} r={3} fill={barColor} />

                {task.isMilestone ? (
                  <polygon
                    points={`${barX},${y + 6} ${barX + 10},${y + ROW_HEIGHT / 2} ${barX},${y + ROW_HEIGHT - 6} ${barX - 10},${y + ROW_HEIGHT / 2}`}
                    fill="#7c3aed" opacity={isSaving ? 0.4 : 1}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleBarClick(task)}
                  />
                ) : (
                  <g>
                    {isDragging && drag?.type === "move" && (
                      <rect
                        x={LABEL_WIDTH + differenceInDays(startDate, projectStart) * CELL_WIDTH}
                        y={y + 9} width={barW} height={ROW_HEIGHT - 18} rx={4}
                        fill={barColor} opacity={0.15} stroke={barColor} strokeWidth={1} strokeDasharray="4,3"
                      />
                    )}
                    <rect
                      x={barX} y={y + 9} width={barW} height={ROW_HEIGHT - 18} rx={4}
                      fill={barColor} opacity={isSaving ? 0.3 : 0.75}
                      style={{ cursor: canEdit ? "grab" : "pointer" }}
                      onMouseDown={e => handleBarMouseDown(e, task, "move")}
                      onClick={() => handleBarClick(task)}
                    />
                    {task.percentComplete > 0 && (
                      <rect x={barX} y={y + 9} width={(barW * task.percentComplete) / 100} height={ROW_HEIGHT - 18} rx={4} fill={barColor} opacity={0.95} style={{ pointerEvents: "none" }} />
                    )}
                    {barW > 32 && (
                      <text x={barX + 5} y={y + ROW_HEIGHT / 2 + 4} fontSize={9} fill="#fff" opacity={0.85} style={{ pointerEvents: "none" }}>
                        {task.durationDays}d
                      </text>
                    )}
                    {canEdit && (
                      <rect
                        x={barX + barW - RESIZE_HANDLE_W} y={y + 9} width={RESIZE_HANDLE_W} height={ROW_HEIGHT - 18} rx={4}
                        fill="#fff" opacity={0.15}
                        style={{ cursor: "ew-resize" }}
                        onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, task, "resize"); }}
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${LABEL_WIDTH + 8}, ${svgHeight - 16})`}>
            {[
              { color: GOLD, label: "Not Started" }, { color: "#3b82f6", label: "In Progress" },
              { color: "#22c55e", label: "Done" }, { color: "#f97316", label: "Blocked" }, { color: "#7c3aed", label: "Milestone" },
            ].map((item, i) => (
              <g key={item.label} transform={`translate(${i * 105}, 0)`}>
                <rect x={0} y={-8} width={10} height={10} fill={item.color} rx={2} />
                <text x={13} y={0} fontSize={10} fill="#484f58">{item.label}</text>
              </g>
            ))}
          </g>
        </svg>
        {canEdit && (
          <p className="text-xs mt-1" style={{ color: "#484f58" }}>
            Drag bars to move · Drag right edge to resize · Double-click to edit
          </p>
        )}
      </div>

      {editTask && (
        <EditModal
          task={editTask} allTasks={tasks} companyId={companyId} clientId={clientId}
          onSave={updated => { onTasksChange(tasks.map(t => t.id === updated.id ? updated : t)); setEditTask(null); }}
          onDelete={id => { onTasksChange(tasks.filter(t => t.id !== id)); setEditTask(null); }}
          onClose={() => setEditTask(null)}
        />
      )}
    </>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

export default function ClientScheduleTab({ companyId, clientId, initialTasks, canEdit }: {
  companyId: string; clientId: string; initialTasks: ClientTask[]; canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<ClientTask[]>(initialTasks);
  const [adding, setAdding] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const phases = useMemo(() => Array.from(new Set(tasks.map(t => t.phase))), [tasks]);
  const projectStart = useMemo(() => {
    const dates = tasks.flatMap(t => [parseDate(t.startDate)]).filter(Boolean) as Date[];
    if (!dates.length) return new Date();
    const earliest = dates.reduce((min, d) => d < min ? d : min, dates[0]);
    return addDays(earliest, -2);
  }, [tasks]);

  const done = tasks.filter(t => t.status === "DONE").length;
  const inProgress = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const blocked = tasks.filter(t => t.status === "BLOCKED").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Schedule</h2>
          {tasks.length > 0 && (
            <div className="flex gap-4 mt-1">
              <span className="text-xs" style={{ color: "#8b949e" }}>Total: <strong style={{ color: "#e6edf3" }}>{tasks.length}</strong></span>
              <span className="text-xs" style={{ color: "#8b949e" }}>Done: <strong style={{ color: "#22c55e" }}>{done}</strong></span>
              {inProgress > 0 && <span className="text-xs" style={{ color: "#8b949e" }}>In progress: <strong style={{ color: "#3b82f6" }}>{inProgress}</strong></span>}
              {blocked > 0 && <span className="text-xs" style={{ color: "#8b949e" }}>Blocked: <strong style={{ color: "#f97316" }}>{blocked}</strong></span>}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setLoadingTemplate(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}>
              📋 Load Template
            </button>
            <button onClick={() => setAdding(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: GOLD, color: "#0d1117" }}>
              + Add Task
            </button>
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ border: "1px solid #30373f", color: "#484f58" }}>
          <p className="text-2xl mb-2">📅</p>
          <p className="text-sm font-medium mb-1" style={{ color: "#8b949e" }}>No schedule yet</p>
          {canEdit && (
            <p className="text-xs">
              Click <strong style={{ color: GOLD }}>Load Template</strong> to start from a preset, or <strong style={{ color: GOLD }}>+ Add Task</strong> to build manually.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <ClientGanttChart tasks={tasks} projectStart={projectStart} companyId={companyId} clientId={clientId} canEdit={canEdit} onTasksChange={setTasks} />
        </div>
      )}

      {adding && (
        <AddTaskModal
          companyId={companyId} clientId={clientId}
          phases={phases.length ? phases : ["Pre-Construction", "Construction", "Finishing"]}
          onCreate={task => { setTasks(prev => [...prev, task]); setAdding(false); }}
          onClose={() => setAdding(false)}
        />
      )}

      {loadingTemplate && (
        <LoadTemplateModal
          companyId={companyId} clientId={clientId}
          onLoaded={newTasks => { setTasks(prev => [...prev, ...newTasks]); setLoadingTemplate(false); }}
          onClose={() => setLoadingTemplate(false)}
        />
      )}
    </div>
  );
}
