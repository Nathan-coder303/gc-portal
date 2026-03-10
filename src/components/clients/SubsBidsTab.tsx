"use client";
import { useState, useRef, useCallback } from "react";
import { upsertSubBid } from "@/app/[companyId]/clients/actions";

export type SubBidRow = {
  id: string;
  divisionCode: string;
  divisionName: string;
  contractorName: string | null;
  amount: number | null;
  notes: string | null;
  fileUrl: string | null;
  fileName: string | null;
  status: string;
};

type Props = {
  clientId: string;
  companyId: string;
  subBids: SubBidRow[];
  canEdit: boolean;
};

function statusColor(status: string): string {
  switch (status) {
    case "RECEIVED": return "#C9A84C";
    case "APPROVED": return "#22c55e";
    default: return "#ef4444";
  }
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPdfHref(fileUrl: string, companyId: string): string {
  if (fileUrl.startsWith("gmail:")) {
    const [, msgId, attachmentId] = fileUrl.split(":");
    return `/api/${companyId}/gmail-attachment?msgId=${msgId}&attachmentId=${attachmentId}`;
  }
  return fileUrl;
}

type EditForm = {
  contractorName: string;
  amount: string;
  notes: string;
  fileUrl: string;
  fileName: string;
  status: string;
};

export default function SubsBidsTab({ clientId, companyId, subBids: initialSubBids, canEdit }: Props) {
  const [subBids, setSubBids] = useState<SubBidRow[]>(initialSubBids);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditForm>({
    contractorName: "", amount: "", notes: "", fileUrl: "", fileName: "", status: "RECEIVED",
  });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const missingBids = subBids.filter((b) => b.status === "MISSING");

  function openEdit(bid: SubBidRow) {
    setEditingCode(bid.divisionCode);
    setFormData({
      contractorName: bid.contractorName ?? "",
      amount: bid.amount !== null ? String(bid.amount) : "",
      notes: bid.notes ?? "",
      fileUrl: bid.fileUrl ?? "",
      fileName: bid.fileName ?? "",
      status: bid.status === "MISSING" ? "RECEIVED" : bid.status,
    });
  }

  async function handleSave(bid: SubBidRow) {
    setSaving(true);
    try {
      const amountVal = formData.amount ? parseFloat(formData.amount) : null;
      await upsertSubBid({
        clientId, companyId,
        divisionCode: bid.divisionCode,
        divisionName: bid.divisionName,
        contractorName: formData.contractorName || undefined,
        amount: isNaN(amountVal as number) ? null : amountVal,
        notes: formData.notes || undefined,
        fileUrl: formData.fileUrl || undefined,
        fileName: formData.fileName || undefined,
        status: formData.status,
      });
      setSubBids((prev) => prev.map((b) =>
        b.divisionCode === bid.divisionCode
          ? { ...b, contractorName: formData.contractorName || null, amount: amountVal && !isNaN(amountVal) ? amountVal : null, notes: formData.notes || null, fileUrl: formData.fileUrl || null, fileName: formData.fileName || null, status: formData.status }
          : b
      ));
      setEditingCode(null);
    } finally {
      setSaving(false);
    }
  }

  const uploadFile = useCallback(async (file: File, bid: SubBidRow) => {
    if (!file || file.type !== "application/pdf") return;
    setUploading(bid.divisionCode);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/${companyId}/upload-bid-pdf`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url, fileName } = await res.json();
      await upsertSubBid({
        clientId, companyId,
        divisionCode: bid.divisionCode,
        divisionName: bid.divisionName,
        contractorName: bid.contractorName || undefined,
        amount: bid.amount ?? undefined,
        notes: bid.notes || undefined,
        fileUrl: url,
        fileName,
        status: bid.status === "MISSING" ? "RECEIVED" : bid.status,
      });
      setSubBids((prev) => prev.map((b) =>
        b.divisionCode === bid.divisionCode
          ? { ...b, fileUrl: url, fileName, status: b.status === "MISSING" ? "RECEIVED" : b.status }
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
      {missingBids.length > 0 && (
        <div className="rounded-lg px-4 py-3 mb-5 text-sm" style={{ background: "#C9A84C22", border: "1px solid #C9A84C55", color: "#C9A84C" }}>
          <span className="font-semibold">&#9888; {missingBids.length} division{missingBids.length !== 1 ? "s" : ""} missing bids:</span>{" "}
          {missingBids.map((b) => b.divisionName).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subBids.map((bid) => {
          const isReceived = bid.status === "RECEIVED" || bid.status === "APPROVED";
          const isEditing = editingCode === bid.divisionCode;
          const isDragging = dragOver === bid.divisionCode;
          const isUploading = uploading === bid.divisionCode;

          return (
            <div
              key={bid.divisionCode}
              className="rounded-xl p-4 transition-all"
              style={{
                background: isDragging ? "#1e2736" : "#0d1117",
                border: isDragging ? "2px dashed #C9A84C" : isReceived ? "1px solid #C9A84C44" : "1px solid #30373f",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(bid.divisionCode); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const file = e.dataTransfer.files[0];
                if (file) uploadFile(file, bid);
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-xs" style={{ color: "#8b949e" }}>Division {bid.divisionCode}</div>
                  <div className="font-semibold text-sm mt-0.5" style={{ color: isReceived ? "#C9A84C" : "#e6edf3" }}>
                    {bid.divisionName}
                  </div>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: statusColor(bid.status) + "22", color: statusColor(bid.status), border: `1px solid ${statusColor(bid.status)}55` }}
                >
                  {bid.status}
                </span>
              </div>

              {/* Details */}
              {!isEditing && (
                <div className="space-y-1 mt-2">
                  {bid.contractorName && <div className="text-sm" style={{ color: "#e6edf3" }}>{bid.contractorName}</div>}
                  {bid.amount !== null && <div className="text-base font-bold" style={{ color: "#C9A84C" }}>${fmt(bid.amount)}</div>}
                  {bid.notes && <div className="text-xs" style={{ color: "#8b949e" }}>{bid.notes}</div>}

                  {/* PDF link */}
                  {bid.fileUrl && (
                    <a
                      href={getPdfHref(bid.fileUrl, companyId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline"
                      style={{ color: "#C9A84C" }}
                    >
                      📄 {bid.fileName ?? "View PDF"}
                    </a>
                  )}

                  {/* Drop zone / upload */}
                  {canEdit && (
                    <div
                      className="mt-3 rounded-lg px-3 py-2 text-center cursor-pointer text-xs transition-all"
                      style={{ border: "1px dashed #30373f", color: "#8b949e" }}
                      onClick={() => fileInputRefs.current[bid.divisionCode]?.click()}
                    >
                      {isUploading ? "Uploading…" : isDragging ? "Drop PDF here" : "Drop PDF or click to upload"}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[bid.divisionCode] = el; }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, bid); }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div className="mt-3 space-y-2">
                  {(["contractorName", "amount", "notes"] as const).map((field) => (
                    <input
                      key={field}
                      type={field === "amount" ? "number" : "text"}
                      placeholder={field === "contractorName" ? "Contractor name" : field === "amount" ? "Bid amount" : "Notes"}
                      value={formData[field]}
                      onChange={(e) => setFormData((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full rounded-lg px-3 py-1.5 text-sm"
                      style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }}
                    />
                  ))}
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg px-3 py-1.5 text-sm"
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }}
                  >
                    <option value="MISSING">MISSING</option>
                    <option value="RECEIVED">RECEIVED</option>
                    <option value="APPROVED">APPROVED</option>
                  </select>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleSave(bid)} disabled={saving} className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "#C9A84C", color: "#0d1117" }}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingCode(null)} className="rounded-lg px-3 py-1.5 text-xs" style={{ background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!isEditing && canEdit && (
                <button onClick={() => openEdit(bid)} className="mt-2 text-xs" style={{ color: "#8b949e" }}>Edit</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
