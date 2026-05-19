"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type LienInfo = {
  name: string;
  subName: string;
  clientName: string | null;
  alreadySigned: boolean;
  signedAt: string | null;
  signedByName: string | null;
  pdfUrl: string;
};

export default function SignLienPage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<LienInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`/api/sign-lien?token=${token}`)
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else setInfo(data); })
      .catch(() => setError("Failed to load document."))
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
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    lastPos.current = pos;
    setHasDrawn(true);
    e.preventDefault();
  }

  function stopDraw() { drawing.current = false; lastPos.current = null; }

  function clearCanvas() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn || !name.trim()) return;
    const signatureData = canvas.toDataURL("image/png");
    setSubmitting(true);
    try {
      const res = await fetch("/api/sign-lien", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatureData, signedByName: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) setSubmitted(true);
      else setError(data.error ?? "Failed to submit.");
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
      <p style={{ color: "#64748b" }}>Loading…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f8fafc" }}>
      <div className="max-w-md w-full rounded-2xl p-8 text-center shadow-lg" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-bold mb-2" style={{ color: "#1e293b" }}>Unable to load document</h1>
        <p style={{ color: "#64748b" }}>{error}</p>
      </div>
    </div>
  );

  if (!info) return null;

  if (submitted || info.alreadySigned) {
    const signedName = submitted ? name : info.signedByName;
    const signedDateObj = submitted ? new Date() : (info.signedAt ? new Date(info.signedAt) : null);
    const signedDate = signedDateObj?.toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short",
    });
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f8fafc" }}>
        <div className="max-w-md w-full rounded-2xl p-8 text-center shadow-lg" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#1e293b" }}>Document Signed</h1>
          <p className="text-sm font-semibold mb-1" style={{ color: "#64748b" }}>{info.name}</p>
          {signedName && (
            <p className="text-sm mt-3" style={{ color: "#334155" }}>
              Signed by <span className="font-semibold">{signedName}</span>
              {signedDate && <> on {signedDate}</>}
            </p>
          )}
          <a href={info.pdfUrl} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-4 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: "#fff7e6", color: "#C9A84C", border: "1px solid #C9A84C" }}>
            📄 View Signed Document
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#f8fafc" }}>
      <div className="max-w-lg mx-auto space-y-6">

        <div className="rounded-2xl p-6 shadow-sm" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#C9A84C" }}>
            MIBH Construction
          </p>
          <h1 className="text-xl font-bold mb-1" style={{ color: "#1e293b" }}>{info.name}</h1>
          {info.clientName && <p className="text-sm mt-1" style={{ color: "#64748b" }}>Project: {info.clientName}</p>}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm" style={{ color: "#334155" }}>
              Please review the document and sign below.
            </p>
            <button
              onClick={() => setShowPdf(v => !v)}
              className="shrink-0 ml-3 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "#fff7e6", color: "#C9A84C", border: "1px solid #C9A84C" }}>
              {showPdf ? "Hide" : "📄 View Document"}
            </button>
          </div>
        </div>

        {showPdf && (
          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #e2e8f0" }}>
            <iframe src={info.pdfUrl} className="w-full" style={{ height: "70vh", border: "none" }} title="Lien Release" />
          </div>
        )}

        <div className="rounded-2xl p-6 shadow-sm" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold" style={{ color: "#1e293b" }}>Your Signature</label>
            <button onClick={clearCanvas} className="text-xs px-3 py-1 rounded-lg"
              style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }}>Clear</button>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #e2e8f0", touchAction: "none" }}>
            <canvas ref={canvasRef} width={600} height={180} className="w-full"
              style={{ cursor: "crosshair", display: "block" }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
          </div>
          {!hasDrawn && (
            <p className="text-xs mt-2 text-center" style={{ color: "#94a3b8" }}>
              Draw your signature using mouse or touch
            </p>
          )}
        </div>

        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1e293b" }}>Print Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your full legal name" className="w-full rounded-xl px-4 py-2.5 text-sm"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#1e293b", outline: "none" }} />
          </div>
          {error && <p className="text-sm font-medium" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={handleSubmit} disabled={submitting || !hasDrawn || !name.trim()}
            className="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-40"
            style={{ background: "#C9A84C", color: "#fff" }}>
            {submitting ? "Submitting…" : "Sign & Submit"}
          </button>
          <p className="text-xs text-center" style={{ color: "#94a3b8" }}>
            By signing, you confirm you have read and agree to the lien waiver above.
          </p>
        </div>

      </div>
    </div>
  );
}
