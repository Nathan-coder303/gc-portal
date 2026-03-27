"use client";

import { useState } from "react";

const MIKE_SIGNATURE = `Mike Baruh
Founder/CEO | MIBH Construction
Certified & Licensed General Contractor CGC 1527069
Certified & Licensed Roofer CCC 1336817

📱 Cell: 305.746.7307
📧 Email: mike@mibhconstruction.com
📍 Address: 2950 N 28 Terr, Hollywood, FL 33020
🌐 Website: www.mibhconstruction.com
📸 Instagram: @mibh_construction`;

type Props = {
  templateId: string;
  companyId: string;
  templateName: string;
  clientName: string;
  clientEmail: string | null;
  estimateNumber?: string | null;
  description?: string | null;
  clientAddress?: string | null;
};

export default function SendEstimateEmailButton({ templateId, companyId, templateName, clientName, clientEmail, estimateNumber, description, clientAddress }: Props) {
  const firstName = clientName.split(" ")[0];
  const defaultBody = `Dear ${firstName},\n\nPlease find attached your estimate for the project.\n\nDo not hesitate to contact us with any questions.\n\n${MIKE_SIGNATURE}`;

  const scope = description || templateName;
  const subjectParts = ["Estimate"];
  if (estimateNumber) subjectParts.push(`#${estimateNumber}`);
  subjectParts.push("from MIBH CONSTRUCTION");
  if (scope) subjectParts.push(`for ${scope}`);
  if (clientAddress) subjectParts.push(`at ${clientAddress}`);
  const defaultSubject = subjectParts.join(" ");

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(clientEmail ?? "");
  const [cc, setCc] = useState("mikebaruh@gmail.com");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function openModal() {
    setOpen(true);
    setResult(null);
    // Start fetching the PDF immediately so it's ready before the user clicks Send
    setPdfBlob(null);
    setPdfLoading(true);
    fetch(`/api/${companyId}/estimates/${templateId}/pdf`)
      .then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(blob => setPdfBlob(blob))
      .catch(() => setPdfBlob(null))
      .finally(() => setPdfLoading(false));
  }

  async function send() {
    if (!to) return;
    setSending(true);
    setResult(null);
    try {
      // If PDF isn't ready yet (still loading), wait for it
      let pdf = pdfBlob;
      if (!pdf && pdfLoading) {
        setResult({ ok: false, msg: "PDF still loading, please wait a moment and try again." });
        setSending(false);
        return;
      }
      if (!pdf) {
        // Fallback: try one more time
        const r = await fetch(`/api/${companyId}/estimates/${templateId}/pdf`);
        if (!r.ok) { setResult({ ok: false, msg: "Failed to generate PDF." }); setSending(false); return; }
        pdf = await r.blob();
      }

      const fd = new FormData();
      fd.append("templateId", templateId);
      fd.append("to", to);
      if (cc.trim()) fd.append("cc", cc.trim());
      if (bcc.trim()) fd.append("bcc", bcc.trim());
      fd.append("subject", subject);
      fd.append("body", body);
      fd.append("pdf", pdf, "estimate.pdf");

      const res = await fetch(`/api/${companyId}/send-estimate-email`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: "Email sent successfully!" });
        setTimeout(() => { setOpen(false); setResult(null); }, 2000);
      } else {
        setResult({ ok: false, msg: data.error ?? "Failed to send." });
      }
    } catch {
      setResult({ ok: false, msg: "Network error — try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="text-xs px-2 py-1 rounded-lg font-medium transition-colors"
        style={{ background: "#1a2436", border: "1px solid #30373f", color: "#8b949e" }}
        title="Send estimate via email"
      >
        ✉ Send
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>Send Estimate via Gmail</h2>
              <button onClick={() => setOpen(false)} style={{ color: "#8b949e" }} className="text-xl leading-none">×</button>
            </div>

            <p className="text-xs" style={{ color: "#8b949e" }}>
              Sending: <span style={{ color: "#C9A84C" }}>{templateName}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>To</label>
                <input
                  type="email"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                  placeholder="client@email.com"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>CC</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={e => setCc(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="cc@email.com"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>BCC</label>
                  <input
                    type="text"
                    value={bcc}
                    onChange={e => setBcc(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="bcc@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Message</label>
                <textarea
                  rows={10}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", resize: "vertical" }}
                />
              </div>
            </div>

            {result && (
              <p className="text-sm font-medium" style={{ color: result.ok ? "#22c55e" : "#ef4444" }}>
                {result.msg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={send}
                disabled={sending || pdfLoading || !to}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {sending ? "Sending…" : pdfLoading ? "Preparing PDF…" : "Send Email + PDF"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-5 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: "#30373f", color: "#e6edf3" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
