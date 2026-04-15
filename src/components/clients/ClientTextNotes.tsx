"use client";

import { useState, useEffect, useCallback } from "react";

const MIKE_SIGNATURE = `Mike Baruh
Founder/CEO | MIBH Construction
Certified & Licensed General Contractor CGC 1527069
Certified & Licensed Roofer CCC 1336817

📱 Cell: 305.746.7307
📧 Email: mike@mibhconstruction.com
📍 Address: 2950 N 28 Terr, Hollywood, FL 33020
🌐 Website: www.mibhconstruction.com
📸 Instagram: @mibh_construction`;

type TextNote = {
  id: string;
  content: string;
  noteDate: string;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD in ET
}

export default function ClientTextNotes({
  companyId,
  clientId,
  clientName,
  clientAddress,
  clientEmail,
}: {
  companyId: string;
  clientId: string;
  clientName?: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
}) {
  const firstName = clientName?.split(" ")[0] ?? "there";
  const defaultSubject = `Your Project at ${clientAddress ?? "Your Property"}`;
  const defaultBody = `Dear ${firstName},\n\n{{NOTE}}\n\n${MIKE_SIGNATURE}`;

  const [notes, setNotes] = useState<TextNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDate, setEditDate] = useState("");

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [to, setTo] = useState(clientEmail ?? "");
  const [cc, setCc] = useState("mikebaruh@gmail.com");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${companyId}/notes?clientId=${clientId}`);
      if (res.ok) setNotes(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId, clientId]);

  useEffect(() => { load(); }, [load]);

  function openCompose() {
    if (!content.trim()) return;
    setTo(clientEmail ?? "");
    setCc("mikebaruh@gmail.com");
    setBcc("");
    setSubject(defaultSubject);
    setEmailBody(defaultBody.replace("{{NOTE}}", content.trim()));
    setSendResult(null);
    setShowCompose(true);
  }

  async function saveNoteOnly() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, content: content.trim(), noteDate: new Date(noteDate + "T12:00:00Z").toISOString(), sendEmail: false }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes((prev) => [note, ...prev]);
        setContent("");
        setNoteDate(todayISO());
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendEmail() {
    if (!to) return;
    setSending(true);
    setSendResult(null);
    try {
      // Save note first
      const noteRes = await fetch(`/api/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          content: content.trim(),
          noteDate: new Date(noteDate + "T12:00:00Z").toISOString(),
          sendEmail: true,
          emailSubject: subject,
          emailTo: to,
          emailCc: cc,
          emailBcc: bcc,
          emailBody,
        }),
      });
      if (!noteRes.ok) { setSendResult({ ok: false, msg: "Failed to save note" }); return; }
      const note = await noteRes.json();
      setNotes((prev) => [note, ...prev]);
      setSendResult({ ok: true, msg: `Email sent to ${to}` });
      setTimeout(() => {
        setShowCompose(false);
        setContent("");
        setNoteDate(todayISO());
        setSendResult(null);
      }, 2000);
    } finally {
      setSending(false);
    }
  }

  async function deleteNote(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await fetch(`/api/${companyId}/notes?noteId=${noteId}`, { method: "DELETE" });
  }

  function startEdit(note: TextNote) {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditDate(note.noteDate.slice(0, 10));
  }

  async function saveEdit(noteId: string) {
    if (!editContent.trim()) return;
    await fetch(`/api/${companyId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, content: editContent.trim(), noteDate: new Date(editDate + "T12:00:00Z").toISOString() }),
    });
    setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, content: editContent.trim(), noteDate: new Date(editDate).toISOString() } : n));
    setEditingId(null);
  }

  return (
    <>
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>Text Notes</h3>

        {/* Add note form */}
        <div className="mb-4 space-y-2">
          <div>
            <label style={{ color: "#484f58", fontSize: 10, fontWeight: 600, display: "block", marginBottom: 3 }}>DATE</label>
            <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)}
              style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
          </div>
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Note for ${firstName}…`}
            style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveNoteOnly} disabled={saving || !content.trim()}
              style={{ background: "#1e2736", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving || !content.trim() ? 0.5 : 1 }}>
              {saving ? "Saving…" : "Add Note"}
            </button>
            {clientEmail && (
              <button onClick={openCompose} disabled={!content.trim()}
                style={{ background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !content.trim() ? 0.5 : 1 }}>
                ✉ Add Note &amp; Send Email
              </button>
            )}
          </div>
        </div>

        {/* Notes list */}
        {loading ? (
          <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Loading…</p>
        ) : notes.length === 0 ? (
          <p style={{ color: "#484f58", fontSize: 13, fontStyle: "italic" }}>No text notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} style={{ borderLeft: "2px solid #C9A84C55", paddingLeft: 12 }}>
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                      style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "4px 8px", fontSize: 12 }} />
                    <textarea rows={3} value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #C9A84C66", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => saveEdit(note.id)}
                        style={{ background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditingId(null)}
                        style={{ background: "transparent", color: "#8b949e", border: "1px solid #30373f", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#C9A84C", fontSize: 11, fontWeight: 600 }}>{formatDate(note.noteDate)}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => startEdit(note)}
                          style={{ background: "transparent", border: "none", color: "#8b949e", fontSize: 11, cursor: "pointer", padding: "0 2px" }} title="Edit">✎</button>
                        <button onClick={() => deleteNote(note.id)}
                          style={{ background: "transparent", border: "none", color: "#484f58", fontSize: 13, cursor: "pointer", lineHeight: 1, padding: "0 2px" }} title="Delete">×</button>
                      </div>
                    </div>
                    <p style={{ color: "#e6edf3", fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{note.content}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>Send Note via Gmail</h2>
              <button onClick={() => setShowCompose(false)} style={{ color: "#8b949e", fontSize: 20 }}>×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>To</label>
                <input type="email" value={to} onChange={e => setTo(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>CC</label>
                  <input type="text" value={cc} onChange={e => setCc(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>BCC</label>
                  <input type="text" value={bcc} onChange={e => setBcc(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Message</label>
                <textarea rows={10} value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", resize: "vertical" }} />
              </div>
            </div>

            {sendResult && (
              <p className="text-sm font-medium" style={{ color: sendResult.ok ? "#22c55e" : "#ef4444" }}>{sendResult.msg}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={sendEmail} disabled={sending || !to}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: "#C9A84C", color: "#0d1117" }}>
                {sending ? "Sending…" : "Send Email"}
              </button>
              <button onClick={() => setShowCompose(false)}
                className="px-5 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: "#30373f", color: "#e6edf3" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
