export type PipelineStage = {
  id: string;
  label: string;
  color: string;
  custom?: boolean;
};

export const BASE_STAGES: PipelineStage[] = [
  { id: "NEW_LEAD",            label: "New Lead",            color: "#3b82f6" },
  { id: "CONSULTATION_BOOKED", label: "Consultation Booked", color: "#a855f7" },
  { id: "APPOINTMENT_DONE",    label: "Appointment Done",    color: "#06b6d4" },
  { id: "ESTIMATE_SENT",       label: "Estimate Sent",       color: "#C9A84C" },
  { id: "FOLLOW_UP",           label: "Follow Up",           color: "#f97316" },
  { id: "CLOSED_WON",          label: "Closed Won",          color: "#22c55e" },
  { id: "NOT_INTERESTED",      label: "Not Interested",      color: "#6b7280" },
];

export const STAGE_COLORS = [
  "#3b82f6", "#06b6d4", "#a855f7", "#ec4899",
  "#C9A84C", "#f97316", "#ef4444", "#22c55e",
  "#14b8a6", "#8b5cf6", "#6b7280", "#f59e0b",
];

const CUSTOM_KEY = "gc_pipeline_custom_stages";
const ORDER_KEY  = "gc_pipeline_stage_order";

export function loadStages(): PipelineStage[] {
  if (typeof window === "undefined") return BASE_STAGES;
  try {
    const raw    = localStorage.getItem(CUSTOM_KEY);
    const custom: PipelineStage[] = raw ? JSON.parse(raw) : [];

    const base         = BASE_STAGES.filter((s) => s.id !== "NOT_INTERESTED");
    const notInterested = BASE_STAGES.find((s) => s.id === "NOT_INTERESTED")!;
    const all          = [...base, ...custom, notInterested];

    // Apply saved order if present
    const orderRaw = localStorage.getItem(ORDER_KEY);
    if (!orderRaw) return all;
    const order: string[] = JSON.parse(orderRaw);
    const byId = Object.fromEntries(all.map((s) => [s.id, s]));
    const ordered = order.map((id) => byId[id]).filter(Boolean) as PipelineStage[];
    // Append any stages not in saved order (newly added)
    const orderedIds = new Set(order);
    const extras = all.filter((s) => !orderedIds.has(s.id));
    return [...ordered, ...extras];
  } catch {
    return BASE_STAGES;
  }
}

export function saveStageOrder(stages: PipelineStage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(stages.map((s) => s.id)));
  } catch { /* non-fatal */ }
}

export function saveCustomStage(stage: PipelineStage): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const existing: PipelineStage[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(CUSTOM_KEY, JSON.stringify([...existing, stage]));
  } catch { /* non-fatal */ }
}
