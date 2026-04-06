"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upsertSubBid, deleteSubBid } from "@/app/[companyId]/clients/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";
import { STANDARD_DIVISIONS, COMMERCIAL_ONLY_DIVISIONS } from "@/lib/divisions";

export type SubBidOffer = {
  id: string;
  contractorName: string | null;
  amount: number | null;
  notes: string | null;
  fileUrl: string | null;
  fileName: string | null;
  status: string;
  isPlaceholder: boolean;
  createdAt?: string;
  bidDate?: string | null;
  emailSource?: string | null;
};

export type SubBidRow = {
  divisionCode: string;
  divisionName: string;
  offers: SubBidOffer[];
};

type Props = {
  clientId: string;
  companyId: string;
  clientName?: string;
  clientAddress?: string;
  subBids: SubBidRow[];
  canEdit: boolean;
  canDelete?: boolean;
  isCommercial?: boolean;
};


function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime()) || d.getFullYear() < 2020) return "";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

function getPdfHref(fileUrl: string, companyId: string): string {
  if (fileUrl.startsWith("gmail:")) {
    const parts = fileUrl.split(":");
    const msgId = parts[1];
    const attachmentId = parts[2] ?? "";
    // No attachmentId = email had no file attachment → no link
    if (!attachmentId) return "";
    return `/api/${companyId}/gmail-attachment?msgId=${encodeURIComponent(msgId)}&attachmentId=${encodeURIComponent(attachmentId)}`;
  }
  // Already a proxy URL
  if (fileUrl.startsWith("/api/")) return fileUrl;
  // Direct Vercel Blob URL (legacy records) — route through proxy
  if (fileUrl.includes("vercel-storage.com") || fileUrl.includes("blob.vercel")) {
    return `/api/${companyId}/blob-proxy?u=${encodeURIComponent(fileUrl)}`;
  }
  return fileUrl;
}

type EditForm = {
  contractorName: string;
  amount: string;
  notes: string;
  status: string;
  bidDate: string;
  email: string;
};

type AddForm = {
  contractorName: string;
  email: string;
  amount: string;
  notes: string;
  bidDate: string;
};

type SendModal = {
  offer: SubBidOffer;
  bid: SubBidRow;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
} | null;

