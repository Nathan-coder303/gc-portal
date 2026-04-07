"use client";

import { useState, useEffect } from "react";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";
import { BASE_STAGES, loadStages, type PipelineStage } from "@/lib/pipelineStages";
import NsaCallReviewButton from "@/components/leads/NsaCallReviewButton";

export type UrgentLead = {
  id: string;
  displayName: string;
  estimateValue: number | null;
  notes: string | null;
  clientId: string | null;
  clientName: string | null;
  phone: string | null;
  createdAt: string;
};

function UrgentLeadCard({ lead, companyId, stages, onUpdate, onDelete }: {
  lead: UrgentLead; companyId: string; stages: PipelineStage[];
  onUpdate: (id: string, updates: Partial<UrgentLead>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [form, setForm] = useState({
    displayName: lead.displayName,
    estimateValue: lead.estimateValue?.toString() ?? "",
    notes: lead.notes ?? "",
  });

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/${companyId}/pipeline/${lead.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName,
        estimateValue: form.estimateValue ? parseFloat(form.estimateValue) : null,
        notes: form.notes || null,
      }),
    });
    onUpdate(lead.id, {
      displayName: form.displayName,
      estimateValue: form.estimateValue ? parseFloat(form.estimateValue) : null,
      notes: form.notes || null,
    });
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    await fetch(`/api/${companyId}/pipeline/${lead.id}`, { method: "DELETE" });
    onDelete(lead.id);
  }

  async function handleMove(stage: string) {
    await fetch(`/api/${companyId}/pipeline/${lead.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    onDelete(lead.id);
    setShowMove(false);
  }

  if (editing) {
    return (
      <div className="rounded-xl p-3 space-y-2" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <input
          value={form.displayName}
          onChange={e => setForm({ ...form, displayName: e.target.value })}
          className="w-full rounded px-2 py-1.5 text-sm"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
          placeholder="Name"
        />
        <input
          value={form.estimateValue}
          onChange={e => setForm({ ...form, estimateValue: e.target.value })}
          className="w-full rounded px-2 py-1.5 text-sm"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
          placeholder="Estimate value"
          type="number"
        />
        <input
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          className="w-full rounded px-2 py-1.5 text-sm"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
          placeholder="Notes"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="px-3 py-1 text-xs rounded-lg font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>Save</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#161b22", border: "1px solid #30373f" }}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{lead.displayName}</div>
        {lead.clientName && lead.clientName !== lead.displayName && (
          <div className="text-xs" style={{ color: "#8b949e" }}>{lead.clientName}</div>
        )}
        {lead.estimateValue != null && (
          <div className="text-xs font-medium" style={{ color: "#C9A84C" }}>${lead.estimateValue.toLocaleString()}</div>
        )}
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="text-xs font-medium mt-0.5 block hover:underline" style={{ color: "#60a5fa" }}>
            📞 {lead.phone}
          </a>
        )}
        {lead.notes && <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{lead.notes}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button onClick={() => setShowMove(v => !v)} className="px-2 py-1 text-xs rounded-lg font-medium" style={{ background: "#30373f", color: "#e6edf3" }}>
            Move ▾
          </button>
          {showMove && (
            <div className="absolute right-0 top-7 z-20 rounded-xl shadow-xl overflow-hidden" style={{ background: "#1e2736", border: "1px solid #30373f", minWidth: 180 }}>
              {stages.filter(s => s.id !== "TO_CALL_ASAP").map(s => (
                <button key={s.id} onClick={() => handleMove(s.id)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#30373f]" style={{ color: s.color }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setEditing(true)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }} title="Edit">
          <PencilIcon size={12} />
        </button>
        {showDelete ? (
          <div className="flex gap-1 items-center">
            <button onClick={handleDelete} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
            <button onClick={() => setShowDelete(false)} className="text-xs px-2 py-0.5 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
          </div>
        ) : (
          <button onClick={() => setShowDelete(true)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }} title="Delete">
            <TrashIcon size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function TodayCallsSection({ companyId, initialLeads }: { companyId: string; initialLeads: UrgentLead[] }) {
  const [leads, setLeads] = useState<UrgentLead[]>(initialLeads);
  const [stages, setStages] = useState<PipelineStage[]>(BASE_STAGES);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  useEffect(() => { setStages(loadStages()); }, []);
  // Re-sync when server re-renders after NSA review (router.refresh changes initialLeads)
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  const sorted = [...leads].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sortDir === "desc" ? -diff : diff;
  });

  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: "#161b22", border: `1px solid ${leads.length > 0 ? "#ef444455" : "#30373f"}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>To Call ASAP</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ background: leads.length > 0 ? "#ef4444" : "#30373f", color: leads.length > 0 ? "#fff" : "#8b949e" }}
          >
            {leads.length}
          </span>
          {leads.length > 1 && (
            <button
              onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "#30373f", color: "#8b949e" }}
            >
              {sortDir === "desc" ? "↕ Oldest first" : "↕ Latest first"}
            </button>
          )}
        </div>
        <NsaCallReviewButton companyId={companyId} />
      </div>
      {leads.length === 0 ? (
        <p className="text-xs" style={{ color: "#8b949e" }}>No urgent calls right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(lead => (
            <UrgentLeadCard
              key={lead.id}
              lead={lead}
              companyId={companyId}
              stages={stages}
              onUpdate={(id, updates) => setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
              onDelete={(id) => setLeads(prev => prev.filter(l => l.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
