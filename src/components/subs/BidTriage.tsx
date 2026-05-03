"use client";

import { useState, useEffect, useCallback } from "react";
import { DIVISIONS } from "@/lib/divisions";

const ALL_DIVISIONS = [...DIVISIONS];

function getPdfHref(fileUrl: string, companyId: string): string {
  if (fileUrl.startsWith("gmail:")) {
    const parts = fileUrl.split(":");
    const msgId = parts[1];
    const attachmentId = parts[2] ?? "";
    if (!attachmentId) return "";
    return `/api/${companyId}/gmail-attachment?msgId=${encodeURIComponent(msgId)}&attachmentId=${encodeURIComponent(attachmentId)}`;
  }
  if (fileUrl.startsWith("/api/")) return fileUrl;
  if (fileUrl.includes("vercel-storage.com") || fileUrl.includes("blob.vercel")) {
    return `/api/${companyId}/blob-proxy?u=${encodeURIComponent(fileUrl)}`;
  }
  return fileUrl;
}

type TriageBid = {
  id: string;
  contractorName: string | null;
  divisionCode: string;
  divisionName: string;
  amount: number | null;
  notes: string | null;
  emailSource: string | null;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
};

type Client = {
  id: string;
  name: string;
};

type Lead = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  name: string;
};

type SubInfo = {
  name: string | null;
  contactName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  notes: string | null;
};

function getSourceLabel(bid: TriageBid): { label: string; color: string; title: string } {
  const src = bid.emailSource ?? "";
  const url = bid.fileUrl ?? "";
  const hasContact = !!parseContactNotes(bid.notes);

  if (/planhub/i.test(src)) return { label: "🏗 PlanHub", color: "#8b5cf6", title: src };
  if (url.startsWith("gmail:") || /gmail|google/i.test(src))
    return { label: "📧 Gmail", color: "#3b82f6", title: src || "Gmail sync" };
  if (src) return { label: "📧 Email", color: "#3b82f6", title: src };
  if (hasContact) return { label: "📊 Excel", color: "#22c55e", title: "Imported from spreadsheet" };
  return { label: "Manual", color: "#8b949e", title: "Added manually" };
}

function parseContactNotes(notes: string | null): { contactName: string; email: string; phone: string } | null {
  if (!notes) return null;
  const parts = notes.split(" | ");
  if (parts.length < 2) return null;
  return {
    contactName: parts[0]?.trim() ?? "",
    email: parts[1]?.trim() ?? "",
    phone: parts[2]?.trim() ?? "",
  };
}

type AddSubModal = {
  bid: TriageBid;
  clientId: string | null;
  leadId: string | null;
  projectId: string | null;
  targetName: string;
  subInfo: SubInfo | null;
  loading: boolean;
};

