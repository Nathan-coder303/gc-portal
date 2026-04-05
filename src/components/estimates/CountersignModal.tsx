"use client";

import { useRef, useState } from "react";

type Props = {
  companyId: string;
  templateId: string;
  estimateLabel: string;
  clientName: string | null;
  signedByName: string | null;
  signedAt: string | null;
  onDone: () => void;
  onClose: () => void;
};

export default function CountersignModal({
  companyId,
  templateId,
  estimateLabel,
  clientName,
  signedByName,
  signedAt,
  onDone,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    e.preventDefault();
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#e6edf3";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    lastPos.current = pos;
    setHasDrawn(true);
    e.preventDefault();
  }

  function stopDraw() {
    drawing.current = false;
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const signatureData = canvas.toDataURL("image/png");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${companyId}/estimates/${templateId}/countersign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData }),
      });
      const data = await res.json();
      if (res.ok) {
        onDone();
      } else {
        setError(data.error ?? "Failed to submit.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 space-y-5"
        style={{ background: "#161b22", border: "1px solid #22c55e55" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#22c55e88" }}>
              Contractor Countersignature
            </div>
            <div className="text-base font-bold" style={{ color: "#e6edf3" }}>{estimateLabel}</div>
            {clientName && <div className="text-sm mt-0.5" style={{ color: "#8b949e" }}>{clientName}</div>}
          </div>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "#8b949e" }}>×</button>
        </div>

        {/* Client signature confirmation */}
        {signedByName && (
          <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#0d2a1a", border: "1px solid #22c55e44", color: "#22c55e" }}>
            ✓ Signed by {signedByName}
            {signedAt && <> on {new Date(signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</>}
          </div>
        )}

        {/* Signature pad */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Your Signature (Mike Baruh)</label>
            <button
              onClick={clearCanvas}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: "#30373f", color: "#8b949e", border: "1px solid #484f58" }}
            >
              Clear
            </button>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "2px solid #30373f", background: "#0d1117", touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={160}
              className="w-full"
              style={{ cursor: "crosshair", display: "block" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          {!hasDrawn && (
            <p className="text-xs mt-1.5 text-center" style={{ color: "#484f58" }}>
              Draw your signature above
            </p>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !hasDrawn}
            className="flex-1 rounded-xl py-3 text-sm font-bold transition-opacity disabled:opacity-40"
            style={{ background: "#22c55e", color: "#fff" }}
          >
            {submitting ? "Processing…" : "Sign & Send to Both Parties"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl text-sm font-medium"
            style={{ background: "#30373f", color: "#8b949e" }}
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-center" style={{ color: "#484f58" }}>
          This generates the fully executed PDF and emails it to you and the client.
        </p>
      </div>
    </div>
  );
}
