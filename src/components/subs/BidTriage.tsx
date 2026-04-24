"use client";

import { useState, useEffect, useCallback } from "react";
import { STANDARD_DIVISIONS, COMMERCIAL_ONLY_DIVISIONS } from "@/lib/divisions";

const ALL_DIVISIONS = [...STANDARD_DIVISIONS, ...COMMERCIAL_ONLY_DIVISIONS].sort((a, b) =>
  Number(a.code) - Number(b.code)
);

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
  address: string | null;
  city: string | null;
};

type SubInfo = {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  notes: string | null;
};

type AddSubModal = {
  bid: TriageBid;
  clientId: string;
  clientName: string;
  subInfo: SubInfo | null;
  loading: boolean;
};

export default function BidTriage({
  companyId,
  clients,
}: {
  companyId: string;
  clients: Client[];
}) {
  const [bids, setBids] = useState<TriageBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Record<string, string>>({});
  const [addSubModal, setAddSubModal] = useState<AddSubModal | null>(null);

  // Sub form state
  const [subForm, setSubForm] = useState({
    name: "",
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
    const clientId = selectedProject[bid.id];
    if (!clientId) return;
    setAssigningId(bid.id);
    try {
      const res = await fetch(`/api/${companyId}/bids/triage/${bid.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) return;

      // Remove from list
      setBids(prev => prev.filter(b => b.id !== bid.id));

      // Open "add sub?" modal and start extracting
      const client = clients.find(c => c.id === clientId);
      const modal: AddSubModal = {
        bid,
        clientId,
        clientName: client?.name ?? clientId,
        subInfo: null,
        loading: true,
      };
      setAddSubModal(modal);
      setSubForm({
        name: bid.contractorName ?? "",
        address: "",
        phone: "",
        email: "",
        licenseNumber: "",
        divisionCode: bid.divisionCode,
        divisionName: bid.divisionName,
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
          address: info.address ?? "",
          phone: info.phone ?? "",
          email: info.email ?? "",
          licenseNumber: info.licenseNumber ?? "",
          notes: info.notes ?? "",
        }));
      } else {
        setAddSubModal(prev => prev ? { ...prev, loading: false } : null);
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
        {bids.map(bid => (
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
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
                    Div {bid.divisionCode} · {bid.divisionName}
                  </span>
                  {bid.amount && (
                    <span className="text-xs font-semibold" style={{ color: "#22c55e" }}>
                      {fmt(bid.amount)}
                    </span>
                  )}
                </div>
                {bid.notes && (
                  <div className="text-xs mt-1" style={{ color: "#8b949e" }}>{bid.notes}</div>
                )}
                <div className="text-xs mt-1 flex items-center gap-3" style={{ color: "#484f58" }}>
                  <span>
                    {bid.emailSource && <span>{bid.emailSource} · </span>}
                    {new Date(bid.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {bid.fileUrl && (() => {
                    const href = getPdfHref(bid.fileUrl, companyId);
                    return href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold"
                        style={{ color: "#C9A84C" }}
                      >
                        📄 {bid.fileName ?? "View PDF"}
                      </a>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedProject[bid.id] ?? ""}
                  onChange={e => setSelectedProject(prev => ({ ...prev, [bid.id]: e.target.value }))}
                  className="text-xs rounded-lg px-2 py-1.5"
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", minWidth: 160 }}
                >
                  <option value="">Assign to project…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.address ? ` – ${c.address}` : ""}{c.city ? `, ${c.city}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => assignBid(bid)}
                  disabled={!selectedProject[bid.id] || assigningId === bid.id}
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
        ))}
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
                Bid moved to {addSubModal.clientName}
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
