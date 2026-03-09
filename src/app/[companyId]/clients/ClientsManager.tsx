"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upsertClient, deleteClient } from "@/app/[companyId]/estimates/actions";

type Client = { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; email: string | null; phone: string | null; estimateCount: number };

function ClientRow({ client, companyId, isAdmin }: { client: Client; companyId: string; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
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

  const field = "border border-slate-300 rounded px-2 py-1.5 text-sm w-full";
  const cityLine = [client.city, client.state, client.zip].filter(Boolean).join(", ");

  if (editing) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={field} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className={field} placeholder="123 Main St" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
            <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className={field} placeholder="Hollywood" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
              <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className={field} placeholder="FL" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Zip</label>
              <input value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} className={field} placeholder="33020" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={field} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={isPending || !form.name.trim()} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">Save</button>
          <button onClick={() => setEditing(false)} className="px-4 py-1.5 border border-slate-200 text-slate-600 text-sm rounded-lg">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between group hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600 text-sm">
          {client.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{client.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {[client.address, cityLine, client.email, client.phone].filter(Boolean).join(" · ") || "No contact info"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link href={`/${companyId}/clients/${client.id}`} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
          {client.estimateCount} estimate{client.estimateCount !== 1 ? "s" : ""} →
        </Link>
        {isAdmin && (
          <>
            <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
            {showDelete ? (
              <div className="flex gap-1 items-center">
                <span className="text-xs text-slate-500">Sure?</span>
                <button onClick={handleDelete} disabled={isPending} className="text-xs text-red-600 hover:text-red-800 font-medium">Yes</button>
                <button onClick={() => setShowDelete(false)} className="text-xs text-slate-400">No</button>
              </div>
            ) : (
              <button onClick={() => setShowDelete(true)} className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
            )}
          </>
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

  const field = "border border-slate-300 rounded px-2 py-1.5 text-sm w-full";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAdding(!adding)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
            + New Client
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">New Client</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input autoFocus value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={field} placeholder="Client name" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className={field} placeholder="123 Main St" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className={field} placeholder="Hollywood" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className={field} placeholder="FL" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Zip</label>
                <input value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} className={field} placeholder="33020" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={field} placeholder="client@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className={field} placeholder="(555) 000-0000" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={isPending || !form.name.trim()} className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">Create Client</button>
            <button onClick={() => setAdding(false)} className="px-4 py-1.5 border border-slate-200 text-slate-600 text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {clients.length === 0 && !adding ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">No clients yet.</p>
          {isAdmin && <button onClick={() => setAdding(true)} className="mt-3 text-blue-600 text-sm hover:underline">Add your first client</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(c => <ClientRow key={c.id} client={c} companyId={companyId} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  );
}
