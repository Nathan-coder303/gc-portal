"use client";

import { useState } from "react";
import BidTriage from "@/components/subs/BidTriage";
import SubsDatabase from "@/components/subs/SubsDatabase";

type Sub = {
  id: string;
  name: string;
  contactName: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  divisionCode: string;
  divisionName: string;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
};

type Client = { id: string; name: string };
type Lead = { id: string; name: string };
type Project = { id: string; name: string };

export default function SubsPageClient({
  companyId,
  initialSubs,
  clients,
  leads,
  projects,
}: {
  companyId: string;
  initialSubs: Sub[];
  clients: Client[];
  leads: Lead[];
  projects: Project[];
}) {
  const [search, setSearch] = useState("");

  return (
    <>
      {/* Global search bar */}
      <div className="relative mb-6">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#484f58" }}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search subs and triage bids by name or trade…"
          className="w-full text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none"
          style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }}
          autoFocus={false}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "#484f58" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Bid Triage */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>
            Bid Inbox
          </h2>
        </div>
        <BidTriage
          companyId={companyId}
          clients={clients}
          leads={leads}
          projects={projects}
          filterQuery={search}
        />
      </div>

      {/* Divider */}
      <div className="mb-8" style={{ borderTop: "1px solid #30373f" }} />

      <SubsDatabase
        companyId={companyId}
        initialSubs={initialSubs}
        filterQuery={search}
      />
    </>
  );
}
