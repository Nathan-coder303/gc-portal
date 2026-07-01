"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Item = { id: string; text: string; qty: string | null; alwaysNeeded: boolean; done: boolean; createdAt: string };
type PendingRow = { text: string; qty: string; alwaysNeeded: boolean };

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

// ── Voice-to-rows parser ─────────────────────────────────────────────────────
// Splits an utterance like "buy tomatoes big carrots avocados" or
// "3 milk, two dozen eggs, bread I always need" into { text, qty, alwaysNeeded } rows.
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, a: 1, an: 1, half: 0.5,
};
const NUMBER_WORDS_SET = new Set(Object.keys(NUMBER_WORDS));
const ALWAYS_RE = /(always\s+need(?:ed)?|need(?:ed)?\s+always|at\s+all\s+times|keep\s+on\s+hand|staple)/i;

// Adjectives / modifiers that should be grouped with the following noun.
// Also includes noun-prefixes ("olive" oil, "almond" milk) that read like adjectives.
const ADJECTIVES = new Set([
  "big","small","large","little","mini","tiny","huge","giant","jumbo","baby","medium",
  "red","green","yellow","orange","purple","black","white","brown","pink","blue","golden",
  "organic","fresh","ripe","raw","whole","sliced","chopped","frozen","canned","dried","cooked","roasted","smoked","salted","unsalted",
  "italian","greek","spanish","mexican","japanese","chinese","french","thai","american",
  "extra","virgin","cold","warm","sweet","sour","spicy","hot","mild","dark","light",
  "olive","sunflower","canola","vegetable","coconut","peanut","sesame","avocado",
  "low","high","full","half","non","zero","free",
  "gluten","dairy","sugar","carb",
  "skim","almond","soy","oat","rice","cashew","hazelnut",
  "plain","strawberry","vanilla","chocolate","natural","greek",
  "basmati","jasmine","long","short","instant","brown","white",
  "cherry","grape","roma","beefsteak","heirloom",
  "boneless","skinless","ground","lean","fatty",
]);

// Units follow a qty ("two DOZEN eggs", "3 KG apples")
const UNIT_WORDS = new Set([
  "dozen","kg","kilo","kilos","kilogram","kilograms","g","gram","grams","lb","lbs","pound","pounds",
  "oz","ounce","ounces","pack","packs","box","boxes","can","cans","bottle","bottles","jar","jars",
  "bag","bags","loaf","loaves","liter","liters","litre","litres","l","ml","gallon","gallons","cup","cups",
  "piece","pieces","pcs","bunch","bunches","carton","cartons","head","heads","stick","sticks",
]);

// Common lead-in verbs to strip
const LEAD_IN_RE = /^\s*(please\s+)?(buy|get|grab|pick\s+up|need\s+to\s+(?:buy|get)|need|want|remember\s+to\s+(?:buy|get)|remind\s+me\s+to\s+(?:buy|get))\s+/i;

function isNumericToken(w: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(w) || NUMBER_WORDS_SET.has(w.toLowerCase());
}

