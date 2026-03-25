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

const STORAGE_KEY = "gc_pipeline_custom_stages";

export function loadStages(): PipelineStage[] {
  if (typeof window === "undefined") return BASE_STAGES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return BASE_STAGES;
    const custom: PipelineStage[] = JSON.parse(raw);
    // Insert custom stages before NOT_INTERESTED
    const base = BASE_STAGES.filter((s) => s.id !== "NOT_INTERESTED");
    const notInterested = BASE_STAGES.find((s) => s.id === "NOT_INTERESTED")!;
    return [...base, ...custom, notInterested];
  } catch {
    return BASE_STAGES;
  }
}

export function saveCustomStage(stage: PipelineStage): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: PipelineStage[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, stage]));
  } catch { /* non-fatal */ }
}
