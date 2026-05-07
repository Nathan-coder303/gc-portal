"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { updateProject } from "@/app/[companyId]/projects/actions";
import { useRouter } from "next/navigation";

type ProjectItem = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  startDate: Date;
  budget: number;
  status: string;
  photoUrl: string | null;
};

const STATUS = {
  ACTIVE:   { bg: "#0d2a1a", text: "#4ade80", label: "Active" },
  ON_HOLD:  { bg: "#2d2410", text: "#fbbf24", label: "On Hold" },
  COMPLETE: { bg: "#1e2736", text: "#8b949e", label: "Complete" },
} as const;

function fmtBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function PhotoThumb({
  projectId, companyId, photoUrl, name, isAdmin, onUploaded,
}: {
  projectId: string; companyId: string; photoUrl: string | null;
  name: string; isAdmin: boolean;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`/api/${companyId}/projects/${projectId}/photo`, { method: "POST", body: fd });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? `Upload failed (${res.status})`);
      onUploaded(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
    <div
      className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center cursor-pointer"
      style={{ background: "#2d3748" }}
      onClick={isAdmin ? () => inputRef.current?.click() : undefined}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-2xl select-none">🏗️</span>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <span className="text-xs text-white">…</span>
        </div>
      )}
      {isAdmin && !uploading && (
        <div className="absolute bottom-0 right-0 w-4 h-4 flex items-center justify-center rounded-tl"
          style={{ background: "#C9A84C", fontSize: 8, color: "#0d1117" }}>
          ✎
        </div>
      )}
      {isAdmin && <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />}
    </div>
    {error && (
      <div className="absolute top-14 left-0 z-10 rounded-lg px-2 py-1 text-xs whitespace-nowrap"
        style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514944" }}>
        {error}
      </div>
    )}
    </>
  );
}

function MobileProjectCard({
  project, companyId, isAdmin, isPartner,
}: {
  project: ProjectItem; companyId: string; isAdmin: boolean; isPartner: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(project.photoUrl);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: project.name,
    address: project.address ?? "",
    city: project.city ?? "",
    state: project.state ?? "",
    zip: project.zip ?? "",
    startDate: project.startDate instanceof Date
      ? project.startDate.toISOString().slice(0, 10)
      : String(project.startDate).slice(0, 10),
    budget: String(project.budget),
    status: project.status,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const st = STATUS[project.status as keyof typeof STATUS] ?? STATUS.ACTIVE;
  const location = [project.city, project.state].filter(Boolean).join(", ");
  const href = `/${companyId}/${project.id}/${isPartner ? "ledger" : "dashboard"}`;

  async function handleSave() {
    setSaving(true);
    await updateProject(project.id, {
      name: form.name, address: form.address, city: form.city,
      state: form.state, zip: form.zip, startDate: form.startDate,
      budget: parseFloat(form.budget), status: form.status,
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const inputSt = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

  if (editing) {
    return (
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "#161b22", border: "1px solid #C9A84C88" }}>
        <div className="flex items-center gap-3 mb-1">
          <PhotoThumb projectId={project.id} companyId={companyId} photoUrl={photoUrl}
            name={project.name} isAdmin={isAdmin} onUploaded={setPhotoUrl} />
          <span className="text-sm font-semibold" style={{ color: "#C9A84C" }}>Edit Project</span>
          <button onClick={() => setEditing(false)} className="ml-auto text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
        </div>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="Project name *" className="w-full rounded-lg px-3 py-2 text-sm" style={inputSt} />
        <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
          placeholder="Address" className="w-full rounded-lg px-3 py-2 text-sm" style={inputSt} />
        <div className="grid grid-cols-3 gap-2">
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
            placeholder="City" className="col-span-1 rounded-lg px-3 py-2 text-sm" style={inputSt} />
          <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
            placeholder="ST" className="rounded-lg px-3 py-2 text-sm" style={inputSt} />
          <input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })}
            placeholder="ZIP" className="rounded-lg px-3 py-2 text-sm" style={inputSt} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
            className="rounded-lg px-3 py-2 text-sm" style={inputSt} />
          <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
            placeholder="Budget" className="rounded-lg px-3 py-2 text-sm" style={inputSt} />
        </div>
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
          className="w-full rounded-lg px-3 py-2 text-sm" style={inputSt}>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETE">Complete</option>
        </select>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "#C9A84C", color: "#0d1117" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-xl text-sm" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#161b22", border: "1px solid #30373f" }}>
      {/* Card header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <PhotoThumb projectId={project.id} companyId={companyId} photoUrl={photoUrl}
          name={project.name} isAdmin={isAdmin} onUploaded={setPhotoUrl} />

        <Link href={href} className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: "#e6edf3" }}>{project.name}</p>
          {location && <p className="text-xs mt-0.5 truncate" style={{ color: "#8b949e" }}>{location}</p>}
        </Link>

        <button
          onClick={() => setExpanded(o => !o)}
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full transition-colors"
          style={{ background: expanded ? "#C9A84C22" : "#2d3748", color: expanded ? "#C9A84C" : "#8b949e" }}
        >
          <span style={{ fontSize: 10 }}>{expanded ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #30373f" }}>
          {/* Status + Budget */}
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: st.bg, color: st.text }}>{st.label}</span>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>Budget</p>
              <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>{fmtBudget(project.budget)}</p>
            </div>
          </div>

          {/* Address */}
          {project.address && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#8b949e" }}>Address</p>
              <p className="text-sm" style={{ color: "#e6edf3" }}>
                {project.address}{location ? `, ${location}` : ""}
                {project.zip ? ` ${project.zip}` : ""}
              </p>
            </div>
          )}

          {/* Start date */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#8b949e" }}>Start Date</p>
            <p className="text-sm" style={{ color: "#e6edf3" }}>
              {format(new Date(project.startDate), "MMM d, yyyy")}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Link href={href}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-center"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
              Open →
            </Link>
            {isAdmin && (
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ border: "1px solid #30373f", color: "#8b949e" }}>
                Edit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobileProjectList({
  projects, companyId, isAdmin, isPartner,
}: {
  projects: ProjectItem[];
  companyId: string;
  isAdmin: boolean;
  isPartner: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.address ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.city ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Projects</h1>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
            {filtered.length} project{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#484f58" }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full text-sm rounded-xl pl-9 pr-9 py-2.5 outline-none"
          style={{ background: "#161b22", border: `1px solid ${search ? "#C9A84C66" : "#30373f"}`, color: "#e6edf3" }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#484f58" }}>✕</button>
        )}
      </div>

      {/* Project list */}
      <div className="space-y-3 flex-1">
        {filtered.map(p => (
          <MobileProjectCard
            key={p.id}
            project={p}
            companyId={companyId}
            isAdmin={isAdmin}
            isPartner={isPartner}
          />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: "#161b22", border: "1px solid #30373f" }}>
            <p className="text-sm" style={{ color: "#8b949e" }}>No projects found.</p>
          </div>
        )}
      </div>

      {/* New Project button */}
      {isAdmin && (
        <div className="pt-4 pb-2">
          <Link
            href={`/${companyId}/projects/new`}
            className="flex items-center justify-center w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            + New Project
          </Link>
        </div>
      )}
    </div>
  );
}