// Walk a word list and produce { text, qty } groups. Adjectives glue to the next noun.
function splitWords(fragment: string): { text: string; qty: string }[] {
  const words = fragment.split(/\s+/).filter(Boolean);
  const groups: { text: string; qty: string }[] = [];
  let bufferAdj: string[] = [];
  let currentQty = "";

  function pushGroup(nounWords: string[]) {
    const text = [...bufferAdj, ...nounWords].join(" ").trim();
    if (text) groups.push({ text, qty: currentQty });
    bufferAdj = [];
    currentQty = "";
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lower = w.toLowerCase();

    if (isNumericToken(w)) {
      // A qty for the NEXT item — flush anything half-built with no qty
      if (bufferAdj.length > 0) pushGroup([]);
      currentQty = /^\d+(?:\.\d+)?$/.test(w) ? w : String(NUMBER_WORDS[lower] ?? 1);
      continue;
    }
    if (UNIT_WORDS.has(lower)) {
      // Append unit to the pending qty
      if (currentQty) currentQty += " " + w;
      // If no qty, treat unit as a noun (rare — e.g. someone literally says "cup")
      else bufferAdj.push(w);
      continue;
    }
    if (ADJECTIVES.has(lower)) {
      bufferAdj.push(w);
      continue;
    }
    // Noun → complete the group (adj buffer + this word)
    pushGroup([w]);
  }
  // Trailing adjective(s) with no noun — treat them as their own item so we don't lose them
  if (bufferAdj.length > 0) pushGroup([]);
  return groups;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseUtterance(raw: string): PendingRow[] {
  if (!raw) return [];
  const stripped = raw.replace(LEAD_IN_RE, "").trim();

  const chunks = stripped
    .split(/\n+|,|;| and | & | plus | y | et /gi)
    .map(s => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  const rows: PendingRow[] = [];
  for (const c of chunks) {
    const always = ALWAYS_RE.test(c);
    // Strip the "always/at all times" phrase from the item text
    const cleaned = c.replace(ALWAYS_RE, "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    const groups = splitWords(cleaned);
    if (groups.length === 0) {
      rows.push({ text: titleCase(cleaned), qty: "", alwaysNeeded: always });
      continue;
    }
    for (const g of groups) {
      rows.push({ text: titleCase(g.text), qty: g.qty, alwaysNeeded: always });
    }
  }
  return rows;
}

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

  // Review table (after recording ends, before committing to the DB)
  const [pending, setPending] = useState<PendingRow[] | null>(null);
  const [rawTranscript, setRawTranscript] = useState("");
  const [saving, setSaving] = useState(false);

  // Send modal state
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pantry", { cache: "no-store" });
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function startListening() {
    if (listening) return;
    setErr(null); setInterim(""); setFinalText(""); setPending(null);
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setErr("Speech recognition isn&rsquo;t supported in this browser."); return; }
    const rec: SR = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let localFinal = "";
    let localInterim = "";
    rec.onresult = (e: SREvent) => {
      let interimBuf = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) localFinal += r[0].transcript + " ";
        else interimBuf += r[0].transcript;
      }
      localInterim = interimBuf;
      setFinalText(localFinal.trim());
      setInterim(interimBuf);
    };
    rec.onerror = (e) => { setErr(`Speech error: ${e.error}`); setListening(false); };
    rec.onend = () => {
      setListening(false);
      const combined = (localFinal + " " + localInterim).trim();
      setInterim(""); setFinalText("");
      if (combined) {
        setRawTranscript(combined);
        const parsed = parseUtterance(combined);
        setPending(parsed.length ? parsed : [{ text: combined, qty: "", alwaysNeeded: false }]);
      }
    };
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); } catch (e) { setErr(`Could not start mic: ${String(e)}`); }
  }
  function stopListening() {
    const rec = recognitionRef.current;
    if (rec) { try { rec.stop(); } catch { /* */ } }
  }

  // ── Review table actions ────────────────────────────────────────────────
  function updatePendingRow(idx: number, patch: Partial<PendingRow>) {
    setPending(prev => prev ? prev.map((r, i) => i === idx ? { ...r, ...patch } : r) : prev);
  }
  function removePendingRow(idx: number) {
    setPending(prev => prev ? prev.filter((_, i) => i !== idx) : prev);
  }
  function addPendingRow() {
    setPending(prev => prev ? [...prev, { text: "", qty: "", alwaysNeeded: false }] : [{ text: "", qty: "", alwaysNeeded: false }]);
  }
  function cancelPending() { setPending(null); setRawTranscript(""); }
  async function commitPending() {
    if (!pending) return;
    const rows = pending.filter(r => r.text.trim());
    if (rows.length === 0) { setPending(null); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/pantry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows.map(r => ({ text: r.text, qty: r.qty || null, alwaysNeeded: r.alwaysNeeded })) }),
      });
      if (res.ok) {
        const created: Item[] = await res.json();
        setItems(prev => [...created, ...prev]);
        setPending(null); setRawTranscript("");
      }
    } finally { setSaving(false); }
  }

  // ── Existing list actions ───────────────────────────────────────────────
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
    } catch { /* */ }
  }
  async function toggleDone(id: string, done: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done } : i));
    await fetch(`/api/pantry/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done }) });
  }
  async function patchItem(id: string, patch: { text?: string; qty?: string | null; alwaysNeeded?: boolean }) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    await fetch(`/api/pantry/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
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
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, padding: "20px 16px 120px", maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: GOLD, letterSpacing: -0.3 }}>🥑 Pantry</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
            Tap the mic and speak. When you stop, review the table before adding.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {activeItems.length > 0 && (
            <button onClick={() => setSendOpen(true)}
              style={{ background: GOLD, border: `1px solid ${GOLD}`, color: "#0d1117", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              📧 Send
            </button>
          )}
          {doneItems.length > 0 && (
            <button onClick={clearDone}
              style={{ background: "#1e2736", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
              Clear bought ({doneItems.length})
            </button>
          )}
        </div>
      </div>

      {/* Mic button + live text */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <button
          onClick={listening ? stopListening : startListening}
          disabled={supported === false || !!pending}
          style={{
            width: 96, height: 96, borderRadius: "50%",
            background: listening ? "#ef4444" : GOLD,
            color: "#0d1117", border: "none",
            fontSize: 36, fontWeight: 700, cursor: "pointer",
            boxShadow: listening ? "0 0 0 8px rgba(239,68,68,0.25), 0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.4)",
            transition: "all .2s",
            opacity: supported === false || !!pending ? 0.4 : 1,
          }}
          title={listening ? "Tap to stop" : "Tap to record"}
        >
          {listening ? "⏹" : "🎤"}
        </button>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: listening ? "#ef4444" : MUTED, fontWeight: listening ? 700 : 400 }}>
          {listening ? "LISTENING…" : pending ? "Review the table below" : "Tap the mic to speak"}
        </p>
        {liveTranscript && listening && (
          <p style={{ margin: "10px auto 0", padding: "10px 14px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 14, color: TEXT, textAlign: "left", maxWidth: 480 }}>
            {liveTranscript}
          </p>
        )}
        {err && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>{err}</p>}
        {supported === false && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: MUTED }}>
            Speech isn&rsquo;t supported here &mdash; use the text box below or open on Safari (iPhone) / Chrome (desktop).
          </p>
        )}
      </div>

      {/* ── Review table (post-recording, pre-commit) ────────────────────── */}
      {pending && (
        <div style={{ marginBottom: 24, padding: 12, background: CARD, border: `2px solid ${GOLD}55`, borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: GOLD, fontWeight: 700 }}>
                📝 Review before adding
              </p>
              {rawTranscript && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED, fontStyle: "italic" }}>
                  Heard: &ldquo;{rawTranscript}&rdquo;
                </p>
              )}
            </div>
            <button onClick={cancelPending} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", fontSize: 20, padding: "0 4px" }}>×</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Item</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, width: 90 }}>Qty</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, width: 70 }}>Always</th>
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {pending.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: "4px 2px" }}>
                      <input
                        value={r.text}
                        onChange={e => updatePendingRow(i, { text: e.target.value })}
                        placeholder="Item"
                        style={{ width: "100%", padding: "8px 10px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none" }}
                      />
                    </td>
                    <td style={{ padding: "4px 2px" }}>
                      <input
                        value={r.qty}
                        onChange={e => updatePendingRow(i, { qty: e.target.value })}
                        placeholder="—"
                        style={{ width: "100%", padding: "8px 10px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none" }}
                      />
                    </td>
                    <td style={{ padding: "4px 2px", textAlign: "center" }}>
                      <button
                        onClick={() => updatePendingRow(i, { alwaysNeeded: !r.alwaysNeeded })}
                        style={{
                          width: 44, height: 32, borderRadius: 8,
                          background: r.alwaysNeeded ? `${GOLD}22` : BG,
                          border: `1px solid ${r.alwaysNeeded ? GOLD : BORDER}`,
                          color: r.alwaysNeeded ? GOLD : MUTED,
                          fontSize: 16, fontWeight: 700, cursor: "pointer",
                        }}
                        title={r.alwaysNeeded ? "Always needed" : "One-off"}
                      >
                        {r.alwaysNeeded ? "★" : "☆"}
                      </button>
                    </td>
                    <td style={{ padding: "4px 2px", textAlign: "center" }}>
                      <button onClick={() => removePendingRow(i)}
                        style={{ background: "transparent", border: "none", color: "#f87171", fontSize: 18, cursor: "pointer", padding: "4px" }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addPendingRow}
            style={{ marginTop: 8, width: "100%", padding: "10px", background: "transparent", border: `1px dashed ${BORDER}`, borderRadius: 10, color: MUTED, cursor: "pointer", fontSize: 12 }}>
            + Add row
          </button>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={commitPending} disabled={saving || pending.every(r => !r.text.trim())}
              style={{ flex: 1, padding: "12px", background: GOLD, color: "#0d1117", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Adding…" : `Add ${pending.filter(r => r.text.trim()).length} item${pending.filter(r => r.text.trim()).length === 1 ? "" : "s"}`}
            </button>
            <button onClick={cancelPending} disabled={saving}
              style={{ padding: "12px 18px", background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manual add (single row) */}
      {!pending && (
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
      )}

      {/* Active + done lists */}
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
                  <PantryRow key={it.id} item={it} onToggle={toggleDone} onPatch={patchItem} onDelete={removeItem} />
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
                  <PantryRow key={it.id} item={it} onToggle={toggleDone} onPatch={patchItem} onDelete={removeItem} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sendOpen && <SendModal items={activeItems} onClose={() => setSendOpen(false)} />}
    </div>
  );
}

