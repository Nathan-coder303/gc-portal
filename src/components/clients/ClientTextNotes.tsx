"use client";

import { useState, useEffect, useCallback } from "react";

type TextNote = {
  id: string;
  content: string;
  noteDate: string;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ClientTextNotes({
  companyId,
  clientId,
}: {
  companyId: string;
  clientId: string;
}) {
  const [notes, setNotes] = useState<TextNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

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

  async function addNote() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, content: content.trim(), noteDate: new Date(noteDate).toISOString() }),
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

  async function deleteNote(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await fetch(`/api/${companyId}/notes?noteId=${noteId}`, { method: "DELETE" });
  }

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>Text Notes</h3>

      {/* Add note form */}
      <div className="mb-4">
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: "#484f58", fontSize: 10, fontWeight: 600, display: "block", marginBottom: 3 }}>DATE</label>
            <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)}
              style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "5px 8px", fontSize: 12, width: "100%", boxSizing: "border-box" }} />
          </div>
        </div>
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter note..."
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
          style={{ width: "100%", background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
        <button onClick={addNote} disabled={saving || !content.trim()}
          style={{ marginTop: 8, background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving || !content.trim() ? 0.5 : 1 }}>
          {saving ? "Saving…" : "Add Note"}
        </button>
      </div>

      {/* Notes list */}
      {loading ? (
        <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Loading…</p>
      ) : notes.length === 0 ? (
        <p style={{ color: "#484f58", fontSize: 13, fontStyle: "italic" }}>No text notes yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} style={{ borderLeft: "2px solid #C9A84C55", paddingLeft: 12, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#C9A84C", fontSize: 11, fontWeight: 600 }}>{formatDate(note.noteDate)}</span>
                <button onClick={() => deleteNote(note.id)}
                  style={{ background: "transparent", border: "none", color: "#484f58", fontSize: 13, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
                  title="Delete note">×</button>
              </div>
              <p style={{ color: "#e6edf3", fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
