"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertClient } from "@/app/[companyId]/estimates/actions";
import { PencilIcon } from "@/components/ui/icons";

type Client = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email: string | null;
  phone: string | null;
};

const GOLD = "#C9A84C";
const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", width: "100%" };

function formatPhone(p: string | null): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
}

export default function ClientDetailHeader({
  client,
  estimateCount,
  estimateTotal,
  canEdit,
}: {
  client: Client;
  estimateCount: number;
  estimateTotal: number;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
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

  const initials = client.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const cityLine = [client.city, client.state, client.zip].filter(Boolean).join(", ");
  const totalFormatted = estimateTotal > 0
    ? estimateTotal.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : "—";

  if (editing) {
    return (
      <div className="rounded-2xl p-6 mb-6" style={{ background: "#1e2736", border: `1px solid ${GOLD}55` }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shrink-0" style={{ background: "#C9A84C1a", color: GOLD }}>
            {initials}
          </div>
          <h2 className="text-lg font-bold" style={{ color: "#e6edf3" }}>Edit Client</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="123 Main St" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>City</label>
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="Hollywood" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>State</label>
              <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="FL" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Zip</label>
              <input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="33020" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={isPending || !form.name.trim()} className="px-5 py-2 text-sm rounded-lg font-semibold" style={{ background: GOLD, color: "#0d1117" }}>
            {isPending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="px-5 py-2 text-sm rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl mb-6 overflow-hidden" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
      {/* Gold accent bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${GOLD}, #e8c96a, ${GOLD})` }} />

      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0" style={{ background: "#C9A84C18", color: GOLD, border: `1px solid ${GOLD}33` }}>
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold leading-tight" style={{ color: "#e6edf3" }}>{client.name}</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                  {(client.address || cityLine) && (
                    <span className="text-sm" style={{ color: "#8b949e" }}>
                      📍 {[client.address, cityLine].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {client.phone && (
                    <span className="text-sm" style={{ color: "#8b949e" }}>
                      📞 {formatPhone(client.phone)}
                    </span>
                  )}
                  {client.email && (
                    <span className="text-sm" style={{ color: "#8b949e" }}>
                      ✉ {client.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats + edit */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: GOLD }}>{totalFormatted}</div>
                  <div className="text-xs" style={{ color: "#8b949e" }}>{estimateCount} estimate{estimateCount !== 1 ? "s" : ""}</div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                    style={{ background: "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}
                    title="Edit client"
                  >
                    <PencilIcon size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
