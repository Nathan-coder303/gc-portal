export type PipelineStage = {
  id: string;
  label: string;
  color: string;
  custom?: boolean;
};

export const BASE_STAGES: PipelineStage[] = [
  { id: "TO_CALL_ASAP",        label: "To Call ASAP",        color: "#ef4444" },
  { id: "NEW_LEAD",            label: "New Lead",            color: "#3b82f6" },
  { id: "CONSULTATION_BOOKED", label: "Consultation Booked", color: "#a855f7" },
  { id: "APPOINTMENT_DONE",    label: "Appointment Done",    color: "#06b6d4" },
  { id: "ESTIMATE_SENT",       label: "Estimate Sent",       color: "#C9A84C" },
  { id: "FOLLOW_UP",           label: "Follow Up",           color: "#f97316" },
  { id: "NA1",                 label: "NA1",                 color: "#6b7280" },
  { id: "NA2",                 label: "NA2",                 color: "#6b7280" },
  { id: "NA3",                 label: "NA3",                 color: "#6b7280" },
  { id: "CLOSED_WON",          label: "Closed Won",          color: "#22c55e" },
  { id: "NOT_INTERESTED",      label: "Not Interested",      color: "#6b7280" },
];

export const PROJECT_STAGES: PipelineStage[] = [
  { id: "PERMITTING",        label: "Permitting",        color: "#3b82f6" },
  { id: "PERMIT_APPROVAL",   label: "Permit Approval",   color: "#a855f7" },
  { id: "START_OF_WORK",     label: "Start of Work",     color: "#C9A84C" },
  { id: "ROUGH_INSPECTIONS", label: "Rough Inspections", color: "#f97316" },
  { id: "FINAL_INSPECTIONS", label: "Final Inspections", color: "#22c55e" },
];

export const STAGE_COLORS = [
  "#3b82f6", "#06b6d4", "#a855f7", "#ec4899",
  "#C9A84C", "#f97316", "#ef4444", "#22c55e",
  "#14b8a6", "#8b5cf6", "#6b7280", "#f59e0b",
];

// ─── Leads pipeline ───────────────────────────────────────────────────────────
const LEADS_KEY = "gc_pipeline_stages_v2";

export function loadStages(): PipelineStage[] {
  if (typeof window === "undefined") return BASE_STAGES;
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    if (raw) return JSON.parse(raw) as PipelineStage[];
    // Migrate from old keys
    return _migrateLeads();
  } catch { return BASE_STAGES; }
}

function _migrateLeads(): PipelineStage[] {
  try {
    const customRaw = localStorage.getItem("gc_pipeline_custom_stages");
    const orderRaw  = localStorage.getItem("gc_pipeline_stage_order");
    const custom: PipelineStage[] = customRaw ? JSON.parse(customRaw) : [];
    const base = BASE_STAGES.filter((s) => s.id !== "NOT_INTERESTED");
    const notInterested = BASE_STAGES.find((s) => s.id === "NOT_INTERESTED")!;
    const all = [...base, ...custom, notInterested];
    if (orderRaw) {
      const order: string[] = JSON.parse(orderRaw);
      const byId = Object.fromEntries(all.map((s) => [s.id, s]));
      const ordered = order.map((id) => byId[id]).filter(Boolean) as PipelineStage[];
      const orderedIds = new Set(order);
      return [...ordered, ...all.filter((s) => !orderedIds.has(s.id))];
    }
    return all;
  } catch { return BASE_STAGES; }
}

export function saveStages(stages: PipelineStage[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LEADS_KEY, JSON.stringify(stages)); } catch { /* */ }
}

// Keep old exports so existing callers don't break
export function saveStageOrder(stages: PipelineStage[]): void { saveStages(stages); }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function saveCustomStage(_stage: PipelineStage): void { /* no-op, use saveStages */ }

// ─── Project pipeline ─────────────────────────────────────────────────────────
const PROJ_KEY = "gc_project_pipeline_stages_v2";

export function loadProjectStages(): PipelineStage[] {
  if (typeof window === "undefined") return PROJECT_STAGES;
  try {
    const raw = localStorage.getItem(PROJ_KEY);
    if (raw) return JSON.parse(raw) as PipelineStage[];
    return _migrateProject();
  } catch { return PROJECT_STAGES; }
}

function _migrateProject(): PipelineStage[] {
  try {
    const customRaw = localStorage.getItem("gc_project_pipeline_custom_stages");
    const orderRaw  = localStorage.getItem("gc_project_pipeline_stage_order");
    const custom: PipelineStage[] = customRaw ? JSON.parse(customRaw) : [];
    const all = [...PROJECT_STAGES, ...custom];
    if (orderRaw) {
      const order: string[] = JSON.parse(orderRaw);
      const byId = Object.fromEntries(all.map((s) => [s.id, s]));
      const ordered = order.map((id) => byId[id]).filter(Boolean) as PipelineStage[];
      const orderedIds = new Set(order);
      return [...ordered, ...all.filter((s) => !orderedIds.has(s.id))];
    }
    return all;
  } catch { return PROJECT_STAGES; }
}

export function saveProjectStages(stages: PipelineStage[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PROJ_KEY, JSON.stringify(stages)); } catch { /* */ }
}

// Keep old exports
export function saveProjectStageOrder(stages: PipelineStage[]): void { saveProjectStages(stages); }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function saveProjectCustomStage(_stage: PipelineStage): void { /* no-op */ }