const FIELD_STYLE = { background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", outline: "none" };

function EditOfferForm({ formData, onChange, onSave, onCancel, saving }: {
  formData: EditForm;
  onChange: (f: EditForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-2">
      <input placeholder="Partner / Contractor name" value={formData.contractorName}
        onChange={e => onChange({ ...formData, contractorName: e.target.value })}
        className="w-full rounded-lg px-3 py-1.5 text-sm" style={FIELD_STYLE} />
      <input type="email" placeholder="Email (for sending)" value={formData.email}
        onChange={e => onChange({ ...formData, email: e.target.value })}
        className="w-full rounded-lg px-3 py-1.5 text-sm" style={FIELD_STYLE} />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Bid amount" value={formData.amount}
          onChange={e => onChange({ ...formData, amount: e.target.value })}
          className="w-full rounded-lg px-3 py-1.5 text-sm" style={FIELD_STYLE} />
        <input placeholder="Bid date (e.g. Apr 5, 2026)" value={formData.bidDate}
          onChange={e => onChange({ ...formData, bidDate: e.target.value })}
          className="w-full rounded-lg px-3 py-1.5 text-sm" style={FIELD_STYLE} />
      </div>
      <input placeholder="Notes" value={formData.notes}
        onChange={e => onChange({ ...formData, notes: e.target.value })}
        className="w-full rounded-lg px-3 py-1.5 text-sm" style={FIELD_STYLE} />
      <select value={formData.status} onChange={e => onChange({ ...formData, status: e.target.value })}
        className="w-full rounded-lg px-3 py-1.5 text-sm" style={FIELD_STYLE}>
        <option value="MISSING">MISSING</option>
        <option value="RECEIVED">RECEIVED</option>
        <option value="APPROVED">APPROVED</option>
      </select>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving}
          className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: "#C9A84C", color: "#0d1117" }}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs"
          style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SubsBidsTab({ clientId, companyId, clientName, subBids: initialSubBids, canEdit, canDelete, isCommercial = false }: Props) {
  const router = useRouter();
  const [subBids, setSubBids] = useState<SubBidRow[]>(initialSubBids);
  const [displayIsCommercial, setDisplayIsCommercial] = useState(isCommercial);
  const [togglingCommercial, setTogglingCommercial] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [triageDragId, setTriageDragId] = useState<string | null>(null);
  const [divisionDrag, setDivisionDrag] = useState<{ offerId: string; fromCode: string } | null>(null);
  const [triageOpen, setTriageOpen] = useState(true);
  const [triageSelected, setTriageSelected] = useState<Set<string>>(new Set());
  const [bulkMoving, setBulkMoving] = useState(false);
  const [formData, setFormData] = useState<EditForm>({ contractorName: "", amount: "", notes: "", status: "RECEIVED", bidDate: "", email: "" });
  const [addingToDivision, setAddingToDivision] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddForm>({ contractorName: "", email: "", amount: "", notes: "", bidDate: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [sendModal, setSendModal] = useState<SendModal>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function openAddPartner(divisionCode: string) {
    setAddingToDivision(divisionCode);
    setAddForm({ contractorName: "", email: "", amount: "", notes: "", bidDate: "" });
  }

  async function handleAddPartner(bid: SubBidRow) {
    if (!addForm.contractorName.trim()) return;
    setAddSaving(true);
    try {
      const amountVal = addForm.amount ? parseFloat(addForm.amount) : null;
      const record = await upsertSubBid({
        clientId, companyId,
        divisionCode: bid.divisionCode,
        divisionName: bid.divisionName,
        contractorName: addForm.contractorName.trim(),
        amount: amountVal && !isNaN(amountVal) ? amountVal : null,
        notes: addForm.notes || undefined,
        bidDate: addForm.bidDate || null,
        emailSource: addForm.email.trim() || null,
        status: "RECEIVED",
      });
      const newOffer: SubBidOffer = {
        id: record.id,
        contractorName: addForm.contractorName.trim(),
        amount: amountVal && !isNaN(amountVal) ? amountVal : null,
        notes: addForm.notes || null,
        fileUrl: null, fileName: null,
        bidDate: addForm.bidDate || null,
        emailSource: addForm.email.trim() || null,
        status: "RECEIVED",
        isPlaceholder: false,
        createdAt: new Date().toISOString(),
      };
      setSubBids(prev => prev.map(b =>
        b.divisionCode === bid.divisionCode
          ? { ...b, offers: [...b.offers.filter(o => !o.isPlaceholder || o.contractorName || o.amount), newOffer] }
          : b
      ));
      setAddingToDivision(null);
    } finally {
      setAddSaving(false);
    }
  }

  function openSendEmail(offer: SubBidOffer, bid: SubBidRow) {
    const recipientEmail = offer.emailSource ?? "";
    setSendModal({
      offer, bid,
      to: recipientEmail,
      cc: "mikebaruh@gmail.com",
      bcc: "",
      subject: `Bid Confirmation — Division ${bid.divisionCode} ${bid.divisionName}${clientName ? ` — ${clientName}` : ""}`,
      body: `Dear ${offer.contractorName ?? "Partner"},\n\nThank you for submitting your bid for Division ${bid.divisionCode} — ${bid.divisionName}${clientName ? ` on the ${clientName} project` : ""}.\n\n${offer.amount !== null ? `We have received your bid of $${fmt(offer.amount)}.\n\n` : ""}${offer.notes ? `Scope notes: ${offer.notes}\n\n` : ""}We will review all bids and be in touch shortly. Please don't hesitate to reach out with any questions.\n\nBest regards,\nMike Baruh\nMIBH Construction\n305.746.7307`,
    });
    setSendResult(null);
  }

  async function handleSendEmail() {
    if (!sendModal) return;
    setSending(true);
    setSendResult(null);
    try {
      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:32px 20px">
        <div style="background:#0d1117;padding:24px 28px;border-radius:10px 10px 0 0">
          <h2 style="margin:0 0 4px;color:#C9A84C;font-size:18px">Division ${sendModal.bid.divisionCode} — ${sendModal.bid.divisionName}</h2>
          <p style="margin:0;font-size:12px;color:#8b949e">${clientName ?? "MIBH Construction"}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 10px 10px">
          <p style="white-space:pre-line;font-size:14px;line-height:1.7">${sendModal.body.replace(/\n/g, "<br>")}</p>
          ${sendModal.offer.amount !== null ? `<div style="background:#f9fafb;border:2px solid #C9A84C;border-radius:8px;padding:16px 20px;margin:20px 0;text-align:center"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px">Bid Amount on Record</div><div style="font-size:30px;font-weight:700;font-family:monospace">$${fmt(sendModal.offer.amount)}</div></div>` : ""}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:13px;line-height:1.7">
            <strong>Mike Baruh</strong><br>Founder/CEO · MIBH Construction<br>
            CGC 1527069 | CCC 1336817<br>
            📱 305.746.7307 · 📧 mike@mibhconstruction.com
          </div>
        </div>
      </body></html>`;
      const res = await fetch(`/api/${companyId}/clients/${clientId}/send-bid-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: sendModal.to, cc: sendModal.cc || undefined, bcc: sendModal.bcc || undefined, subject: sendModal.subject, bodyHtml: html }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult("✓ Email sent successfully");
        setTimeout(() => { setSendModal(null); setSendResult(null); }, 1500);
      } else {
        setSendResult("Error: " + (data.error ?? "Unknown error"));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleBulkDelete() {
    if (triageSelected.size === 0) return;
    setBulkMoving(true);
    const ids = Array.from(triageSelected);
    await Promise.all(ids.map(id => deleteSubBid(id, clientId, companyId)));
    setSubBids(prev => prev.map(b => b.divisionCode === "00" ? { ...b, offers: b.offers.filter(o => !triageSelected.has(o.id)) } : b));
    setTriageSelected(new Set());
    setBulkMoving(false);
  }

  async function handleBulkMove(divCode: string) {
    if (triageSelected.size === 0 || !divCode) return;
    setBulkMoving(true);
    const ids = Array.from(triageSelected);
    await Promise.all(ids.map(id => assignTriageBid(id, divCode)));
    setTriageSelected(new Set());
    setBulkMoving(false);
  }

  function toggleTriageSelect(id: string) {
    setTriageSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  const missingDivisions = subBids.filter((b) => b.offers.every((o) => o.status === "MISSING" || (!o.amount && !o.contractorName)));

  async function handleDelete(divisionCode: string, offer: SubBidOffer) {
    setDeleting(offer.id);
    try {
      await deleteSubBid(offer.id, clientId, companyId);
      setSubBids((prev) => prev
        .map((b) => b.divisionCode === divisionCode ? { ...b, offers: b.offers.filter((o) => o.id !== offer.id) } : b)
        .filter((b) => b.offers.length > 0)
      );
    } finally {
      setDeleting(null);
    }
  }

  async function moveBid(offerId: string, fromCode: string, targetDivCode: string) {
    if (fromCode === targetDivCode) return;
    const division = [...STANDARD_DIVISIONS, ...COMMERCIAL_ONLY_DIVISIONS].find(d => d.code === targetDivCode);
    if (!division) return;
    const fromRow = subBids.find(b => b.divisionCode === fromCode);
    const offer = fromRow?.offers.find(o => o.id === offerId);
    if (!offer) return;

    await upsertSubBid({
      id: offerId,
      clientId, companyId,
      divisionCode: division.code,
      divisionName: division.name,
      contractorName: offer.contractorName ?? undefined,
      amount: offer.amount,
      notes: offer.notes ?? undefined,
      fileUrl: offer.fileUrl ?? undefined,
      fileName: offer.fileName ?? undefined,
      status: offer.status,
    });

    setSubBids(prev => {
      const next = prev.map(b =>
        b.divisionCode === fromCode
          ? { ...b, offers: b.offers.filter(o => o.id !== offerId) }
          : b
      ).filter(b => b.divisionCode !== fromCode || b.offers.length > 0);

      const updatedOffer = { ...offer };
      const existing = next.find(b => b.divisionCode === division.code);
      if (existing) {
        return next.map(b => b.divisionCode === division.code ? { ...b, offers: [...b.offers, updatedOffer] } : b);
      }
      return [...next, { divisionCode: division.code, divisionName: division.name, offers: [updatedOffer] }]
        .sort((a, b) => a.divisionCode.localeCompare(b.divisionCode));
    });
  }

  function assignTriageBid(offerId: string, targetDivCode: string) {
    return moveBid(offerId, "00", targetDivCode);
  }

  function openEdit(offer: SubBidOffer) {
    setEditingId(offer.id);
    setFormData({
      contractorName: offer.contractorName ?? "",
      amount: offer.amount !== null ? String(offer.amount) : "",
      notes: offer.notes ?? "",
      status: offer.status === "MISSING" ? "RECEIVED" : offer.status,
      bidDate: offer.bidDate ?? "",
      email: offer.emailSource ?? "",
    });
  }

  async function handleSave(bid: SubBidRow, offer: SubBidOffer) {
    setSaving(true);
    try {
      const amountVal = formData.amount ? parseFloat(formData.amount) : null;
      await upsertSubBid({
        id: offer.id,
        clientId, companyId,
        divisionCode: bid.divisionCode,
        divisionName: bid.divisionName,
        contractorName: formData.contractorName || undefined,
        amount: isNaN(amountVal as number) ? null : amountVal,
        notes: formData.notes || undefined,
        fileUrl: offer.fileUrl || undefined,
        fileName: offer.fileName || undefined,
        status: formData.status,
        bidDate: formData.bidDate || null,
        emailSource: formData.email || null,
      });
      setSubBids((prev) => prev.map((b) =>
        b.divisionCode === bid.divisionCode
          ? { ...b, offers: b.offers.map((o) => o.id === offer.id ? { ...o, contractorName: formData.contractorName || null, amount: amountVal && !isNaN(amountVal) ? amountVal : null, notes: formData.notes || null, status: formData.status, bidDate: formData.bidDate || null, emailSource: formData.email || null } : o) }
          : b
      ));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  const uploadFile = useCallback(async (file: File, bid: SubBidRow, offerId?: string) => {
    if (!file) return;
    setUploading(bid.divisionCode);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/${companyId}/upload-bid-pdf`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url, fileName, bidDate } = await res.json();
      const record = await upsertSubBid({
        id: offerId,
        clientId, companyId,
        divisionCode: bid.divisionCode,
        divisionName: bid.divisionName,
        fileUrl: url,
        fileName,
        status: "RECEIVED",
        bidDate: bidDate ?? null,
      });
      setSubBids((prev) => prev.map((b) => {
        if (b.divisionCode !== bid.divisionCode) return b;
        const existing = b.offers.find((o) => o.id === record.id);
        if (existing) {
          return { ...b, offers: b.offers.map((o) => o.id === record.id ? { ...o, fileUrl: url, fileName, bidDate: bidDate ?? null, status: "RECEIVED" } : o) };
        }
        // New offer (no placeholder existed) — append to list
        return { ...b, offers: [...b.offers, { id: record.id, contractorName: null, amount: null, notes: null, bidDate: bidDate ?? null, status: "RECEIVED", isPlaceholder: false, fileUrl: url, fileName, createdAt: new Date().toISOString() }] };
      }));
    } catch (e) {
      alert("Upload failed: " + String(e));
    } finally {
      setUploading(null);
    }
  }, [clientId, companyId]);

  async function handleToggleCommercial(val: boolean) {
    setDisplayIsCommercial(val);
    setTogglingCommercial(true);
    try {
      await fetch(`/api/${companyId}/clients/${clientId}/set-commercial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCommercial: val }),
      });
      router.refresh();
    } catch { /* ignore */ } finally {
      setTogglingCommercial(false);
    }
  }

  const allDivisions = displayIsCommercial
    ? [...STANDARD_DIVISIONS, ...COMMERCIAL_ONLY_DIVISIONS].sort((a, b) => a.code.localeCompare(b.code))
    : [...STANDARD_DIVISIONS];

  const triageRow = subBids.find(b => b.divisionCode === "00");
  const regularBids = subBids.filter(b => b.divisionCode !== "00");

  return (
    <div>
      {/* Commercial / Residential toggle */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-semibold" style={{ color: "#8b949e" }}>Project type:</span>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <button
            onClick={() => { void handleToggleCommercial(false); }}
            disabled={togglingCommercial}
            className="px-3 py-1.5 text-xs font-semibold transition-all"
            style={{ background: !displayIsCommercial ? "#C9A84C" : "transparent", color: !displayIsCommercial ? "#0d1117" : "#8b949e" }}
          >
            Residential
          </button>
          <button
            onClick={() => { void handleToggleCommercial(true); }}
            disabled={togglingCommercial}
            className="px-3 py-1.5 text-xs font-semibold transition-all"
            style={{ background: displayIsCommercial ? "#C9A84C" : "transparent", color: displayIsCommercial ? "#0d1117" : "#8b949e", borderLeft: "1px solid #30373f" }}
          >
            Commercial
          </button>
        </div>
        {displayIsCommercial && <span className="text-xs" style={{ color: "#C9A84C" }}>+ Div 11 Equipment · 13 Special Construction · 14 Conveying · 21 Fire Suppression · 27 Communications · 28 Electronic Safety · 31 Earthwork (Adv) · 32 Exterior Improvements · 33 Utilities</span>}
      </div>


      {/* Send email modal */}
      {sendModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSendModal(null)}>
          <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Send Bid Email</h3>
            <p className="text-[11px] mb-4" style={{ color: "#8b949e" }}>Division {sendModal.bid.divisionCode} — {sendModal.bid.divisionName} · {sendModal.offer.contractorName}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>To *</label>
                  <input type="email" value={sendModal.to} onChange={e => setSendModal(m => m && ({ ...m, to: e.target.value }))}
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", borderRadius: 6, padding: "6px 10px", fontSize: 13, width: "100%" }} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Cc</label>
                  <input type="email" value={sendModal.cc} onChange={e => setSendModal(m => m && ({ ...m, cc: e.target.value }))}
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", borderRadius: 6, padding: "6px 10px", fontSize: 13, width: "100%" }} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Subject</label>
                <input type="text" value={sendModal.subject} onChange={e => setSendModal(m => m && ({ ...m, subject: e.target.value }))}
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", borderRadius: 6, padding: "6px 10px", fontSize: 13, width: "100%" }} />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Message</label>
                <textarea rows={8} value={sendModal.body} onChange={e => setSendModal(m => m && ({ ...m, body: e.target.value }))}
                  style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", borderRadius: 6, padding: "6px 10px", fontSize: 13, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
              </div>
            </div>
            {sendResult && (
              <p className="text-xs mt-3" style={{ color: sendResult.startsWith("✓") ? "#22c55e" : "#f87171" }}>{sendResult}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={handleSendEmail} disabled={sending || !sendModal.to}
                className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ background: "#C9A84C", color: "#0d1117" }}>
                {sending ? "Sending…" : "✉ Send Email"}
              </button>
              <button onClick={() => setSendModal(null)}
                className="px-4 py-2 text-xs rounded-lg"
                style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {missingDivisions.length > 0 && (
        <div className="rounded-lg px-4 py-3 mb-5 text-sm" style={{ background: "#C9A84C22", border: "1px solid #C9A84C55", color: "#C9A84C" }}>
          <span className="font-semibold">⚠ {missingDivisions.length} division{missingDivisions.length !== 1 ? "s" : ""} missing bids:</span>{" "}
          {missingDivisions.map((b) => b.divisionName).join(", ")}
        </div>
      )}

      {/* Triage section */}
      {triageRow && triageRow.offers.length > 0 && (
        <div className="mb-6">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-2">
            {/* Left: collapse toggle */}
            <button onClick={() => setTriageOpen(o => !o)} className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f97316" }}>⚠ Triage</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f9731622", color: "#f97316" }}>{triageRow.offers.length}</span>
              <span className="text-xs" style={{ color: "#f97316" }}>{triageOpen ? "▲ Hide" : "▼ Show"}</span>
            </button>

            {/* Right side: select-all + bulk actions */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Select all / Deselect all — always visible when open */}
              {triageOpen && (
                <button
                  onClick={() => setTriageSelected(
                    triageSelected.size === triageRow.offers.length
                      ? new Set()
                      : new Set(triageRow.offers.map(o => o.id))
                  )}
                  className="px-2 py-1 rounded text-xs font-semibold"
                  style={{ background: "#f9731622", color: "#f97316", border: "1px solid #f9731644" }}
                >
                  {triageSelected.size === triageRow.offers.length && triageRow.offers.length > 0 ? "Deselect all" : "Select all"}
                </button>
              )}

              {/* Bulk actions — only when items selected */}
              {triageSelected.size > 0 && (
                <>
                  <span className="text-xs" style={{ color: "#8b949e" }}>{triageSelected.size} selected</span>
                  <select
                    value=""
                    disabled={bulkMoving}
                    onChange={(e) => { if (e.target.value) handleBulkMove(e.target.value); }}
                    style={{ background: "#1e2736", color: "#e6edf3", border: "1px solid #C9A84C66", borderRadius: 6, padding: "3px 6px", fontSize: 11, cursor: "pointer" }}
                  >
                    <option value="">Move to…</option>
                    {allDivisions.map(d => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
                  </select>
                  {canDelete && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkMoving}
                      className="px-2 py-1 rounded text-xs font-semibold disabled:opacity-50"
                      style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                    >Delete</button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Cards */}
          {triageOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {triageRow.offers.map(offer => {
                const isSelected = triageSelected.has(offer.id);
                return (
                  <div
                    key={offer.id}
                    draggable={!isSelected}
                    onDragStart={() => { if (!isSelected) setTriageDragId(offer.id); }}
                    onDragEnd={() => setTriageDragId(null)}
                    className="rounded-xl p-4 relative"
                    style={{ background: isSelected ? "#1e1000" : "#1a1200", border: `1px solid ${isSelected ? "#f97316" : "#f9731666"}`, opacity: triageDragId === offer.id ? 0.5 : 1, cursor: isSelected ? "default" : "grab" }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTriageSelect(offer.id)}
                      onClick={e => e.stopPropagation()}
                      className="absolute top-3 left-3"
                      style={{ accentColor: "#f97316", width: 14, height: 14, cursor: "pointer" }}
                    />
                    {!isSelected && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        {canEdit && (
                          <button onClick={() => openEdit(offer)}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }} title="Edit">
                            <PencilIcon size={9} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete("00", offer)} disabled={deleting === offer.id}
                            className="w-5 h-5 rounded flex items-center justify-center disabled:opacity-50"
                            style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }} title="Delete">
                            <TrashIcon size={10} />
                          </button>
                        )}
                      </div>
                    )}
                    {editingId === offer.id ? (
                      <div className="mt-2">
                        <EditOfferForm
                          formData={formData}
                          onChange={setFormData}
                          onSave={() => handleSave({ divisionCode: "00", divisionName: "Triage", offers: triageRow!.offers }, offer)}
                          onCancel={() => setEditingId(null)}
                          saving={saving}
                        />
                      </div>
                    ) : (
                    <>
                    <div className="text-xs font-bold mb-2 pl-5 pr-12" style={{ color: "#f97316" }}>Unassigned Bid</div>
                    {offer.contractorName && <div className="text-sm font-medium pl-5" style={{ color: "#e6edf3" }}>{offer.contractorName}</div>}
                    {offer.amount !== null && <div className="text-sm font-bold pl-5" style={{ color: "#C9A84C" }}>${fmt(offer.amount)}</div>}
                    {offer.notes && <div className="text-xs mt-1 pl-5" style={{ color: "#8b949e" }}>{offer.notes}</div>}
                    {offer.fileUrl && (() => {
                      const href = getPdfHref(offer.fileUrl, companyId);
                      return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs underline pl-5 block mt-1" style={{ color: "#C9A84C" }}>📄 {offer.fileName ?? "View PDF"}</a> : null;
                    })()}
                    {!isSelected && (
                      <div className="flex items-center gap-2 mt-3">
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) assignTriageBid(offer.id, e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ flex: 1, background: "#0d1117", color: "#e6edf3", border: "1px solid #f9731666", borderRadius: 6, padding: "4px 6px", fontSize: 11, cursor: "pointer" }}
                        >
                          <option value="">Move to…</option>
                          {allDivisions.map(d => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
                        </select>
                      </div>
                    )}
                    {offer.createdAt && (
                      <div className="text-xs mt-1.5 pl-5" style={{ color: "#6b7280" }} suppressHydrationWarning>
                        Date received: {fmtDate(offer.createdAt)}
                      </div>
                    )}
                    {!offer.createdAt && offer.bidDate && (
                      <div className="text-xs mt-1.5 pl-5" style={{ color: "#6b7280" }} suppressHydrationWarning>
                        {offer.bidDate}
                      </div>
                    )}
                    </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {regularBids.map((bid) => {
          const realOffers = bid.offers.filter((o) => !o.isPlaceholder || o.contractorName || o.amount);
          const hasOffers = realOffers.length > 0;
          const bestAmount = realOffers
            .filter((o) => o.amount !== null)
            .reduce((min, o) => (o.amount! < min ? o.amount! : min), Infinity);
          const displayBest = isFinite(bestAmount) ? bestAmount : null;
          const isTriageDrop = dragOver === bid.divisionCode && triageDragId !== null;
          const isDivisionDrop = dragOver === bid.divisionCode && divisionDrag !== null && divisionDrag.fromCode !== bid.divisionCode;
          const isDragging = dragOver === bid.divisionCode;
          const isUploading = uploading === bid.divisionCode;
          const placeholder = bid.offers.find((o) => o.isPlaceholder);

          return (
            <div
              key={bid.divisionCode}
              className="rounded-xl p-4 transition-all"
              style={{
                background: isDragging ? "#1e2736" : "#0d1117",
                border: isTriageDrop ? "2px dashed #f97316" : isDivisionDrop ? "2px dashed #C9A84C" : isDragging ? "2px dashed #C9A84C55" : hasOffers ? "1px solid #C9A84C44" : "1px solid #30373f",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(bid.divisionCode); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                if (triageDragId) {
                  assignTriageBid(triageDragId, bid.divisionCode);
                  setTriageDragId(null);
                  return;
                }
                if (divisionDrag && divisionDrag.fromCode !== bid.divisionCode) {
                  moveBid(divisionDrag.offerId, divisionDrag.fromCode, bid.divisionCode);
                  setDivisionDrag(null);
                  return;
                }
                const file = e.dataTransfer.files[0];
                if (file) uploadFile(file, bid, placeholder?.id);
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-xs" style={{ color: "#C9A84C" }}>Division {bid.divisionCode}</div>
                  <div className="font-semibold text-sm mt-0.5" style={{ color: "#e6edf3" }}>{bid.divisionName}</div>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-lg font-bold leading-none" style={{ color: displayBest !== null ? "#C9A84C" : "#484f58" }}>
                      {displayBest !== null ? `$${fmt(displayBest)}` : hasOffers ? "$ —" : ""}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: (hasOffers ? "#C9A84C" : "#ef4444") + "22", color: hasOffers ? "#C9A84C" : "#ef4444", border: `1px solid ${hasOffers ? "#C9A84C" : "#ef4444"}55` }}>
                      {hasOffers ? "RECEIVED" : "MISSING"}
                    </span>
                  </div>
                  {canEdit && (
                    <button onClick={() => openAddPartner(bid.divisionCode)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "#C9A84C", color: "#0d1117" }} title="Add partner">
                      +
                    </button>
                  )}
                </div>
              </div>

              {/* Inline add partner form */}
              {addingToDivision === bid.divisionCode && (
                <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: "#0d2a1a", border: "1px solid #22c55e55" }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: "#22c55e" }}>Add Partner</div>
                  <input placeholder="Partner / Company name *" value={addForm.contractorName} onChange={e => setAddForm(f => ({ ...f, contractorName: e.target.value }))}
                    className="w-full rounded px-2 py-1.5 text-xs" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
                  <input type="email" placeholder="Email (for sending)" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded px-2 py-1.5 text-xs" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Amount (optional)" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full rounded px-2 py-1.5 text-xs" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
                    <input placeholder="Bid date (e.g. Apr 5, 2026)" value={addForm.bidDate} onChange={e => setAddForm(f => ({ ...f, bidDate: e.target.value }))}
                      className="w-full rounded px-2 py-1.5 text-xs" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
                  </div>
                  <input placeholder="Notes (optional)" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded px-2 py-1.5 text-xs" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleAddPartner(bid)} disabled={addSaving || !addForm.contractorName.trim()}
                      className="flex-1 py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                      style={{ background: "#22c55e", color: "#fff" }}>
                      {addSaving ? "Adding…" : "Add Partner"}
                    </button>
                    <button onClick={() => setAddingToDivision(null)} className="px-3 py-1.5 text-xs rounded"
                      style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* All offers */}
              <div className="space-y-2">
                {realOffers.map((offer) => (
                  <div
                    key={offer.id}
                    draggable
                    onDragStart={() => setDivisionDrag({ offerId: offer.id, fromCode: bid.divisionCode })}
                    onDragEnd={() => setDivisionDrag(null)}
                    className="rounded-lg p-2.5 cursor-grab"
                    style={{ background: "#161b22", border: "1px solid #30373f", opacity: divisionDrag?.offerId === offer.id ? 0.5 : 1 }}
                  >
                    {editingId === offer.id ? (
                      <EditOfferForm
                        formData={formData}
                        onChange={setFormData}
                        onSave={() => handleSave(bid, offer)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            {offer.contractorName && <div className="text-sm font-medium" style={{ color: "#e6edf3" }}>{offer.contractorName}</div>}
                            {offer.amount !== null && <div className="text-sm font-bold" style={{ color: "#C9A84C" }}>${fmt(offer.amount)}</div>}
                            {offer.notes && <div className="text-xs" style={{ color: "#8b949e" }}>{offer.notes}</div>}
                            {offer.fileUrl && (() => {
                              const href = getPdfHref(offer.fileUrl, companyId);
                              return href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer"
                                  className="text-xs underline" style={{ color: "#C9A84C" }}>
                                  📄 {offer.fileName ?? "View PDF"}
                                </a>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {canEdit && offer.emailSource?.includes("@") && (
                              <button onClick={() => openSendEmail(offer, bid)}
                                className="w-6 h-6 rounded flex items-center justify-center text-xs"
                                style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}
                                title={`Email ${offer.emailSource}`}>
                                ✉
                              </button>
                            )}
                            {canEdit && (
                              <button onClick={() => openEdit(offer)}
                                className="w-6 h-6 rounded flex items-center justify-center"
                                style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                                title="Edit">
                                <PencilIcon size={12} />
                              </button>
                            )}
                            {canDelete && !offer.isPlaceholder && (
                              <button onClick={() => handleDelete(bid.divisionCode, offer)} disabled={deleting === offer.id}
                                className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                                title="Delete">
                                <TrashIcon size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {offer.createdAt && (
                          <div className="text-xs mt-1.5" style={{ color: "#6b7280" }} suppressHydrationWarning>
                            Date received: {fmtDate(offer.createdAt)}
                          </div>
                        )}
                        {!offer.createdAt && offer.bidDate && (
                          <div className="text-xs mt-1.5" style={{ color: "#6b7280" }} suppressHydrationWarning>
                            {offer.bidDate}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Drop zone */}
              {canEdit && (
                <div className="mt-3 rounded-lg px-3 py-2 text-center cursor-pointer text-xs transition-all"
                  style={{ border: "1px dashed #30373f", color: "#8b949e" }}
                  onClick={() => fileInputRefs.current[bid.divisionCode]?.click()}>
                  {isUploading ? "Uploading…" : isDragging ? "Drop file here" : "Drop PDF/Word or click to upload"}
                  <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
                    ref={(el) => { fileInputRefs.current[bid.divisionCode] = el; }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, bid, placeholder?.id); e.target.value = ""; }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
