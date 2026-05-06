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
  const isSearching = search.trim().length > 0;

  return (
    <>
      {/* Global search bar — always at top, before triage */}
      <div className="relative mb-6">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#484f58" }}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or trade/division…"
          className="w-full text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none"
          style={{ background: "#161b22", border: `1px solid ${isSearching ? "#C9A84C66" : "#30373f"}`, color: "#e6edf3" }}
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

      {isSearching ? (
        /* ── Search results mode: triage + database stacked with clear labels ── */
        <div className="space-y-6">
          {/* Triage matches */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #C9A84C33" }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#161b22", borderBottom: "1px solid #C9A84C22" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>In Triage</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C" }}>bid inbox</span>
            </div>
            <div className="p-4">
              <BidTriage
                companyId={companyId}
                clients={clients}
                leads={leads}
                projects={projects}
                filterQuery={search}
              />
            </div>
          </div>

          {/* Existing sub matches */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8b949e" }}>In Database</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#1e2736", color: "#8b949e" }}>existing subs</span>
            </div>
            <div className="p-4">
              <SubsDatabase
                companyId={companyId}
                initialSubs={initialSubs}
                filterQuery={search}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ── Normal mode ── */
        <>
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
              filterQuery=""
            />
          </div>

          {/* Divider */}
          <div className="mb-8" style={{ borderTop: "1px solid #30373f" }} />

          <SubsDatabase
            companyId={companyId}
            initialSubs={initialSubs}
            filterQuery=""
          />
        </>
      )}
    </>
  );
}
