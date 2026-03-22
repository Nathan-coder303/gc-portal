"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type EstimateInfo = {
  name: string;
  estimateNumber: string | null;
  estimateDate: string | null;
  clientName: string | null;
  companyName: string | null;
  clientSignedAt: string | null;
  clientSignedByName: string | null;
  alreadyCountersigned: boolean;
  counterSignedAt: string | null;
  pdfUrl: string | null;
};

export default function CountersignPage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<EstimateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`/api/countersign?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => setError("Failed to load estimate."))
      .finally(() => setLoading(false));
  }, [token]);

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
      ctx.strokeStyle = "#1e293b";
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
    try {
      const res = await fetch("/api/countersign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatureData }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error ?? "Failed to submit.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <p style={{ color: "#64748b" }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-md w-full rounded-2xl p-8 text-center shadow-lg" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold mb-2" style={{ color: "#1e293b" }}>Unable to load estimate</h1>
          <p style={{ color: "#64748b" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!info) return null;

  if (submitted || info.alreadyCountersigned) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-md w-full rounded-2xl p-8 text-center shadow-lg" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#1e293b" }}>
            {submitted ? "Countersigned!" : "Already Countersigned"}
          </h1>
          <p className="text-sm mb-1" style={{ color: "#64748b" }}>
            <span className="font-semibold">{info.name}</span>
          </p>
          {submitted && (
            <p className="text-sm mt-3" style={{ color: "#334155" }}>
              The countersigned estimate has been emailed to both you and the client.
            </p>
          )}
          <p className="text-xs mt-4" style={{ color: "#94a3b8" }}>
            The fully executed document has been sent to all parties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#f8fafc" }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-2xl p-6 shadow-sm" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#C9A84C" }}>
            Contractor Countersignature
          </p>
          <h1 className="text-xl font-bold mb-1" style={{ color: "#1e293b" }}>{info.name}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm" style={{ color: "#64748b" }}>
            {info.estimateNumber && <span>#{info.estimateNumber}</span>}
            {info.clientName && <span>{info.clientName}</span>}
          </div>
          {info.clientSignedByName && (
            <div className="mt-3 px-3 py-2 rounded-lg text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" }}>
              ✓ Signed by {info.clientSignedByName}
              {info.clientSignedAt && (
                <> on {new Date(info.clientSignedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</>
              )}
            </div>
          )}
        </div>

        {/* Signature pad */}
        <div className="rounded-2xl p-6 shadow-sm" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold" style={{ color: "#1e293b" }}>Your Signature (Mike Baruh)</label>
            <button
              onClick={clearCanvas}
              className="text-xs px-3 py-1 rounded-lg"
              style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }}
            >
              Clear
            </button>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "2px solid #e2e8f0", background: "#fafafa", touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
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
            <p className="text-xs mt-2 text-center" style={{ color: "#94a3b8" }}>
              Draw your signature above
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          {error && (
            <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || !hasDrawn}
            className="w-full rounded-xl py-3 text-sm font-bold transition-opacity disabled:opacity-40"
            style={{ background: "#C9A84C", color: "#fff" }}
          >
            {submitting ? "Processing…" : "Countersign & Send to Both Parties"}
          </button>
          <p className="text-xs text-center" style={{ color: "#94a3b8" }}>
            This will generate the fully executed document and email it to both you and the client.
          </p>
        </div>
      </div>
    </div>
  );
}
