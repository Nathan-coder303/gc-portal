"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { upsertClient, deleteClient } from "@/app/[companyId]/estimates/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";
import BarometerSection, { type ClientIncomeSummary } from "@/components/today/BarometerSection";

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

  const cityLine = [client.city, client.state, client.zip].filter(Boolean).join(", ");

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
      className="rounded-xl cursor-pointer transition-all flex flex-col select-none"
      style={{
        background: isDragOver ? "#1a2a3a" : "#1e2736",
        border: `1px solid ${isDragOver ? "#C9A84C" : hovered ? "#C9A84C" : "#30373f"}`,
        minHeight: 140,
        opacity: 1,
      }}
      onClick={() => router.push(`/${companyId}/clients/${client.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-5 py-5 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-2">
          {/* Drag handle */}
          <div className="cursor-grab text-lg leading-none shrink-0" style={{ color: "#30373f" }} title="Drag to reorder or change status">⠿</div>
          {(() => { const words = client.name.trim().split(/\s+/).filter(Boolean); const first = words[0] ?? ""; const label = /^\d+$/.test(first) ? first : words.length >= 2 ? (first[0] + words[words.length - 1][0]).toUpperCase() : first.slice(0, 2).toUpperCase() || "?"; return (
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold" style={{ background: "#C9A84C1a", color: "#C9A84C", fontSize: label.length > 3 ? 9 : 11 }}>
              {label}
            </div>
          ); })()}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm leading-tight" style={{ color: "#e6edf3" }}>{client.name}</div>
          </div>
        </div>

        {/* Numbers row */}
        <div className="mb-2">
          {client.estimateTotal > 0 && (
            <div className="text-2xl font-black leading-none tracking-tight" style={{ color: "#22c55e" }}>
              ${client.estimateTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          )}
          {(client.internalProfit > 0 || client.gcFee > 0) && (
            <div className="text-xl font-black leading-none tracking-tight mt-1" style={{ color: "#C9A84C" }}>
              ${(client.internalProfit + client.gcFee).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          )}
          {client.estimateTotal === 0 && client.internalProfit === 0 && client.gcFee === 0 && (
            <div className="text-2xl font-black leading-none" style={{ color: "#30373f" }}>—</div>
          )}
          {client.estimateCount > 0 && (
            <div className="text-[10px] mt-0.5" style={{ color: "#484f58" }}>{client.estimateCount} estimate{client.estimateCount !== 1 ? "s" : ""}</div>
          )}
        </div>

        <div className="space-y-0.5 mb-3 pl-9">
          {client.address && <p className="text-xs" style={{ color: "#8b949e" }}>{client.address}</p>}
          {cityLine && <p className="text-xs" style={{ color: "#8b949e" }}>{cityLine}</p>}
          {client.email && <p className="text-xs" style={{ color: "#8b949e" }}>{client.email}</p>}
          {client.phone && <p className="text-xs" style={{ color: "#8b949e" }}>{formatPhone(client.phone)}</p>}
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2 mt-auto pl-9" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
              title="Edit"
            >
              <PencilIcon size={12} />
            </button>
            {showDelete ? (
              <div className="flex gap-2 items-center">
                <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={isPending} className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
                <button onClick={(e) => { e.stopPropagation(); setShowDelete(false); }} className="text-xs px-2 py-0.5 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                title="Delete"
              >
                <TrashIcon size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
  onAdd, onCancelAdd, accentColor, bgColor, onDragStart, onDrop,
}: {
  title: string; status: string; clients: Client[]; companyId: string; isAdmin: boolean;
  adding: boolean; onAdd: () => void; onCancelAdd: () => void;
  accentColor: string; bgColor: string;
  onDragStart: (clientId: string) => void;
  onDrop: (targetClientId: string | null, targetStatus: string) => void;
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState(false);

  return (
    <div
      className="flex-1 rounded-2xl flex flex-col"
      style={{ background: bgColor, border: `1px solid ${dragOverZone ? accentColor : "#30373f"}`, minHeight: 300, transition: "border-color 0.15s" }}
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
          <button onClick={onAdd} className="text-xs px-3 py-1 rounded-lg font-medium" style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}>
            + Add
          </button>
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
          accentColor="#ef4444"
          bgColor="#1a0a0a"
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}
