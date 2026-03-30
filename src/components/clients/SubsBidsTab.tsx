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
    if (isNaN(d.getTime()) || d.getUTCFullYear() < 2020) return "—";
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const h = d.getUTCHours();
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
  } catch { return "—"; }
}

function getPdfHref(fileUrl: string, companyId: string): string {
  if (fileUrl.startsWith("gmail:")) {
    const parts = fileUrl.split(":");
    const msgId = parts[1];
    // "gmail:msgId" (2 parts) = email had no PDF — no link
    // "gmail:msgId:" (3 parts, empty attachmentId) = inline PDF — fetch from message
    // "gmail:msgId:attachmentId" (3 parts) = normal attachment
    if (parts.length < 3) return "";
    const attachmentId = parts[2];
    const url = `/api/${companyId}/gmail-attachment?msgId=${msgId}`;
    return attachmentId ? `${url}&attachmentId=${attachmentId}` : url;
  }
  return fileUrl;
}

type EditForm = {
  contractorName: string;
  amount: string;
  notes: string;
  status: string;
};

export default function SubsBidsTab({ clientId, companyId, clientName, clientAddress, subBids: initialSubBids, canEdit, canDelete, isCommercial = false }: Props) {
  const router = useRouter();
  const [subBids, setSubBids] = useState<SubBidRow[]>(initialSubBids);
  const [displayIsCommercial, setDisplayIsCommercial] = useState(isCommercial);
  const [togglingCommercial, setTogglingCommercial] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // divisionCode
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [triageDragId, setTriageDragId] = useState<string | null>(null);
  const [divisionDrag, setDivisionDrag] = useState<{ offerId: string; fromCode: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<string | null>(null);
  const [triageOpen, setTriageOpen] = useState(true);
  const [triageSelected, setTriageSelected] = useState<Set<string>>(new Set());
  const [bulkMoving, setBulkMoving] = useState(false);
  const [formData, setFormData] = useState<EditForm>({ contractorName: "", amount: "", notes: "", status: "RECEIVED" });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleExtractAmounts() {
    setExtracting(true);
    setExtractResult(null);
    try {
      const res = await fetch(`/api/${companyId}/extract-bid-amounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtractResult(`Error: ${data.error ?? "Failed"}`);
        return;
      }
      const errSummary = data.errors?.length ? ` · ${Array.from(new Set(data.errors as string[])).slice(0, 3).join(" | ")}` : "";
      setExtractResult(`Done — ${data.extracted} of ${data.total} extracted${errSummary}`);
      if (data.extracted > 0) router.refresh();
    } catch (e) {
      setExtractResult("Failed: " + String(e));
    } finally {
      setExtracting(false);
    }
  }

  async function handleSyncGmail() {
    setSyncing(true);
    setSyncResult(null);
    let totalAdded = 0;
    let round = 0;
    const MAX_ROUNDS = 20; // cap at ~600 emails processed per click
    try {
      while (round < MAX_ROUNDS) {
        round++;
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
        totalAdded += data.added ?? 0;
        setSyncResult(`Syncing… ${totalAdded} bids found so far (round ${round})`);
        if ((data.remaining ?? 0) === 0) break;
      }
      setSyncResult(`Done — ${totalAdded} new bid${totalAdded !== 1 ? "s" : ""} imported. Extracting amounts…`);
      // Auto-extract amounts from PDFs of newly synced bids
      const extractRes = await fetch(`/api/${companyId}/extract-bid-amounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const extractData = extractRes.ok ? await extractRes.json() : null;
      const extractedCount = extractData?.extracted ?? 0;
      setSyncResult(`Done — ${totalAdded} new bid${totalAdded !== 1 ? "s" : ""} imported, ${extractedCount} amount${extractedCount !== 1 ? "s" : ""} extracted`);
      if (totalAdded > 0 || extractedCount > 0) router.refresh();
    } catch (e) {
      setSyncResult("Sync failed: " + String(e));
    } finally {
      setSyncing(false);
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
      next.has(id) ? next.delete(id) : next.add(id);
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

      {/* Gmail sync + extract amounts buttons */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={handleSyncGmail}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: syncing ? "#1e2736" : "#C9A84C", color: syncing ? "#8b949e" : "#0d1117", border: "1px solid #C9A84C", opacity: syncing ? 0.7 : 1 }}
          >
            {syncing ? "Syncing Gmail…" : "Sync Gmail Bids"}
          </button>
          <button
            onClick={handleExtractAmounts}
            disabled={extracting}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: extracting ? "#1e2736" : "#1e2736", color: extracting ? "#8b949e" : "#C9A84C", border: "1px solid #C9A84C44", opacity: extracting ? 0.7 : 1 }}
          >
            {extracting ? "Extracting…" : "Extract Amounts from PDFs"}
          </button>
          {(syncResult || extractResult) && (
            <span className="text-xs" style={{ color: (syncResult ?? extractResult ?? "").startsWith("Error") || (syncResult ?? extractResult ?? "").startsWith("Failed") ? "#ef4444" : "#8b949e" }}>
              {extractResult ?? syncResult}
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

      {/* Triage section */}
      {triageRow && triageRow.offers.length > 0 && (
        <div className="mb-6">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setTriageOpen(o => !o)} className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f97316" }}>⚠ Triage — drag to assign division</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f9731622", color: "#f97316" }}>{triageRow.offers.length}</span>
              <span className="text-xs" style={{ color: "#f97316" }}>{triageOpen ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {/* Bulk action bar — only visible when items selected */}
            {triageSelected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs" style={{ color: "#8b949e" }}>{triageSelected.size} selected</span>
                <select
                  defaultValue=""
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
              </div>
            )}
            {/* Select all / clear */}
            {triageOpen && triageRow.offers.length > 0 && (
              <button
                onClick={() => setTriageSelected(
                  triageSelected.size === triageRow.offers.length
                    ? new Set()
                    : new Set(triageRow.offers.map(o => o.id))
                )}
                className="ml-auto text-xs"
                style={{ color: "#8b949e" }}
              >
                {triageSelected.size === triageRow.offers.length ? "Deselect all" : "Select all"}
              </button>
            )}
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
                    {canDelete && !isSelected && (
                      <button
                        onClick={() => handleDelete("00", offer)}
                        disabled={deleting === offer.id}
                        className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center disabled:opacity-50"
                        style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                        title="Delete">
                        <TrashIcon size={10} />
                      </button>
                    )}
                    <div className="text-xs font-bold mb-2 pl-5 pr-6" style={{ color: "#f97316" }}>Unassigned Bid</div>
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
                    <div className="flex items-center gap-1 text-xs mt-2 pl-5" style={{ color: "#8b949e" }} suppressHydrationWarning>
                      <span>📅</span><span>{offer.bidDate ?? (offer.createdAt ? fmtDate(offer.createdAt) : "—")}</span>
                    </div>
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
                if (file && placeholder) uploadFile(file, bid, placeholder.id);
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-xs" style={{ color: "#C9A84C" }}>Division {bid.divisionCode}</div>
                  <div className="font-semibold text-sm mt-0.5" style={{ color: "#e6edf3" }}>
                    {bid.divisionName}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-lg font-bold leading-none" style={{ color: displayBest !== null ? "#C9A84C" : "#484f58" }}>
                    {displayBest !== null ? `$${fmt(displayBest)}` : hasOffers ? "$ —" : ""}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: (hasOffers ? "#C9A84C" : "#ef4444") + "22", color: hasOffers ? "#C9A84C" : "#ef4444", border: `1px solid ${hasOffers ? "#C9A84C" : "#ef4444"}55` }}>
                    {hasOffers ? "RECEIVED" : "MISSING"}
                  </span>
                </div>
              </div>

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
                        <div className="flex items-center gap-1 text-xs mt-2" style={{ color: "#8b949e" }} suppressHydrationWarning>
                          <span>📅</span><span>{offer.bidDate ?? (offer.createdAt ? fmtDate(offer.createdAt) : "—")}</span>
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
