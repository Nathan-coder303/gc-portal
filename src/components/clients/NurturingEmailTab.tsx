"use client";

import { useState } from "react";
import { NURTURING_TEMPLATES, fillTemplate } from "@/lib/nurturing/templates";

const GOLD = "#C9A84C";
const INPUT_STYLE = { background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" };

export default function NurturingEmailTab({
  companyId,
  clientId,
  clientName,
  clientEmail,
}: {
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [toEmail, setToEmail] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"" | "sent" | "error">("");
  const [errorMsg, setErrorMsg] = useState("");

  const roofTemplates = NURTURING_TEMPLATES.filter((t) => t.type === "roof");
  const additionTemplates = NURTURING_TEMPLATES.filter((t) => t.type === "addition");

  function handleSelect(id: string) {
    setSelectedId(id);
    setStatus("");
    setErrorMsg("");
    if (!id) { setSubject(""); setBody(""); return; }
    const tmpl = NURTURING_TEMPLATES.find((t) => t.id === id);
    if (!tmpl) return;
    const filled = fillTemplate(tmpl, clientName);
    setSubject(filled.subject);
    setBody(filled.body);
  }

  async function handleSend() {
    if (!subject || !body || !toEmail) return;
    setSending(true);
    setStatus("");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/send-nurturing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, toEmail }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      setStatus("sent");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
      setStatus("error");
    } finally {
      setSending(false);
    }
  }

  const selected = NURTURING_TEMPLATES.find((t) => t.id === selectedId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold mb-1" style={{ color: "#e6edf3" }}>Nurturing Emails</h2>
        <p className="text-xs" style={{ color: "#8b949e" }}>
          Select a milestone email, review, edit, and send to {clientName}.
        </p>
      </div>

      {/* Dropdown */}
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: "#8b949e" }}>Select Template</label>
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={INPUT_STYLE}
        >
          <option value="">— Choose a nurturing email —</option>
          <optgroup label="🏠 Roofing">
            {roofTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.step}. {t.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="🏗 Home Addition">
            {additionTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.step}. {t.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {selected && (
        <>
          {/* Badge */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={
                selected.type === "roof"
                  ? { background: "#1e3a2a", color: "#4ade80", border: "1px solid #166534" }
                  : { background: "#1e2736", color: "#58a6ff", border: "1px solid #58a6ff44" }
              }
            >
              {selected.type === "roof" ? "🏠 Roofing" : "🏗 Addition"} — Step {selected.step}
            </span>
            <span className="text-xs font-semibold" style={{ color: GOLD }}>{selected.name}</span>
          </div>

          {/* To */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>To</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={INPUT_STYLE}
              placeholder="client@email.com"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={INPUT_STYLE}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none font-mono leading-relaxed"
              style={{ ...INPUT_STYLE, resize: "vertical" }}
            />
          </div>

          {/* Status */}
          {status === "sent" && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#0d2a1a", border: "1px solid #166534", color: "#4ade80" }}>
              ✓ Email sent to {toEmail}
            </div>
          )}
          {status === "error" && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#2d1b1b", border: "1px solid #6b2a2a", color: "#f87171" }}>
              {errorMsg || "Failed to send. Check Gmail OAuth token."}
            </div>
          )}

          {/* Send button */}
          <div className="flex gap-3 items-center">
            <button
              onClick={handleSend}
              disabled={sending || !toEmail || !subject || !body}
              className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: GOLD, color: "#0d1117" }}
            >
              {sending ? "Sending..." : "Send Email"}
            </button>
            {!clientEmail && (
              <span className="text-xs" style={{ color: "#f87171" }}>No email on file for this client — enter one above</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
