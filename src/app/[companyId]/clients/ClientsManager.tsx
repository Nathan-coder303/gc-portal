"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertClient, deleteClient } from "@/app/[companyId]/estimates/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";

type Client = { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; email: string | null; phone: string | null; estimateCount: number };

const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", width: "100%" };

function ClientRow({ client, companyId, isAdmin }: { client: Client; companyId: string; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState({
    name: client.name,
    address: client.address ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    zip: client.zip ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
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
      className="rounded-xl cursor-pointer transition-all flex flex-col"
      style={{
        background: "#1e2736",
        border: `1px solid ${hovered ? "#C9A84C" : "#30373f"}`,
        minHeight: 140,
      }}
      onClick={() => router.push(`/${companyId}/clients/${client.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-6 py-6 flex flex-col flex-1">
        {/* Header: avatar + name + estimate count */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-base" style={{ background: "#C9A84C1a", color: "#C9A84C" }}>
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-lg leading-tight" style={{ color: "#e6edf3" }}>{client.name}</div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ border: "1px solid #C9A84C55", color: "#C9A84C" }}>
            {client.estimateCount} est
          </span>
        </div>

        {/* Contact details */}
        <div className="space-y-0.5 mb-4">
          {client.address && <p className="text-sm" style={{ color: "#8b949e" }}>{client.address}</p>}
          {cityLine && <p className="text-sm" style={{ color: "#8b949e" }}>{cityLine}</p>}
          {client.email && <p className="text-sm" style={{ color: "#8b949e" }}>{client.email}</p>}
          {client.phone && <p className="text-sm" style={{ color: "#8b949e" }}>{client.phone}</p>}
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
              title="Edit"
            >
              <PencilIcon size={13} />
            </button>
            {showDelete ? (
              <div className="flex gap-2 items-center">
                <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={isPending} className="text-xs font-medium px-2 py-1 rounded" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
                <button onClick={(e) => { e.stopPropagation(); setShowDelete(false); }} className="text-xs px-2 py-1 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                title="Delete"
              >
                <TrashIcon size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientsManager({ companyId, clients, isAdmin }: { companyId: string; clients: Client[]; isAdmin: boolean }) {
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "", zip: "", email: "", phone: "" });

  function handleAdd() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await upsertClient({ ...form });
      setForm({ name: "", address: "", city: "", state: "", zip: "", email: "", phone: "" });
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAdding(!adding)} className="px-4 py-2 text-sm rounded-lg font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>
            + New Client
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: "#0d2a1a", border: "1px solid #166534" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>New Client</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Name *</label>
              <input autoFocus value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded px-2 py-1.5 text-sm" style={inputStyle} placeholder="Client name" />
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
            <button onClick={handleAdd} disabled={isPending || !form.name.trim()} className="px-4 py-1.5 text-sm rounded-lg font-medium" style={{ background: "#22c55e", color: "#fff" }}>Create Client</button>
            <button onClick={() => setAdding(false)} className="px-4 py-1.5 text-sm rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
      )}

      {clients.length === 0 && !adding ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <p className="text-sm" style={{ color: "#8b949e" }}>No clients yet.</p>
          {isAdmin && <button onClick={() => setAdding(true)} className="mt-3 text-sm hover:underline" style={{ color: "#C9A84C" }}>Add your first client</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clients.map(c => <ClientRow key={c.id} client={c} companyId={companyId} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  );
}