// ── Build the statement-style HTML for both the on-screen preview
//    and the actual email body. Kept identical so what you see is what you send.
function buildPantryHtml(items: Item[], dateStr: string, note: string): string {
  const staples = items.filter(i => i.alwaysNeeded);
  const others = items.filter(i => !i.alwaysNeeded);

  const rowHtml = (i: Item) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:15px;">
        ${i.alwaysNeeded ? '<span style="display:inline-block;width:16px;color:#C9A84C;font-weight:700;">★</span>' : '<span style="display:inline-block;width:16px;"></span>'}
        ${escapeHtml(i.text)}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:18px;font-weight:800;color:#C9A84C;font-family:'SF Mono',Menlo,monospace;">
        ${i.qty ? escapeHtml(i.qty) : '<span style="color:#cbd5e1;font-size:14px;font-weight:400;">—</span>'}
      </td>
    </tr>`;

  const section = (title: string, list: Item[]) => list.length === 0 ? "" : `
    <tr>
      <td colspan="2" style="padding:14px 16px 8px;background:#f8fafc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">
        ${title} <span style="color:#94a3b8;font-weight:500;">(${list.length})</span>
      </td>
    </tr>
    ${list.map(rowHtml).join("")}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Pantry list</title></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
    <div style="padding:22px 24px 18px;border-bottom:1px solid #e2e8f0;background:linear-gradient(180deg,#fdfbf3 0%,#ffffff 100%);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#C9A84C;font-weight:700;">Pantry</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:2px;letter-spacing:-0.3px;">Shopping List</div>
        </div>
        <div style="text-align:right;font-size:12px;color:#64748b;">
          ${escapeHtml(dateStr)}<br/>
          <span style="font-weight:700;color:#0f172a;">${items.length} item${items.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
    ${note.trim() ? `<div style="padding:14px 24px;background:#fefce8;border-bottom:1px solid #fde68a;font-size:13px;color:#78350f;">${escapeHtml(note).replace(/\n/g, "<br/>")}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px 16px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #e2e8f0;">Item</th>
          <th style="text-align:right;padding:10px 16px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:110px;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${section("Always needed", staples)}
        ${section("This trip", others)}
      </tbody>
    </table>
    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;letter-spacing:0.3px;">
      ★ = keep on hand at all times
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[ch]);
}

function SendModal({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(`Pantry list — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const html = buildPantryHtml(items, today, note);

  async function send() {
    if (!to.trim()) { setError("Enter a recipient email."); return; }
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/pantry/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject, html }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Send failed (${res.status})`);
      } else {
        setSent(true);
        setTimeout(onClose, 1200);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, maxWidth: 620, width: "100%", padding: 18 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>📧 Send pantry list</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", padding: "0 4px" }}>×</button>
        </div>

        <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>To</label>
        <input
          type="email"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="someone@example.com"
          style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Subject</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Note (optional)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Anything you want them to know…"
          style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
        />

        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, margin: "0 0 6px" }}>Preview</p>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#f1f5f9", maxHeight: 400, overflowY: "auto" }}>
          <iframe
            title="preview"
            srcDoc={html}
            style={{ width: "100%", height: 400, border: "none", display: "block", background: "#f1f5f9" }}
          />
        </div>

        {error && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f87171" }}>{error}</p>}
        {sent && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#22c55e", fontWeight: 700 }}>✓ Sent!</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={send}
            disabled={sending || sent || !to.trim() || items.length === 0}
            style={{ flex: 1, padding: "12px", background: GOLD, color: "#0d1117", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: sending || sent || !to.trim() ? 0.5 : 1 }}
          >
            {sending ? "Sending…" : sent ? "Sent" : `Send to ${to.trim() || "…"}`}
          </button>
          <button
            onClick={onClose}
            disabled={sending}
            style={{ padding: "12px 18px", background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PantryRow({ item, onToggle, onPatch, onDelete }: {
  item: Item;
  onToggle: (id: string, done: boolean) => void;
  onPatch: (id: string, patch: { text?: string; qty?: string | null; alwaysNeeded?: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(item.text);
  const [draftQty, setDraftQty] = useState(item.qty ?? "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: CARD, border: `1px solid ${item.alwaysNeeded ? `${GOLD}55` : BORDER}`, borderRadius: 12 }}>
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
        <>
          <input
            autoFocus
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { setDraftText(item.text); setEditing(false); } }}
            onBlur={() => { setEditing(false); if (draftText.trim() && (draftText !== item.text || draftQty !== (item.qty ?? ""))) onPatch(item.id, { text: draftText, qty: draftQty || null }); }}
            style={{ flex: 1, padding: "4px 6px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, fontSize: 15, outline: "none" }}
          />
          <input
            value={draftQty}
            onChange={e => setDraftQty(e.target.value)}
            placeholder="qty"
            style={{ width: 70, padding: "4px 6px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, fontSize: 13, outline: "none", textAlign: "center" }}
          />
        </>
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{
            flex: 1, fontSize: 15, cursor: "text",
            color: item.done ? MUTED : TEXT,
            textDecoration: item.done ? "line-through" : "none",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span>{item.text}</span>
          {item.qty && (
            <span style={{ fontSize: 16, padding: "3px 12px", background: "#1e2736", borderRadius: 14, color: GOLD, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.2 }}>
              {item.qty}
            </span>
          )}
        </span>
      )}

      <button
        onClick={() => onPatch(item.id, { alwaysNeeded: !item.alwaysNeeded })}
        aria-label={item.alwaysNeeded ? "Remove always-needed" : "Mark always needed"}
        style={{ background: "transparent", border: "none", color: item.alwaysNeeded ? GOLD : "#484f58", fontSize: 16, cursor: "pointer", padding: "4px" }}
        title={item.alwaysNeeded ? "Always needed" : "Mark as always needed"}
      >{item.alwaysNeeded ? "★" : "☆"}</button>

      <button
        onClick={() => onDelete(item.id)}
        aria-label="Delete"
        style={{ background: "transparent", border: "none", color: "#f87171", fontSize: 18, cursor: "pointer", padding: "4px 6px", opacity: 0.7 }}
      >×</button>
    </div>
  );
}
