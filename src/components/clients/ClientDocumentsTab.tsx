"use client";

import { useRef, useState } from "react";

type DocStatus = "awaiting_client" | "client_signed" | "executed";

type ClientDoc = {
  id: string;
  name: string;
  description: string | null;
  clientAlreadySigned: boolean;
  clientSignedAt: string | null;
  clientSignedByName: string | null;
  counterSignedAt: string | null;
  countersignedFileUrl: string | null;
  originalFileUrl: string;
  signatureToken: string | null;
  createdAt: string;
};

function docStatus(doc: ClientDoc): DocStatus {
  if (doc.counterSignedAt) return "executed";
  if (doc.clientSignedAt || doc.clientAlreadySigned) return "client_signed";
  return "awaiting_client";
}

const STATUS_LABEL: Record<DocStatus, string> = {
  awaiting_client: "Awaiting client signature",
  client_signed: "Client signed — countersign needed",
  executed: "Fully executed",
};
const STATUS_COLOR: Record<DocStatus, string> = {
  awaiting_client: "#f59e0b",
  client_signed: "#3b82f6",
  executed: "#22c55e",
};

type CountersignState = { docId: string; downloading: boolean } | null;

export default function ClientDocumentsTab({
  companyId,
  clientId,
  initialDocs,
}: {
  companyId: string;
  clientId: string;
  initialDocs: ClientDoc[];
}) {
  const [docs, setDocs] = useState<ClientDoc[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientAlreadySigned, setClientAlreadySigned] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Countersign modal state
  const [countersigning, setCountersigning] = useState<CountersignState>(null);
  const [csError, setCsError] = useState("");
  const [csHasDrawn, setCsHasDrawn] = useState(false);
  const [csDone, setCsDone] = useState<{ downloadUrl: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Clipboard state
  const [copied, setCopied] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !name.trim()) { setUploadError("Name and file are required."); return; }
    setUploadError(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("description", description.trim());
      fd.append("clientAlreadySigned", String(clientAlreadySigned));
      const res = await fetch(`/api/${companyId}/clients/${clientId}/documents`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      setDocs(prev => [data, ...prev]);
      setName(""); setDescription(""); setClientAlreadySigned(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch { setUploadError("Network error"); }
    finally { setUploading(false); }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/${companyId}/clients/${clientId}/documents?docId=${docId}`, { method: "DELETE" });
    setDocs(prev => prev.filter(d => d.id !== docId));
  }

  function copySignLink(doc: ClientDoc) {
    if (!doc.signatureToken) return;
    const url = `https://portal.mibhconstruction.com/sign-doc/${doc.signatureToken}`;
    navigator.clipboard.writeText(url);
    setCopied(doc.id);
    setTimeout(() => setCopied(null), 2000);
  }

  // ---- Signature pad ----
  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.stroke();
    }
    lastPos.current = pos;
    setCsHasDrawn(true);
    e.preventDefault();
  }

  function stopDraw() { drawing.current = false; lastPos.current = null; }

  function clearCanvas() {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setCsHasDrawn(false);
  }

  function openCountersign(docId: string) {
    setCountersigning({ docId, downloading: false });
    setCsError(""); setCsHasDrawn(false); setCsDone(null);
    setTimeout(() => canvasRef.current?.getContext("2d")?.clearRect(0, 0, 600, 160), 50);
  }

  async function submitCountersign() {
    const canvas = canvasRef.current;
    if (!canvas || !csHasDrawn || !countersigning) return;
    const signatureData = canvas.toDataURL("image/png");
    setCountersigning(prev => prev ? { ...prev, downloading: true } : null);
    setCsError("");
    try {
      const res = await fetch(
        `/api/${companyId}/clients/${clientId}/documents/${countersigning.docId}/countersign`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureData }) }
      );
      const data = await res.json();
      if (!res.ok) { setCsError(data.error ?? "Failed"); setCountersigning(prev => prev ? { ...prev, downloading: false } : null); return; }
      setCsDone({ downloadUrl: data.downloadUrl });
      setDocs(prev => prev.map(d =>
        d.id === countersigning.docId
          ? { ...d, counterSignedAt: new Date().toISOString(), countersignedFileUrl: data.downloadUrl }
          : d
      ));
    } catch { setCsError("Network error"); setCountersigning(prev => prev ? { ...prev, downloading: false } : null); }
  }

  const signingDoc = countersigning ? docs.find(d => d.id === countersigning.docId) : null;

  return (
    <div className="space-y-6">

      {/* Upload card */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Add Document</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Document Name *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Service Agreement" className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Description (optional)</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description" className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>PDF File *</label>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf"
            className="w-full text-sm" style={{ color: "#8b949e" }} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={clientAlreadySigned} onChange={e => setClientAlreadySigned(e.target.checked)}
            className="rounded" />
          <span className="text-sm" style={{ color: "#e6edf3" }}>Client has already signed this document (scan/physical copy)</span>
        </label>
        {!clientAlreadySigned && (
          <p className="text-xs" style={{ color: "#8b949e" }}>
            A signing link will be generated — copy it and send to your client.
          </p>
        )}
        {uploadError && <p className="text-xs font-medium" style={{ color: "#ef4444" }}>{uploadError}</p>}
        <button
          onClick={handleUpload} disabled={uploading}
          className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          style={{ background: "#C9A84C", color: "#fff" }}
        >
          {uploading ? "Uploading…" : "Upload Document"}
        </button>
      </div>

      {/* Documents list */}
      {docs.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#8b949e" }}>No documents yet.</p>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => {
            const status = docStatus(doc);
            return (
              <div key={doc.id} className="rounded-2xl p-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{doc.name}</p>
                    {doc.description && <p className="text-xs mt-0.5 truncate" style={{ color: "#8b949e" }}>{doc.description}</p>}
                    <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
                      Added {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
                    style={{ background: STATUS_COLOR[status] + "22", color: STATUS_COLOR[status] }}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>

                {/* Signed-by info */}
                {doc.clientSignedByName && (
                  <p className="text-xs mt-2" style={{ color: "#8b949e" }}>
                    Client signed by <span className="font-semibold" style={{ color: "#e6edf3" }}>{doc.clientSignedByName}</span>
                    {doc.clientSignedAt && <> on {new Date(doc.clientSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* View original */}
                  <a href={doc.originalFileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                    View PDF
                  </a>

                  {/* Copy signing link */}
                  {status === "awaiting_client" && doc.signatureToken && (
                    <button onClick={() => copySignLink(doc)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: copied === doc.id ? "#0d2a1a" : "#21262d", color: copied === doc.id ? "#22c55e" : "#8b949e", border: `1px solid ${copied === doc.id ? "#22c55e44" : "#30373f"}` }}>
                      {copied === doc.id ? "✓ Copied!" : "Copy Signing Link"}
                    </button>
                  )}

                  {/* Countersign */}
                  {status === "client_signed" && (
                    <button onClick={() => openCountersign(doc.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}>
                      ✍️ Countersign
                    </button>
                  )}

                  {/* Download executed */}
                  {status === "executed" && doc.countersignedFileUrl && (
                    <a href={doc.countersignedFileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: "#0d2a1a", color: "#22c55e", border: "1px solid #22c55e44" }}>
                      ⬇ Download Executed
                    </a>
                  )}

                  {/* Delete */}
                  <button onClick={() => handleDelete(doc.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg ml-auto"
                    style={{ background: "#21262d", color: "#ef4444", border: "1px solid #30373f" }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Countersign modal */}
      {countersigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => !countersigning.downloading && setCountersigning(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-5"
            style={{ background: "#161b22", border: "1px solid #C9A84C55" }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C9A84C88" }}>
                  Contractor Countersignature
                </p>
                <p className="text-base font-bold" style={{ color: "#e6edf3" }}>{signingDoc?.name}</p>
              </div>
              {!countersigning.downloading && !csDone && (
                <button onClick={() => setCountersigning(null)} className="text-xl leading-none" style={{ color: "#8b949e" }}>×</button>
              )}
            </div>

            {signingDoc?.clientSignedByName && (
              <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#0d2a1a", border: "1px solid #22c55e44", color: "#22c55e" }}>
                ✓ {signingDoc.clientAlreadySigned ? "Client signed externally" : `Signed by ${signingDoc.clientSignedByName}`}
                {signingDoc.clientSignedAt && <> on {new Date(signingDoc.clientSignedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</>}
              </div>
            )}

            {csDone ? (
              <div className="text-center space-y-4">
                <div className="text-4xl">✅</div>
                <p className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Document fully executed!</p>
                <p className="text-xs" style={{ color: "#8b949e" }}>The executed PDF has been emailed to both parties.</p>
                <div className="flex gap-3 justify-center">
                  <a href={csDone.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-bold px-4 py-2 rounded-lg"
                    style={{ background: "#0d2a1a", color: "#22c55e", border: "1px solid #22c55e44" }}>
                    ⬇ Download Executed PDF
                  </a>
                  <button onClick={() => setCountersigning(null)}
                    className="text-sm font-semibold px-4 py-2 rounded-lg"
                    style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Your Signature</label>
                    <button onClick={clearCanvas} className="text-xs px-3 py-1 rounded-lg"
                      style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                      Clear
                    </button>
                  </div>
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: "2px solid #30373f", background: "#ffffff", touchAction: "none" }}>
                    <canvas ref={canvasRef} width={600} height={160} className="w-full"
                      style={{ cursor: "crosshair", display: "block" }}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                  </div>
                  {!csHasDrawn && (
                    <p className="text-xs mt-1.5 text-center" style={{ color: "#484f58" }}>Draw your signature above</p>
                  )}
                </div>

                {csError && <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{csError}</p>}

                <div className="flex gap-3">
                  <button onClick={submitCountersign}
                    disabled={countersigning.downloading || !csHasDrawn}
                    className="flex-1 rounded-xl py-3 text-sm font-bold transition-opacity disabled:opacity-40"
                    style={{ background: "#C9A84C", color: "#fff" }}>
                    {countersigning.downloading ? "Processing…" : "Countersign & Email"}
                  </button>
                  <button onClick={() => setCountersigning(null)}
                    className="px-4 rounded-xl text-sm font-semibold"
                    style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
