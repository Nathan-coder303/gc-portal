"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { updateProject, duplicateProject, deleteProject, addProjectPartner, removeProjectPartner } from "./actions";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";

type Partner = { id: string; name: string; email: string };

type Project = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  startDate: Date;
  budget: number;
  status: string;
  partners: Partner[];
};

const statusStyle: Record<string, { background: string; color: string; border: string }> = {
  ACTIVE:   { background: "#0d2a1a", color: "#4ade80", border: "1px solid #166534" },
  ON_HOLD:  { background: "#2d2410", color: "#fbbf24", border: "1px solid #92400e" },
  COMPLETE: { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" },
};

const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

export default function ProjectCard({
  project,
  companyId,
  isAdmin,
  isPartner,
  partnerUsers,
}: {
  project: Project;
  companyId: string;
  isAdmin: boolean;
  isPartner: boolean;
  partnerUsers: Partner[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [partners, setPartners] = useState<Partner[]>(project.partners);

  const [form, setForm] = useState({
    name: project.name,
    address: project.address ?? "",
    city: project.city ?? "",
    state: project.state ?? "",
    zip: project.zip ?? "",
    startDate: project.startDate.toISOString().slice(0, 10),
    budget: String(project.budget),
    status: project.status,
  });

  function handleSave() {
    startTransition(async () => {
      await updateProject(project.id, {
        name: form.name,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        startDate: form.startDate,
        budget: parseFloat(form.budget),
        status: form.status,
      });
      setEditing(false);
      router.refresh();
    });
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      await duplicateProject(project.id);
      router.refresh();
    } finally {
      setDuplicating(false);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteProject(project.id);
      router.refresh();
    });
  }

  async function handleAddPartner(user: Partner) {
    await addProjectPartner(project.id, user.id);
    setPartners(prev => [...prev, user]);
    setShowPartnerDropdown(false);
  }

  async function handleRemovePartner(userId: string) {
    await removeProjectPartner(project.id, userId);
    setPartners(prev => prev.filter(p => p.id !== userId));
  }

  const availableToAdd = partnerUsers.filter(u => !partners.some(p => p.id === u.id));

  if (editing) {
    return (
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1117", border: "1px solid #C9A84C88" }}>
        <div className="text-sm font-semibold mb-1" style={{ color: "#C9A84C" }}>Edit Project</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="123 Main St" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>City</label>
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
              className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>State</label>
              <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Zip</label>
              <input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })}
                className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Start Date</label>
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Budget ($)</label>
            <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
              className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="w-full rounded px-2 py-1.5 text-sm" style={inputStyle}>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETE">Complete</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={isPending || !form.name.trim()} className="px-4 py-1.5 text-sm rounded-lg font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>Save</button>
          <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-sm rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group rounded-2xl flex flex-col" style={{ background: "#0d1117", border: "1px solid #C9A84C44", minHeight: "220px" }}>
      {/* Main clickable area */}
      <Link
        href={`/${companyId}/${project.id}/${isPartner ? "ledger" : "dashboard"}`}
        className="flex flex-col items-center justify-center flex-1 py-8 px-8 text-center transition-all hover:border-[#C9A84C88] rounded-2xl"
      >
        <div className="font-bold text-4xl mb-3 leading-tight" style={{ color: "#C9A84C" }}>
          {form.name !== project.name ? form.name : project.name}
        </div>
        <span
          className="inline-block text-sm px-4 py-1 rounded-full font-semibold mb-3"
          style={statusStyle[project.status] ?? { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
        >
          {project.status}
        </span>
        <div className="text-base font-semibold" style={{ color: "#8b949e" }}>
          ${project.budget.toLocaleString()}
        </div>
        <div className="text-sm mt-1" style={{ color: "#8b949e" }}>
          {format(project.startDate, "MMM d, yyyy")}
        </div>
      </Link>

      {/* Partners row */}
      {(partners.length > 0 || (isAdmin && partnerUsers.length > 0)) && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          {partners.map(p => (
            <div key={p.id} className="flex items-center gap-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                title={p.name}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleRemovePartner(p.id)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-xs leading-none"
                  style={{ background: "#f8514922", color: "#f85149" }}
                  title={`Remove ${p.name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {isAdmin && availableToAdd.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowPartnerDropdown(v => !v)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: "#30373f", color: "#8b949e", border: "1px dashed #8b949e55" }}
                title="Add partner"
              >
                +
              </button>
              {showPartnerDropdown && (
                <div className="absolute bottom-9 left-0 z-20 rounded-xl shadow-xl overflow-hidden" style={{ background: "#1e2736", border: "1px solid #30373f", minWidth: 200 }}>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>Add Partner</div>
                  {availableToAdd.map(u => (
                    <button key={u.id} onClick={() => handleAddPartner(u)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#30373f]" style={{ color: "#e6edf3" }}>
                      {u.name}
                      <span className="text-xs ml-1" style={{ color: "#8b949e" }}>{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin action buttons — always visible at top-right */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {/* Edit */}
          <button
            onClick={() => setEditing(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
            title="Edit"
          >
            <PencilIcon size={12} />
          </button>
          {/* Duplicate */}
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "#58a6ff22", color: "#58a6ff", border: "1px solid #58a6ff44" }}
            title="Duplicate"
          >
            {duplicating ? <span style={{ fontSize: 10 }}>…</span> : <span style={{ fontSize: 12 }}>⧉</span>}
          </button>
          {/* Delete */}
          {showDelete ? (
            <div className="flex gap-1 items-center bg-[#1e2736] rounded-lg px-2 py-1">
              <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
              <button onClick={handleDelete} disabled={isPending} className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
              <button onClick={() => setShowDelete(false)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: "#8b949e" }}>No</button>
            </div>
          ) : (
            <button
              onClick={() => setShowDelete(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
              title="Delete"
            >
              <TrashIcon size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
