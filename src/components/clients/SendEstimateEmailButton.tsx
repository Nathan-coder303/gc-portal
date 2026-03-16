"use client";

import { useState } from "react";

type Props = {
  templateId: string;
  companyId: string;
  templateName: string;
  clientName: string;
  clientEmail: string | null;
};

export default function SendEstimateEmailButton({ templateId, companyId, templateName, clientName, clientEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState(`Estimate – ${clientName}`);
  const [body, setBody] = useState(
    `Dear ${clientName},\n\nPlease find attached your estimate for the project.\n\nDo not hesitate to contact us with any questions.\n\nBest regards,\nMike Baruh\nMIBH Construction\n305-746-7307`
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function send() {
    if (!to) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/${companyId}/send-estimate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, to, subject, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: "Email sent successfully!" });
        setTimeout(() => { setOpen(false); setResult(null); }, 2000);
      } else {
        setResult({ ok: false, msg: data.error ?? "Failed to send." });
      }
    } catch {
      setResult({ ok: false, msg: "Network error." });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setResult(null); }}
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
                  rows={8}
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
                disabled={sending || !to}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {sending ? "Sending…" : "Send Email + PDF"}
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
