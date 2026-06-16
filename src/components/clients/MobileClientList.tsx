"use client";

import { useState } from "react";
import Link from "next/link";

type Client = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  estimateCount: number;
  estimateTotal: number;
  status: string;
  updatedAt: string;
};

type Stage = {
  key: string;
  title: string;
  accent: string;
  bg: string;
};

const STAGES: Stage[] = [
  { key: "PROSPECT",  title: "Prospects",     accent: "#C9A84C", bg: "#1a1508" },
  { key: "PIPELINE",  title: "Pipeline",      accent: "#3b82f6", bg: "#0a1220" },
  { key: "ACTIVE",    title: "Active Clients", accent: "#22c55e", bg: "#0a1a0f" },
  { key: "COMPLETED", title: "Closed Jobs",   accent: "#8b949e", bg: "#0d1117" },
  { key: "DEAD",      title: "Dead Clients",  accent: "#ef4444", bg: "#1a0a0a" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function StageCard({ stage, clients, companyId }: { stage: Stage; clients: Client[]; companyId: string }) {
  const [open, setOpen] = useState(false);
  const count = clients.length;
  const total = clients.reduce((s, c) => s + c.estimateTotal, 0);

  return (
    <div className="rounded-2xl overflow-hidden w-full" style={{ background: "#161b22", border: `1px solid ${stage.accent}44` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: stage.bg }}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.accent }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: stage.accent }}>{stage.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>
            {count} client{count !== 1 ? "s" : ""}{total > 0 ? ` · ${fmt(total)}` : ""}
          </p>
        </div>
        <span className="text-xs shrink-0" style={{ color: stage.accent }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 space-y-1.5" style={{ borderTop: `1px solid ${stage.accent}22` }}>
          {clients.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "#8b949e" }}>No clients in this stage.</p>
          ) : (
            clients.map(c => {
              const location = [c.city, c.state].filter(Boolean).join(", ");
              return (
                <Link
                  key={c.id}
                  href={`/${companyId}/clients/${c.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: "#0d1117", border: "1px solid #30373f" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{c.name}</p>
                    {(location || c.address) && (
                      <p className="text-[11px] truncate" style={{ color: "#8b949e" }}>{location || c.address}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {c.estimateTotal > 0 && (
                      <p className="text-xs font-bold" style={{ color: "#C9A84C" }}>{fmt(c.estimateTotal)}</p>
                    )}
                    {c.estimateCount > 0 && (
                      <p className="text-[10px]" style={{ color: "#8b949e" }}>{c.estimateCount} est</p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function MobileClientList({ companyId, clients }: { companyId: string; clients: Client[] }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q)
      )
    : clients;

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Clients</h1>
        <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
          {filtered.length} client{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#484f58" }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="w-full text-sm rounded-xl pl-9 pr-9 py-2.5 outline-none"
          style={{ background: "#161b22", border: `1px solid ${search ? "#C9A84C66" : "#30373f"}`, color: "#e6edf3" }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#484f58" }}>✕</button>
        )}
      </div>

      <div className="space-y-3 w-full">
        {STAGES.map(stage => (
          <StageCard
            key={stage.key}
            stage={stage}
            clients={filtered.filter(c => c.status === stage.key)}
            companyId={companyId}
          />
        ))}
      </div>
    </div>
  );
}
