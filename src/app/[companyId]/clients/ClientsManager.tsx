"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertClient, deleteClient } from "@/app/[companyId]/estimates/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";
import BarometerSection, { type ClientIncomeSummary } from "@/components/today/BarometerSection";

type LeadOption = {
  id: string; name: string | null; email: string | null; phone: string | null;
  address: string | null; city: string | null; projectType: string | null;
};

type Client = {
  id: string; name: string; address: string | null; city: string | null;
  state: string | null; zip: string | null; email: string | null; phone: string | null;
  estimateCount: number; estimateTotal: number; internalProfit: number; gcFee: number; status: string; sortOrder: number;
};

const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", width: "100%" };

function formatPhone(p: string | null): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return p;
}

async function patchClientStatus(companyId: string, clientId: string, body: { status?: string; sortOrder?: number }) {
  await fetch(`/api/${companyId}/clients/${clientId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ClientCard({
  client, companyId, isAdmin,
  onDragStart, onDragOver, onDrop, onDragEnd, isDragOver,
}: {
  client: Client; companyId: string; isAdmin: boolean;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void; onDragEnd: () => void; isDragOver: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState({
    name: client.name, address: client.address ?? "", city: client.city ?? "",
    state: client.state ?? "", zip: client.zip ?? "", email: client.email ?? "", phone: client.phone ?? "",
  });

  function save() {
    startTransition(async () => {
      await upsertClient({ id: client.id, ...form });
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteClient(client.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#1a2d1a", border: "1px solid #30373f" }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Address</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="123 Main St" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>City</label>
            <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="Hollywood" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>State</label>
              <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="FL" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Zip</label>
              <input value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="33020" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={isPending || !form.name.trim()} className="px-4 py-1.5 text-sm rounded-lg font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>Save</button>
          <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-sm rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="rounded-xl cursor-pointer select-none"
      style={{
        background: isDragOver ? "#1a2a3a" : "#1e2736",
        border: `1px solid ${isDragOver ? "#C9A84C" : hovered ? "#C9A84C55" : "#30373f"}`,
        transition: "border-color 0.12s",
      }}
      onClick={() => router.push(`/${companyId}/clients/${client.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-4 py-3 flex flex-col gap-2" style={{ position: "relative" }}>
        {/* Avatar sticker — top right */}
        {(() => {
          const words = client.name.trim().split(/\s+/).filter(Boolean);
          const first = words[0] ?? "";
          const label = /^\d+$/.test(first) ? first : words.length >= 2 ? (first[0] + words[words.length - 1][0]).toUpperCase() : first.slice(0, 2).toUpperCase() || "?";
          return (
            <div style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "#C9A84C1a", border: "1px solid #C9A84C44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: label.length > 2 ? 9 : 11, fontWeight: 700, color: "#C9A84C" }}>
              {label}
            </div>
          );
        })()}

        {/* Name row */}
        <div className="flex items-center gap-2" style={{ paddingRight: 36 }}>
          <div className="cursor-grab text-base leading-none shrink-0" style={{ color: "#30373f" }} title="Drag to reorder">⠿</div>
          <div className="font-bold text-sm leading-tight truncate flex-1" style={{ color: "#e6edf3" }}>{client.name}</div>
        </div>

        {/* Amounts row */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <div className="text-[10px] font-medium mb-0.5" style={{ color: "#484f58" }}>ESTIMATE</div>
            <div className="text-base font-black leading-none" style={{ color: client.estimateTotal > 0 ? "#22c55e" : "#30373f" }}>
              {client.estimateTotal > 0 ? `$${client.estimateTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-medium mb-0.5" style={{ color: "#484f58" }}>GC PROFIT</div>
            <div className="text-base font-black leading-none" style={{ color: (client.internalProfit + client.gcFee) > 0 ? "#C9A84C" : "#30373f" }}>
              {(client.internalProfit + client.gcFee) > 0 ? `$${(client.internalProfit + client.gcFee).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
            </div>
          </div>
        </div>

        {/* Phone + buttons row */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs truncate" style={{ color: "#8b949e" }}>
            {client.phone ? formatPhone(client.phone) : <span style={{ color: "#30373f" }}>no phone</span>}
          </div>
          {isAdmin && (
            <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                title="Edit"
              >
                <PencilIcon size={11} />
              </button>
              {showDelete ? (
                <div className="flex gap-1 items-center">
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={isPending} className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
                  <button onClick={(e) => { e.stopPropagation(); setShowDelete(false); }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                  title="Delete"
                >
                  <TrashIcon size={11} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── From Lead Modal ──────────────────────────────────────────────────────────

function FromLeadModal({ companyId, defaultStatus, onDone, onClose }: {
  companyId: string; defaultStatus: string; onDone: () => void; onClose: () => void;
}) {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LeadOption | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/${companyId}/leads`)
      .then(r => r.json())
      .then(data => { setLeads(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  const filtered = leads.filter(l =>
    (l.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (l.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (l.phone ?? "").includes(search)
  );

  function handleConfirm() {
    if (!selected?.name?.trim()) return;
    startTransition(async () => {
      const res = await upsertClient({
        name: selected.name!.trim(),
        address: selected.address ?? "",
        city: selected.city ?? "",
        state: "",
        zip: "",
        email: selected.email ?? "",
        phone: selected.phone ?? "",
      });
      // If not the default PROSPECT status, update it
      if (defaultStatus !== "PROSPECT" && res?.id) {
        await patchClientStatus(companyId, res.id, { status: defaultStatus });
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl flex flex-col" style={{ background: "#161b22", border: "1px solid #30373f", maxHeight: "80vh" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #30373f" }}>
          <h2 className="text-sm font-bold" style={{ color: "#e6edf3" }}>From Existing Lead</h2>
          <button onClick={onClose} style={{ color: "#8b949e", fontSize: 20, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>

        <div className="px-4 py-3">
          <input
            autoFocus
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {loading && <p className="text-xs text-center py-6" style={{ color: "#8b949e" }}>Loading leads…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-center py-6" style={{ color: "#8b949e" }}>No leads found</p>
          )}
          {filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => setSelected(lead)}
              className="w-full rounded-lg px-3 py-2.5 text-left transition-colors"
              style={{
                background: selected?.id === lead.id ? "#C9A84C22" : "#0d1117",
                border: `1px solid ${selected?.id === lead.id ? "#C9A84C55" : "#30373f"}`,
              }}
            >
              <div className="font-medium text-sm truncate" style={{ color: "#e6edf3" }}>{lead.name ?? "—"}</div>
              <div className="text-xs mt-0.5 flex gap-2 flex-wrap" style={{ color: "#8b949e" }}>
                {lead.phone && <span>{formatPhone(lead.phone)}</span>}
                {lead.email && <span className="truncate">{lead.email}</span>}
                {lead.projectType && <span style={{ color: "#C9A84C" }}>{lead.projectType}</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 flex gap-2" style={{ borderTop: "1px solid #30373f" }}>
          <button
            onClick={handleConfirm}
            disabled={!selected || isPending}
            className="flex-1 rounded-xl py-2 text-sm font-bold"
            style={{ background: selected && !isPending ? "#C9A84C" : "#30373f", color: selected && !isPending ? "#0d1117" : "#8b949e" }}
          >
            {isPending ? "Creating…" : "Create Client"}
          </button>
          <button onClick={onClose} className="px-4 rounded-xl py-2 text-sm" style={{ background: "#30373f", color: "#e6edf3" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Client Form ───────────────────────────────────────────────────────────

function AddClientForm({ onDone, defaultStatus }: { onDone: () => void; defaultStatus: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "FL", zip: "", email: "", phone: "" });

  function handleAdd() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await upsertClient({ ...form });
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "#0d2a1a", border: "1px solid #166534" }}>
      <h3 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>New {defaultStatus === "ACTIVE" ? "Active Client" : "Prospect"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Name *</label>
          <input autoFocus value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="Client name" onKeyDown={e => e.key === "Enter" && handleAdd()} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Address</label>
          <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="123 Main St" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>City</label>
          <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="Hollywood" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>State</label>
            <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="FL" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Zip</label>
            <input value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="33020" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="client@email.com" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Phone</label>
          <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="(555) 000-0000" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={isPending || !form.name.trim()} className="px-4 py-1.5 text-sm rounded-lg font-medium" style={{ background: "#22c55e", color: "#fff" }}>Create</button>
        <button onClick={onDone} className="px-4 py-1.5 text-sm rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
      </div>
    </div>
  );
}


function ClientColumn({
  title, status, clients, companyId, isAdmin, adding,
  onAdd, onCancelAdd, onAddFromLead, accentColor, bgColor, onDragStart, onDrop,
}: {
  title: string; status: string; clients: Client[]; companyId: string; isAdmin: boolean;
  adding: boolean; onAdd: () => void; onCancelAdd: () => void; onAddFromLead: () => void;
  accentColor: string; bgColor: string;
  onDragStart: (clientId: string) => void;
  onDrop: (targetClientId: string | null, targetStatus: string) => void;
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div
      className="flex-1 rounded-2xl flex flex-col"
      style={{ background: bgColor, border: `1px solid ${dragOverZone ? accentColor : "#30373f"}`, minHeight: 300, minWidth: 200, transition: "border-color 0.15s" }}
      onDragOver={(e) => { e.preventDefault(); setDragOverZone(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverZone(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOverZone(false); onDrop(null, status); }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${accentColor}33` }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: accentColor }}>{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${accentColor}22`, color: accentColor }}>{clients.length}</span>
        </div>
        {isAdmin && (
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className="text-xs px-3 py-1 rounded-lg font-medium"
              style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
            >
              + Add
            </button>
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-xl" style={{ background: "#1e2736", border: "1px solid #30373f", minWidth: 170 }}>
                  <button
                    onClick={() => { setShowAddMenu(false); onAdd(); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:brightness-125"
                    style={{ color: "#e6edf3" }}
                  >
                    ✦ New Prospect
                  </button>
                  <button
                    onClick={() => { setShowAddMenu(false); onAddFromLead(); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:brightness-125"
                    style={{ color: "#C9A84C", borderTop: "1px solid #30373f" }}
                  >
                    ↗ From Existing Lead
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        {adding && <AddClientForm onDone={onCancelAdd} defaultStatus={status} />}

        {clients.length === 0 && !adding && (
          <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed" style={{ borderColor: `${accentColor}33`, minHeight: 120 }}>
            <p className="text-xs" style={{ color: "#8b949e" }}>Drop here</p>
          </div>
        )}

        {clients.map((c) => (
          <ClientCard
            key={c.id}
            client={c}
            companyId={companyId}
            isAdmin={isAdmin}
            isDragOver={dragOverId === c.id}
            onDragStart={() => onDragStart(c.id)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(c.id); }}
            onDrop={() => { setDragOverId(null); onDrop(c.id, status); }}
            onDragEnd={() => setDragOverId(null)}
          />
        ))}
      </div>
    </div>
  );
}

export default function ClientsManager({ companyId, clients: initialClients, isAdmin }: { companyId: string; clients: Client[]; isAdmin: boolean }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [fromLeadForStatus, setFromLeadForStatus] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const router = useRouter();

  const prospects = clients.filter(c => c.status === "PROSPECT");
  const actives = clients.filter(c => c.status === "ACTIVE");
  const completed = clients.filter(c => c.status === "COMPLETED");
  const dead = clients.filter(c => c.status === "DEAD");

  // Build ClientIncomeSummary array for BarometerSection
  const clientIncomeSummaries: ClientIncomeSummary[] = [...actives, ...completed].map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    estimateTotal: c.estimateTotal,
    internalProfit: c.internalProfit,
    gcFee: c.gcFee,
    mibhIncome: c.internalProfit + c.gcFee,
    companyId,
  }));
  const mibhIncome = actives.reduce((sum, c) => sum + c.internalProfit + c.gcFee, 0)
    || actives.reduce((sum, c) => sum + c.estimateTotal, 0);

  function handleDragStart(clientId: string) {
    dragIdRef.current = clientId;
  }

  async function handleDrop(targetClientId: string | null, targetStatus: string) {
    const dragId = dragIdRef.current;
    dragIdRef.current = null;
    if (!dragId) return;

    const dragged = clients.find(c => c.id === dragId);
    if (!dragged) return;

    // Optimistically update UI
    setClients(prev => {
      const list = prev.filter(c => c.id !== dragId);
      const targetIdx = targetClientId ? list.findIndex(c => c.id === targetClientId) : -1;
      const updated = { ...dragged, status: targetStatus };
      if (targetIdx >= 0) {
        list.splice(targetIdx, 0, updated);
      } else {
        list.push(updated);
      }
      return list;
    });

    // Persist status change
    await patchClientStatus(companyId, dragId, { status: targetStatus });

    // Persist new sortOrders for the target column
    setClients(prev => {
      const sameStatus = prev.filter(c => c.status === targetStatus);
      sameStatus.forEach(async (c, i) => {
        if (c.sortOrder !== i) {
          await patchClientStatus(companyId, c.id, { sortOrder: i });
        }
      });
      return prev.map(c => {
        const idx = sameStatus.findIndex(s => s.id === c.id);
        return idx >= 0 ? { ...c, sortOrder: idx } : c;
      });
    });

    router.refresh();
  }

  return (
    <div>
      {fromLeadForStatus && (
        <FromLeadModal
          companyId={companyId}
          defaultStatus={fromLeadForStatus}
          onDone={() => setFromLeadForStatus(null)}
          onClose={() => setFromLeadForStatus(null)}
        />
      )}

      {/* MIBH Income 2026 Barometer — clickable, shows open + closed breakdown */}
      <BarometerSection mibhIncome={mibhIncome} clients={clientIncomeSummaries} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>{prospects.length} prospect{prospects.length !== 1 ? "s" : ""} · {actives.length} active · {completed.length} closed · {dead.length} dead</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <ClientColumn
          title="Prospects"
          status="PROSPECT"
          clients={prospects}
          companyId={companyId}
          isAdmin={isAdmin}
          adding={addingIn === "PROSPECT"}
          onAdd={() => setAddingIn("PROSPECT")}
          onCancelAdd={() => setAddingIn(null)}
          onAddFromLead={() => setFromLeadForStatus("PROSPECT")}
          accentColor="#C9A84C"
          bgColor="#0d1117"
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
        <ClientColumn
          title="Active Clients"
          status="ACTIVE"
          clients={actives}
          companyId={companyId}
          isAdmin={isAdmin}
          adding={addingIn === "ACTIVE"}
          onAdd={() => setAddingIn("ACTIVE")}
          onCancelAdd={() => setAddingIn(null)}
          onAddFromLead={() => setFromLeadForStatus("ACTIVE")}
          accentColor="#22c55e"
          bgColor="#0a1a0f"
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
        <ClientColumn
          title="Closed Jobs"
          status="COMPLETED"
          clients={completed}
          companyId={companyId}
          isAdmin={isAdmin}
          adding={addingIn === "COMPLETED"}
          onAdd={() => setAddingIn("COMPLETED")}
          onCancelAdd={() => setAddingIn(null)}
          onAddFromLead={() => setFromLeadForStatus("COMPLETED")}
          accentColor="#8b949e"
          bgColor="#0d1117"
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
        <ClientColumn
          title="Dead Clients"
          status="DEAD"
          clients={dead}
          companyId={companyId}
          isAdmin={isAdmin}
          adding={false}
          onAdd={() => {}}
          onCancelAdd={() => {}}
          onAddFromLead={() => setFromLeadForStatus("DEAD")}
          accentColor="#ef4444"
          bgColor="#1a0a0a"
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}
