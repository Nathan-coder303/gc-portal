"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upsertSubBid, deleteSubBid } from "@/app/[companyId]/clients/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";

export type SubBidOffer = {
  id: string;
  contractorName: string | null;
  amount: number | null;
  notes: string | null;
  fileUrl: string | null;
  fileName: string | null;
  status: string;
  isPlaceholder: boolean;
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
};


function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPdfHref(fileUrl: string, companyId: string): string {
  if (fileUrl.startsWith("gmail:")) {
    const parts = fileUrl.split(":");
    const msgId = parts[1];
    const attachmentId = parts[2];
    if (!attachmentId) return ""; // gmail message with no PDF attachment
    return `/api/${companyId}/gmail-attachment?msgId=${msgId}&attachmentId=${attachmentId}`;
  }
  return fileUrl;
}

type EditForm = {
  contractorName: string;
  amount: string;
  notes: string;
  status: string;
};

export default function SubsBidsTab({ clientId, companyId, clientName, clientAddress, subBids: initialSubBids, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [subBids, setSubBids] = useState<SubBidRow[]>(initialSubBids);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // divisionCode
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditForm>({ contractorName: "", amount: "", notes: "", status: "RECEIVED" });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleSyncGmail() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/${companyId}/fetch-gmail-bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientName, clientAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error ?? "Sync failed"}`);
        return;
      }
      const msg = `Done — ${data.added} new bid${data.added !== 1 ? "s" : ""} imported${data.remaining > 0 ? `, ${data.remaining} more emails pending (sync again)` : ""}`;
      setSyncResult(msg);
      if (data.added > 0) router.refresh();
    } catch (e) {
      setSyncResult("Sync failed: " + String(e));
    } finally {
      setSyncing(false);
    }
  }

  const missingDivisions = subBids.filter((b) => b.offers.every((o) => o.status === "MISSING" || (!o.amount && !o.contractorName)));

  async function handleDelete(bid: SubBidRow, offer: SubBidOffer) {
    if (!confirm(`Delete bid from "${offer.contractorName ?? "unknown"}"? This cannot be undone.`)) return;
    setDeleting(offer.id);
    try {
      await deleteSubBid(offer.id, clientId, companyId);
      setSubBids((prev) => prev.map((b) =>
        b.divisionCode === bid.divisionCode
          ? { ...b, offers: b.offers.filter((o) => o.id !== offer.id) }
          : b
      ));
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(offer: SubBidOffer) {
    setEditingId(offer.id);
    setFormData({
      contractorName: offer.contractorName ?? "",
      amount: offer.amount !== null ? String(offer.amount) : "",
      notes: offer.notes ?? "",
      status: offer.status === "MISSING" ? "RECEIVED" : offer.status,
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
      });
      setSubBids((prev) => prev.map((b) =>
        b.divisionCode === bid.divisionCode
          ? { ...b, offers: b.offers.map((o) => o.id === offer.id ? { ...o, contractorName: formData.contractorName || null, amount: amountVal && !isNaN(amountVal) ? amountVal : null, notes: formData.notes || null, status: formData.status } : o) }
          : b
      ));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  const uploadFile = useCallback(async (file: File, bid: SubBidRow, offerId: string) => {
    if (!file || file.type !== "application/pdf") return;
    setUploading(bid.divisionCode);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/${companyId}/upload-bid-pdf`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url, fileName } = await res.json();
      await upsertSubBid({
        id: offerId,
        clientId, companyId,
        divisionCode: bid.divisionCode,
        divisionName: bid.divisionName,
        fileUrl: url,
        fileName,
        status: "RECEIVED",
      });
      setSubBids((prev) => prev.map((b) =>
        b.divisionCode === bid.divisionCode
          ? { ...b, offers: b.offers.map((o) => o.id === offerId ? { ...o, fileUrl: url, fileName, status: "RECEIVED" } : o) }
          : b
      ));
    } catch (e) {
      alert("Upload failed: " + String(e));
    } finally {
      setUploading(null);
    }
  }, [clientId, companyId]);

  return (
    <div>
      {/* Gmail sync button */}
      {canEdit && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleSyncGmail}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: syncing ? "#1e2736" : "#C9A84C", color: syncing ? "#8b949e" : "#0d1117", border: "1px solid #C9A84C", opacity: syncing ? 0.7 : 1 }}
          >
            {syncing ? "Syncing Gmail…" : "Sync Gmail Bids"}
          </button>
          {syncResult && (
            <span className="text-xs" style={{ color: syncResult.startsWith("Error") ? "#ef4444" : "#8b949e" }}>
              {syncResult}
            </span>
          )}
        </div>
      )}

      {missingDivisions.length > 0 && (
        <div className="rounded-lg px-4 py-3 mb-5 text-sm" style={{ background: "#C9A84C22", border: "1px solid #C9A84C55", color: "#C9A84C" }}>
          <span className="font-semibold">⚠ {missingDivisions.length} division{missingDivisions.length !== 1 ? "s" : ""} missing bids:</span>{" "}
          {missingDivisions.map((b) => b.divisionName).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subBids.map((bid) => {
          const realOffers = bid.offers.filter((o) => !o.isPlaceholder || o.contractorName || o.amount);
          const hasOffers = realOffers.length > 0;
          const isDragging = dragOver === bid.divisionCode;
          const isUploading = uploading === bid.divisionCode;
          const placeholder = bid.offers.find((o) => o.isPlaceholder);

          return (
            <div
              key={bid.divisionCode}
              className="rounded-xl p-4 transition-all"
              style={{
                background: isDragging ? "#1e2736" : "#0d1117",
                border: isDragging ? "2px dashed #C9A84C" : hasOffers ? "1px solid #C9A84C44" : "1px solid #30373f",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(bid.divisionCode); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const file = e.dataTransfer.files[0];
                if (file && placeholder) uploadFile(file, bid, placeholder.id);
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-xs" style={{ color: "#C9A84C" }}>Division {bid.divisionCode}</div>
                  <div className="font-semibold text-sm mt-0.5" style={{ color: "#C9A84C" }}>
                    {bid.divisionName}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: (hasOffers ? "#C9A84C" : "#ef4444") + "22", color: hasOffers ? "#C9A84C" : "#ef4444", border: `1px solid ${hasOffers ? "#C9A84C" : "#ef4444"}55` }}>
                  {hasOffers ? "RECEIVED" : "MISSING"}
                </span>
              </div>

              {/* All offers */}
              <div className="space-y-2">
                {realOffers.map((offer) => (
                  <div key={offer.id} className="rounded-lg p-2.5" style={{ background: "#161b22", border: "1px solid #30373f" }}>
                    {editingId === offer.id ? (
                      <div className="space-y-2">
                        {(["contractorName", "amount", "notes"] as const).map((field) => (
                          <input key={field} type={field === "amount" ? "number" : "text"}
                            placeholder={field === "contractorName" ? "Contractor name" : field === "amount" ? "Bid amount" : "Notes"}
                            value={formData[field]}
                            onChange={(e) => setFormData((f) => ({ ...f, [field]: e.target.value }))}
                            className="w-full rounded-lg px-3 py-1.5 text-sm"
                            style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }} />
                        ))}
                        <select value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                          className="w-full rounded-lg px-3 py-1.5 text-sm"
                          style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }}>
                          <option value="MISSING">MISSING</option>
                          <option value="RECEIVED">RECEIVED</option>
                          <option value="APPROVED">APPROVED</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => handleSave(bid, offer)} disabled={saving}
                            className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                            style={{ background: "#C9A84C", color: "#0d1117" }}>
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1.5 text-xs"
                            style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
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
                        <div className="flex flex-col gap-1 shrink-0">
                          {canEdit && (
                            <button onClick={() => openEdit(offer)}
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                              title="Edit">
                              <PencilIcon size={12} />
                            </button>
                          )}
                          {canDelete && !offer.isPlaceholder && (
                            <button onClick={() => handleDelete(bid, offer)} disabled={deleting === offer.id}
                              className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                              style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                              title="Delete">
                              <TrashIcon size={12} />
                            </button>
                          )}
                        </div>
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
                  {isUploading ? "Uploading…" : isDragging ? "Drop PDF here" : "Drop PDF or click to upload"}
                  <input type="file" accept="application/pdf" className="hidden"
                    ref={(el) => { fileInputRefs.current[bid.divisionCode] = el; }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f && placeholder) uploadFile(f, bid, placeholder.id); }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