export default function BidTriage({
  companyId,
  clients,
  leads = [],
  projects = [],
}: {
  companyId: string;
  clients: Client[];
  leads?: Lead[];
  projects?: Project[];
}) {
  const [bids, setBids] = useState<TriageBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  // "client:ID" or "lead:ID"
  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({});
  // Per-bid division override (divisionCode)
  const [selectedDivision, setSelectedDivision] = useState<Record<string, string>>({});
  const [addSubModal, setAddSubModal] = useState<AddSubModal | null>(null);

  // Sub form state
  const [subForm, setSubForm] = useState({
    name: "",
    contactName: "",
    address: "",
    phone: "",
    email: "",
    licenseNumber: "",
    divisionCode: "",
    divisionName: "",
    notes: "",
  });
  const [savingSub, setSavingSub] = useState(false);

  const loadBids = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${companyId}/bids/triage`);
      if (res.ok) setBids(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadBids(); }, [loadBids]);

  async function assignBid(bid: TriageBid) {
    const target = selectedTarget[bid.id];
    if (!target) return;

    const isLead = target.startsWith("lead:");
    const isProject = target.startsWith("project:");
    const targetId = target.replace(/^(client:|lead:|project:)/, "");
    const divCode = selectedDivision[bid.id] ?? bid.divisionCode;
    const divName = ALL_DIVISIONS.find(d => d.code === divCode)?.name ?? bid.divisionName;

    setAssigningId(bid.id);
    try {
      const body: Record<string, string | null> = { divisionCode: divCode, divisionName: divName };
      if (isLead) {
        body.leadId = targetId;
        body.clientId = null;
        body.projectId = null;
      } else if (isProject) {
        body.projectId = targetId;
        body.clientId = null;
        body.leadId = null;
      } else {
        body.clientId = targetId;
        body.leadId = null;
        body.projectId = null;
      }

      const res = await fetch(`/api/${companyId}/bids/triage/${bid.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;

      // Remove from list
      setBids(prev => prev.filter(b => b.id !== bid.id));

      // Find target name
      let targetName = targetId;
      if (isLead) {
        targetName = leads.find(l => l.id === targetId)?.name ?? targetId;
      } else if (isProject) {
        targetName = projects.find(p => p.id === targetId)?.name ?? targetId;
      } else {
        targetName = clients.find(c => c.id === targetId)?.name ?? targetId;
      }

      // Open "add sub?" modal and start extracting
      const modal: AddSubModal = {
        bid: { ...bid, divisionCode: divCode, divisionName: divName },
        clientId: isLead || isProject ? null : targetId,
        leadId: isLead ? targetId : null,
        projectId: isProject ? targetId : null,
        targetName,
        subInfo: null,
        loading: true,
      };
      setAddSubModal(modal);

      const parsedContact = parseContactNotes(bid.notes);

      // For Excel-imported bids (no PDF), pre-fill from stored notes immediately
      if (!bid.fileUrl) {
        setSubForm({
          name: bid.contractorName ?? "",
          contactName: parsedContact?.contactName ?? "",
          address: "",
          phone: parsedContact?.phone ?? "",
          email: parsedContact?.email ?? "",
          licenseNumber: "",
          divisionCode: divCode,
          divisionName: divName,
          notes: "",
        });
        setAddSubModal(prev => prev ? { ...prev, loading: false } : null);
      } else {
        setSubForm({
          name: bid.contractorName ?? "",
          contactName: "",
          address: "",
          phone: "",
          email: "",
          licenseNumber: "",
          divisionCode: divCode,
          divisionName: divName,
          notes: "",
        });

        // Extract sub info from PDF in background
        const extractRes = await fetch(`/api/${companyId}/bids/triage/${bid.id}/extract-sub`, {
          method: "POST",
        });
        if (extractRes.ok) {
          const info: SubInfo = await extractRes.json();
          setAddSubModal(prev => prev ? { ...prev, subInfo: info, loading: false } : null);
          setSubForm(prev => ({
            ...prev,
            name: info.name ?? prev.name,
            contactName: info.contactName ?? prev.contactName,
            address: info.address ?? "",
            phone: info.phone ?? "",
            email: info.email ?? "",
            licenseNumber: info.licenseNumber ?? "",
            notes: info.notes ?? "",
          }));
        } else {
          setAddSubModal(prev => prev ? { ...prev, loading: false } : null);
        }
      }
    } finally {
      setAssigningId(null);
    }
  }

  async function discardBid(bidId: string) {
    await fetch(`/api/${companyId}/bids/triage/${bidId}`, { method: "DELETE" });
    setBids(prev => prev.filter(b => b.id !== bidId));
  }

  async function saveSub() {
    if (!addSubModal || !subForm.name || !subForm.divisionCode) return;
    setSavingSub(true);
    try {
      const div = ALL_DIVISIONS.find(d => d.code === subForm.divisionCode);
      await fetch(`/api/${companyId}/subs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subForm.name,
          contactName: subForm.contactName || null,
          address: subForm.address || null,
          phone: subForm.phone || null,
          email: subForm.email || null,
          licenseNumber: subForm.licenseNumber || null,
          divisionCode: subForm.divisionCode,
          divisionName: div?.name ?? subForm.divisionName,
          notes: subForm.notes || null,
          source: "bid",
        }),
      });
      setAddSubModal(null);
    } finally {
      setSavingSub(false);
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return <div className="text-sm" style={{ color: "#484f58" }}>Loading triage bids…</div>;
  }

  if (bids.length === 0) {
    return (
      <div className="text-sm py-6 text-center" style={{ color: "#484f58" }}>
        No bids in triage. New PlanHub notifications will appear here automatically.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {bids.map(bid => {
          const divCode = selectedDivision[bid.id] ?? bid.divisionCode;
          return (
            <div
              key={bid.id}
              className="rounded-xl px-4 py-4"
              style={{ background: "#161b22", border: "1px solid #30373f" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                      {bid.contractorName ?? "Unknown contractor"}
                    </span>
                    {bid.amount && (
                      <span className="text-xs font-semibold" style={{ color: "#22c55e" }}>
                        {fmt(bid.amount)}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const contact = parseContactNotes(bid.notes);
                    if (contact) {
                      return (
                        <div className="flex flex-wrap gap-3 mt-1">
                          {contact.contactName && (
                            <span className="text-xs" style={{ color: "#8b949e" }}>👤 {contact.contactName}</span>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-xs hover:underline" style={{ color: "#58a6ff" }}>{contact.email}</a>
                          )}
                          {contact.phone && (
                            <span className="text-xs" style={{ color: "#8b949e" }}>{contact.phone}</span>
                          )}
                        </div>
                      );
                    }
                    return bid.notes ? <div className="text-xs mt-1" style={{ color: "#8b949e" }}>{bid.notes}</div> : null;
                  })()}
                  <div className="text-xs mt-1.5 flex items-center gap-2 flex-wrap" style={{ color: "#484f58" }}>
                    {/* Source badge */}
                    {(() => {
                      const s = getSourceLabel(bid);
                      return (
                        <span title={s.title} className="px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: s.color + "22", color: s.color, border: `1px solid ${s.color}44`, cursor: "default" }}>
                          {s.label}
                        </span>
                      );
                    })()}
                    <span>{new Date(bid.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {bid.fileUrl && (() => {
                      const href = getPdfHref(bid.fileUrl, companyId);
                      return href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                          className="font-semibold" style={{ color: "#C9A84C" }}>
                          📄 {bid.fileName ?? "View PDF"}
                        </a>
                      ) : null;
                    })()}
                    {bid.emailSource && (
                      <span title={bid.emailSource} style={{ color: "#484f58" }}>
                        {bid.emailSource.length > 50 ? bid.emailSource.slice(0, 50) + "…" : bid.emailSource}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0 min-w-[200px]">
                  {/* Division picker */}
                  <select
                    value={divCode}
                    onChange={e => setSelectedDivision(prev => ({ ...prev, [bid.id]: e.target.value }))}
                    className="text-xs rounded-lg px-2 py-1.5"
                    style={{ background: "#1e2736", border: "1px solid #C9A84C44", color: "#C9A84C" }}
                  >
                    {ALL_DIVISIONS.map(d => (
                      <option key={d.code} value={d.code}>{d.code} – {d.name}</option>
                    ))}
                  </select>

                  {/* Target + Move */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTarget[bid.id] ?? ""}
                      onChange={e => setSelectedTarget(prev => ({ ...prev, [bid.id]: e.target.value }))}
                      className="text-xs rounded-lg px-2 py-1.5 flex-1"
                      style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                    >
                      <option value="">Assign to…</option>
                      {projects.length > 0 && (
                        <optgroup label="── Projects ──">
                          {projects.map(p => (
                            <option key={p.id} value={`project:${p.id}`}>{p.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {clients.length > 0 && (
                        <optgroup label="── Clients ──">
                          {clients.map(c => (
                            <option key={c.id} value={`client:${c.id}`}>{c.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {leads.length > 0 && (
                        <optgroup label="── Leads ──">
                          {leads.map(l => (
                            <option key={l.id} value={`lead:${l.id}`}>{l.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      onClick={() => assignBid(bid)}
                      disabled={!selectedTarget[bid.id] || assigningId === bid.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
                      style={{ background: "#C9A84C", color: "#0d1117" }}
                    >
                      {assigningId === bid.id ? "…" : "Move"}
                    </button>
                    <button
                      onClick={() => discardBid(bid.id)}
                      className="text-xs px-2 py-1.5 rounded-lg"
                      style={{ background: "#1e2736", border: "1px solid #30373f", color: "#484f58" }}
                      title="Discard"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Sub Modal */}
      {addSubModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "#161b22", border: "1px solid #30373f" }}
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#C9A84C" }}>
                Bid moved to {addSubModal.targetName}
              </div>
              <div className="text-base font-bold" style={{ color: "#e6edf3" }}>
                Add this sub to the database?
              </div>
              {addSubModal.loading && (
                <div className="text-xs mt-1" style={{ color: "#484f58" }}>Extracting info from PDF…</div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>Company / Name</label>
                <input
                  value={subForm.name}
                  onChange={e => setSubForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                  placeholder="Sub company name"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>Contact Name</label>
                <input
                  value={subForm.contactName}
                  onChange={e => setSubForm(p => ({ ...p, contactName: e.target.value }))}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                  placeholder="Contact person"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>Address</label>
                <input
                  value={subForm.address}
                  onChange={e => setSubForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                  placeholder="Street address, city, state"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>Phone</label>
                  <input
                    value={subForm.phone}
                    onChange={e => setSubForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full text-sm rounded-lg px-3 py-2"
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="(305) 000-0000"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>Email</label>
                  <input
                    value={subForm.email}
                    onChange={e => setSubForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full text-sm rounded-lg px-3 py-2"
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="sub@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>License Number</label>
                <input
                  value={subForm.licenseNumber}
                  onChange={e => setSubForm(p => ({ ...p, licenseNumber: e.target.value }))}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                  placeholder="CGC123456"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>Division</label>
                <select
                  value={subForm.divisionCode}
                  onChange={e => {
                    const div = ALL_DIVISIONS.find(d => d.code === e.target.value);
                    setSubForm(p => ({ ...p, divisionCode: e.target.value, divisionName: div?.name ?? "" }));
                  }}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                >
                  <option value="">Select division…</option>
                  {ALL_DIVISIONS.map(d => (
                    <option key={d.code} value={d.code}>{d.code} – {d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#8b949e" }}>Notes (optional)</label>
                <input
                  value={subForm.notes}
                  onChange={e => setSubForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" }}
                  placeholder="Any notes about this sub"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={saveSub}
                disabled={savingSub || !subForm.name || !subForm.divisionCode}
                className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {savingSub ? "Saving…" : "Add to Database"}
              </button>
              <button
                onClick={() => setAddSubModal(null)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
