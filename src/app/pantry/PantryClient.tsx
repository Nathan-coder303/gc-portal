"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Item = { id: string; text: string; done: boolean; createdAt: string };

// Minimal Web Speech API type surface (browsers differ; TS lib doesn't ship this)
type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SREvent = { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } };

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

export default function PantryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const recognitionRef = useRef<SR | null>(null);

  // Load
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pantry", { cache: "no-store" });
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Detect SpeechRecognition support
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  async function addFromText(text: string) {
    const t = text.trim();
    if (!t) return;
    try {
      const res = await fetch("/api/pantry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        const created: Item[] = await res.json();
        setItems(prev => [...created, ...prev]);
      }
    } catch { /* non-fatal */ }
  }

  function startListening() {
    if (listening) return;
    setErr(null); setInterim(""); setFinalText("");
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setErr("Speech recognition isn't supported in this browser. Try Safari on iPhone or Chrome on desktop."); return; }
    const rec: SR = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let localFinal = "";
    rec.onresult = (e: SREvent) => {
      let interimBuf = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) localFinal += r[0].transcript + " ";
        else interimBuf += r[0].transcript;
      }
      setFinalText(localFinal.trim());
      setInterim(interimBuf);
    };
    rec.onerror = (e) => {
      setErr(`Speech error: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const combined = (localFinal + " " + interim).trim();
      if (combined) addFromText(combined);
      setInterim(""); setFinalText("");
    };
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); }
    catch (e) { setErr(`Could not start mic: ${String(e)}`); }
  }

  function stopListening() {
    const rec = recognitionRef.current;
    if (rec) { try { rec.stop(); } catch { /* */ } }
  }

  async function toggleDone(id: string, done: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done } : i));
    await fetch(`/api/pantry/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
  }
  async function updateText(id: string, text: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, text } : i));
    await fetch(`/api/pantry/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }
  async function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/pantry/${id}`, { method: "DELETE" });
  }
  async function clearDone() {
    const doneIds = items.filter(i => i.done).map(i => i.id);
    if (doneIds.length === 0) return;
    if (!confirm(`Clear ${doneIds.length} bought item${doneIds.length === 1 ? "" : "s"}?`)) return;
    setItems(prev => prev.filter(i => !i.done));
    await Promise.all(doneIds.map(id => fetch(`/api/pantry/${id}`, { method: "DELETE" })));
  }

  const activeItems = items.filter(i => !i.done);
  const doneItems = items.filter(i => i.done);
  const liveTranscript = (finalText + " " + interim).trim();

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, padding: "20px 16px 120px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: GOLD, letterSpacing: -0.3 }}>🥑 Pantry</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
            Tap the mic and speak. Commas / "and" split into separate items.
          </p>
        </div>
        {doneItems.length > 0 && (
          <button onClick={clearDone}
            style={{ background: "#1e2736", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
            Clear bought ({doneItems.length})
          </button>
        )}
      </div>

      {/* Mic button + live text */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <button
          onClick={listening ? stopListening : startListening}
          disabled={supported === false}
          style={{
            width: 96, height: 96, borderRadius: "50%",
            background: listening ? "#ef4444" : GOLD,
            color: "#0d1117",
            border: "none",
            fontSize: 36,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: listening ? "0 0 0 8px rgba(239,68,68,0.25), 0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.4)",
            transition: "all .2s",
            opacity: supported === false ? 0.4 : 1,
          }}
          title={listening ? "Tap to stop" : "Tap to record"}
        >
          {listening ? "⏹" : "🎤"}
        </button>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: listening ? "#ef4444" : MUTED, fontWeight: listening ? 700 : 400 }}>
          {listening ? "LISTENING…" : "Tap the mic to speak"}
        </p>
        {liveTranscript && (
          <p style={{ margin: "10px auto 0", padding: "10px 14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 14, color: TEXT, textAlign: "left", maxWidth: 480 }}>
            {liveTranscript}
          </p>
        )}
        {err && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>{err}</p>}
        {supported === false && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: MUTED }}>
            Speech isn't supported here — use the text box below or open on Safari (iPhone) / Chrome (desktop).
          </p>
        )}
      </div>

      {/* Manual add */}
      <form
        onSubmit={e => { e.preventDefault(); addFromText(manual); setManual(""); }}
        style={{ display: "flex", gap: 8, marginBottom: 18 }}
      >
        <input
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="Or type: eggs, milk, bread…"
          style={{ flex: 1, padding: "10px 12px", background: CARD, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 12, fontSize: 14, outline: "none" }}
        />
        <button type="submit" disabled={!manual.trim()}
          style={{ padding: "10px 16px", background: GOLD, color: "#0d1117", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: manual.trim() ? 1 : 0.5 }}>
          Add
        </button>
      </form>

      {/* Active list */}
      {loading ? (
        <p style={{ textAlign: "center", color: MUTED, fontSize: 13, padding: "24px 0" }}>Loading…</p>
      ) : activeItems.length === 0 && doneItems.length === 0 ? (
        <p style={{ textAlign: "center", color: "#484f58", fontSize: 13, padding: "40px 12px" }}>
          Your list is empty. Tap the mic and say what you need.
        </p>
      ) : (
        <>
          {activeItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8, fontWeight: 700 }}>
                To buy ({activeItems.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {activeItems.map(it => (
                  <PantryRow key={it.id} item={it} onToggle={toggleDone} onEdit={updateText} onDelete={removeItem} />
                ))}
              </div>
            </div>
          )}

          {doneItems.length > 0 && (
            <div>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8, fontWeight: 700 }}>
                Bought ({doneItems.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {doneItems.map(it => (
                  <PantryRow key={it.id} item={it} onToggle={toggleDone} onEdit={updateText} onDelete={removeItem} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PantryRow({ item, onToggle, onEdit, onDelete }: {
  item: Item;
  onToggle: (id: string, done: boolean) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
      <button
        onClick={() => onToggle(item.id, !item.done)}
        aria-label={item.done ? "Mark not bought" : "Mark bought"}
        style={{
          width: 22, height: 22, borderRadius: 6,
          border: `2px solid ${item.done ? "#22c55e" : "#484f58"}`,
          background: item.done ? "#22c55e" : "transparent",
          color: "#0d1117", fontSize: 14, fontWeight: 900,
          cursor: "pointer", flexShrink: 0,
        }}
      >{item.done ? "✓" : ""}</button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { setEditing(false); if (draft.trim() && draft !== item.text) onEdit(item.id, draft); }}
          onKeyDown={e => {
            if (e.key === "Enter") { e.currentTarget.blur(); }
            else if (e.key === "Escape") { setDraft(item.text); setEditing(false); }
          }}
          style={{ flex: 1, padding: "4px 6px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, fontSize: 15, outline: "none" }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{
            flex: 1, fontSize: 15, cursor: "text",
            color: item.done ? MUTED : TEXT,
            textDecoration: item.done ? "line-through" : "none",
          }}
        >{item.text}</span>
      )}
      <button
        onClick={() => onDelete(item.id)}
        aria-label="Delete"
        style={{ background: "transparent", border: "none", color: "#f87171", fontSize: 18, cursor: "pointer", padding: "4px 8px", opacity: 0.7 }}
      >×</button>
    </div>
  );
}
