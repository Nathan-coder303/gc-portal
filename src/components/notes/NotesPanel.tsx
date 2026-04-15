"use client";

import { useState, useEffect, useCallback } from "react";

type Note = {
  id: string;
  content: string;
  noteDate: string;
  createdAt: string;
};

type Props = {
  companyId: string;
  leadId?: string | null;
  clientId?: string | null;
  title: string;
  onClose: () => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
}

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD in ET
}

export default function NotesPanel({ companyId, leadId, clientId, title, onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  // Task state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [taskDate, setTaskDate] = useState(todayISO());
  const [savingTask, setSavingTask] = useState(false);
  const [taskSaved, setTaskSaved] = useState(false);

  const queryParam = leadId ? `leadId=${leadId}` : `clientId=${clientId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${companyId}/notes?${queryParam}`);
      if (res.ok) setNotes(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId, queryParam]);

  useEffect(() => { load(); }, [load]);

  async function addNote() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadId || null,
          clientId: clientId || null,
          content: content.trim(),
          noteDate: new Date(noteDate + "T12:00:00Z").toISOString(),
        }),
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

  async function addTask() {
    if (!taskText.trim()) return;
    setSavingTask(true);
    try {
      const fd = new FormData();
      fd.append("category", "TASK");
      fd.append("text", `📌 ${title}: ${taskText.trim()}`);
      fd.append("dueDate", taskDate);
      const res = await fetch(`/api/${companyId}/follow-ups`, { method: "POST", body: fd });
      if (res.ok) {
        setTaskText("");
        setTaskDate(todayISO());
        setShowTaskForm(false);
        setTaskSaved(true);
        setTimeout(() => setTaskSaved(false), 3000);
      }
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid #21262d" }}>
          <div>
            <h2 style={{ color: "#e6edf3", fontSize: 15, fontWeight: 700, margin: 0 }}>Notes</h2>
            <p style={{ color: "#484f58", fontSize: 11, margin: "2px 0 0" }}>{title}</p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#8b949e", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Add task section */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #21262d" }}>
          {!showTaskForm ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setShowTaskForm(true)}
                style={{ background: "#C9A84C22", border: "1px solid #C9A84C66", color: "#C9A84C", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                ✅ Add task
              </button>
              {taskSaved && (
                <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>Task added to Today&apos;s Tasks ✓</span>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="Task description…"
                  autoFocus
                  style={{ flex: 1, background: "#0d1117", color: "#e6edf3", border: "1px solid #C9A84C66", borderRadius: 6, padding: "6px 10px", fontSize: 13, outline: "none" }}
                />
                <input
                  type="date"
                  value={taskDate}
                  onChange={e => setTaskDate(e.target.value)}
                  style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30373f", borderRadius: 6, padding: "6px 8px", fontSize: 12, outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={addTask}
                  disabled={savingTask || !taskText.trim()}
                  style={{ background: "#C9A84C", color: "#0d1117", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: savingTask || !taskText.trim() ? 0.5 : 1 }}
                >
                  {savingTask ? "Saving…" : "Save task"}
                </button>
                <button
                  onClick={() => { setShowTaskForm(false); setTaskText(""); }}
                  style={{ background: "transparent", border: "1px solid #30373f", color: "#8b949e", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add note form */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #21262d" }}>
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
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {loading ? (
            <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Loading…</p>
          ) : notes.length === 0 ? (
            <p style={{ color: "#484f58", fontSize: 13, textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} style={{ borderLeft: `2px solid #C9A84C55`, paddingLeft: 12, marginBottom: 16, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#C9A84C", fontSize: 11, fontWeight: 600 }}>{formatDate(note.noteDate)}</span>
                  <button onClick={() => deleteNote(note.id)}
                    style={{ background: "transparent", border: "none", color: "#484f58", fontSize: 13, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
                    title="Delete note">×</button>
                </div>
                <p style={{ color: "#e6edf3", fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
