"use client";
import { useState, useRef, useCallback } from "react";

const MIKE_CC = "mikebaruh@gmail.com";
const MIKE_SIGNATURE = `Mike Baruh
Founder/CEO | MIBH Construction
Certified & Licensed General Contractor CGC 1527069
Certified & Licensed Roofer CCC 1336817

📱 Cell: 305.746.7307
📧 Email: mike@mibhconstruction.com
📍 Address: 2950 N 28 Terr, Hollywood, FL 33020
🌐 Website: www.mibhconstruction.com
📸 Instagram: @mibh_construction`;

type Email = {
  id: string;
  fromEmail: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body: string;
  sentAt: string;
  sentBy?: string | null;
  context?: string | null;
};

function ComposeModal({
  companyId,
  clientId,
  defaultTo,
  onClose,
  onSent,
}: {
  companyId: string;
  clientId: string;
  defaultTo: string;
  onClose: () => void;
  onSent: (email: Email) => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState(MIKE_CC);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(`\n\n${MIKE_SIGNATURE}`);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    setAttachments(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const newFiles = Array.from(files).filter(f => !existing.has(f.name + f.size));
      return [...prev, ...newFiles];
    });
  }, []);

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function send() {
    if (!to || !subject || !body) { setError("To, subject, and body are required."); return; }
    setSending(true);
    setError("");
    const fd = new FormData();
    fd.append("to", to);
    if (cc) fd.append("cc", cc);
    fd.append("subject", subject);
    fd.append("body", body);
    attachments.forEach(f => fd.append("attachments", f));
    const res = await fetch(`/api/${companyId}/clients/${clientId}/emails`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setError(data.error ?? "Failed to send"); return; }
    onSent(data);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "#161b22", border: "1px solid #30373f" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-base" style={{ color: "#C9A84C" }}>New Email</h3>
          <button onClick={onClose} style={{ color: "#888" }} className="text-xl leading-none">✕</button>
        </div>

        {[
          { label: "To", value: to, set: setTo },
          { label: "CC", value: cc, set: setCc },
          { label: "Subject", value: subject, set: setSubject },
        ].map(({ label, value, set }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-16 text-xs shrink-0" style={{ color: "#888" }}>{label}</span>
            <input
              value={value}
              onChange={e => set(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
            />
          </div>
        ))}

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={8}
          placeholder="Write your message…"
          className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
        />

        {/* Attachments drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg px-3 py-3 text-xs cursor-pointer transition-all flex items-center gap-2"
          style={{
            border: `1px dashed ${dragOver ? "#C9A84C" : "#30373f"}`,
            background: dragOver ? "#1a1508" : "#0d1117",
            color: dragOver ? "#C9A84C" : "#666",
          }}
        >
          <span style={{ fontSize: 16 }}>📎</span>
          <span>Drag & drop files here, or click to browse</span>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-col gap-1">
            {attachments.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs"
                style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span>📄</span>
                  <span className="truncate" style={{ color: "#e6edf3" }}>{f.name}</span>
                  <span style={{ color: "#555", flexShrink: 0 }}>{formatBytes(f.size)}</span>
                </div>
                <button onClick={() => removeAttachment(i)} className="ml-2 shrink-0" style={{ color: "#f87171" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

        <div className="flex justify-end gap-3 mt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "#1e2736", color: "#888" }}>
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#C9A84C", color: "#0d1117", opacity: sending ? 0.6 : 1 }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailDetailModal({ email, onClose }: { email: Email; onClose: () => void }) {
  const date = new Date(email.sentAt).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const contextBadge: Record<string, string> = {
    estimate: "#3b82f6",
    invoice: "#22c55e",
    manual: "#C9A84C",
  };
  const ctx = email.context ?? "manual";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "#161b22", border: "1px solid #30373f" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-base" style={{ color: "#e6edf3" }}>{email.subject}</h3>
            <span className="text-xs" style={{ color: "#888" }}>{date}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase"
              style={{ background: contextBadge[ctx] + "22", color: contextBadge[ctx], border: `1px solid ${contextBadge[ctx]}44` }}>
              {ctx}
            </span>
            <button onClick={onClose} style={{ color: "#888" }} className="text-xl leading-none">✕</button>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm" style={{ color: "#888" }}>
          <div><span className="font-medium" style={{ color: "#aaa" }}>From: </span>{email.fromEmail}</div>
          <div><span className="font-medium" style={{ color: "#aaa" }}>To: </span>{email.to}</div>
          {email.cc && <div><span className="font-medium" style={{ color: "#aaa" }}>CC: </span>{email.cc}</div>}
          {email.sentBy && <div><span className="font-medium" style={{ color: "#aaa" }}>Sent by: </span>{email.sentBy}</div>}
        </div>

        <div className="rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: "#c9d1d9" }}>
          {email.body}
        </div>
      </div>
    </div>
  );
}

export default function ClientCommsTab({
  companyId,
  clientId,
  clientEmail,
  initialEmails,
}: {
  companyId: string;
  clientId: string;
  clientEmail: string | null;
  initialEmails: Email[];
}) {
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<Email | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this email from the log?")) return;
    setDeleting(id);
    await fetch(`/api/${companyId}/clients/${clientId}/emails/${id}`, { method: "DELETE" });
    setEmails(prev => prev.filter(em => em.id !== id));
    if (viewing?.id === id) setViewing(null);
    setDeleting(null);
  }

  const contextBadge: Record<string, string> = {
    estimate: "#3b82f6",
    invoice: "#22c55e",
    manual: "#C9A84C",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base" style={{ color: "#e6edf3" }}>Communications</h2>
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>{emails.length} email{emails.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "#C9A84C", color: "#0d1117" }}
        >
          + Compose
        </button>
      </div>

      {/* Email list */}
      {emails.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          <p className="text-sm" style={{ color: "#888" }}>No emails sent yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {emails.map(email => {
            const date = new Date(email.sentAt).toLocaleString("en-US", {
              month: "short", day: "numeric", year: "numeric",
              hour: "numeric", minute: "2-digit",
            });
            const ctx = email.context ?? "manual";
            const preview = email.body.replace(/\n/g, " ").slice(0, 100);

            return (
              <div
                key={email.id}
                className="rounded-xl p-4 transition-all hover:scale-[1.005] cursor-pointer"
                style={{ background: "#161b22", border: "1px solid #30373f" }}
                onClick={() => setViewing(email)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate" style={{ color: "#e6edf3" }}>{email.subject}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0"
                        style={{ background: contextBadge[ctx] + "22", color: contextBadge[ctx] }}>
                        {ctx}
                      </span>
                    </div>
                    <div className="text-xs truncate" style={{ color: "#888" }}>To: {email.to}</div>
                    <div className="text-xs truncate mt-1" style={{ color: "#666" }}>{preview}{email.body.length > 100 ? "…" : ""}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs" style={{ color: "#555" }}>{date}</div>
                    <button
                      onClick={e => handleDelete(email.id, e)}
                      disabled={deleting === email.id}
                      className="px-2 py-1 rounded-lg text-xs"
                      style={{ background: "#2d1a1a", color: "#f87171", border: "1px solid #f8717133" }}
                    >
                      {deleting === email.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {composing && (
        <ComposeModal
          companyId={companyId}
          clientId={clientId}
          defaultTo={clientEmail ?? ""}
          onClose={() => setComposing(false)}
          onSent={email => setEmails(prev => [email, ...prev])}
        />
      )}

      {viewing && (
        <EmailDetailModal email={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
