"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as htmlToImage from "html-to-image";

type Item = {
  id: string;
  text: string;
  qty: string | null;
  alwaysNeeded: boolean;
  store: string | null;
  onHand: number;
  minAtHome: number;
  done: boolean;
  createdAt: string;
};
type PendingRow = { text: string; qty: string; alwaysNeeded: boolean; store: string; onHand: number; minAtHome: number };

// Common qty presets — offered as a native <datalist> so users get a
// dropdown but can still type anything.
const QTY_PRESETS = [
  "1", "2", "3", "4", "5", "6", "8", "10", "12", "24",
  "1 dozen", "2 dozen",
  "1 lb", "2 lb", "5 lb",
  "1 kg", "2 kg",
  "1 pack", "2 packs", "3 packs",
  "1 bottle", "2 bottles",
  "1 gallon", "2 gallons",
  "1 bag", "2 bags",
  "1 jar", "2 jars",
];
const LOW_STOCK_THRESHOLD = 2;

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
const WA_GREEN = "#25D366";

// Known stores (used for voice detection + quick-pick chips)
const STORES = ["Publix", "Costco", "Kosher", "Aldi"];
const STORE_COLORS: Record<string, string> = {
  Publix: "#009639",   // Publix green
  Costco: "#E32227",   // Costco red
  Kosher: "#3366CC",   // blue
  Aldi: "#F47C20",     // Aldi orange
};

// ── Custom stores (user-added, persisted in localStorage) ────────────────────
const CUSTOM_STORES_KEY = "pantry_custom_stores";
const STORES_CHANGED_EVENT = "pantry-stores-changed";
// Deterministic color for a custom store name so chips/badges stay consistent.
const CUSTOM_STORE_PALETTE = ["#8B5CF6", "#0EA5E9", "#EC4899", "#14B8A6", "#F59E0B", "#84CC16", "#EF4444", "#6366F1"];
function colorForStore(name: string): string {
  if (STORE_COLORS[name]) return STORE_COLORS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CUSTOM_STORE_PALETTE[h % CUSTOM_STORE_PALETTE.length];
}
function loadCustomStores(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
  } catch { return []; }
}
// React hook: merged store list ([built-in, ...custom]) + an addStore() that persists and broadcasts.
function useStores(): { stores: string[]; addStore: (name: string) => string | null } {
  const [custom, setCustom] = useState<string[]>([]);
  useEffect(() => {
    setCustom(loadCustomStores());
    const sync = () => setCustom(loadCustomStores());
    window.addEventListener(STORES_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(STORES_CHANGED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const addStore = useCallback((raw: string): string | null => {
    const name = raw.trim();
    if (!name) return null;
    const known = new Set([...STORES, ...loadCustomStores()].map(s => s.toLowerCase()));
    if (!known.has(name.toLowerCase())) {
      const next = [...loadCustomStores(), name];
      try { window.localStorage.setItem(CUSTOM_STORES_KEY, JSON.stringify(next)); } catch {}
      window.dispatchEvent(new Event(STORES_CHANGED_EVENT));
    }
    return name;
  }, []);
  return { stores: [...STORES, ...custom], addStore };
}
// Sentinel value used by the "add a new store" <option>.
const ADD_STORE_OPTION = "__add_store__";
function promptAddStore(addStore: (name: string) => string | null): string | null {
  const name = window.prompt("New store name:");
  return name ? addStore(name) : null;
}

// Wife's WhatsApp (US +1)
const DEFAULT_WA_NUMBER = "13058778256";

// ── Voice-to-rows parser ─────────────────────────────────────────────────────
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, a: 1, an: 1, half: 0.5,
};
const NUMBER_WORDS_SET = new Set(Object.keys(NUMBER_WORDS));
const ALWAYS_RE = /(always\s+need(?:ed)?|need(?:ed)?\s+always|at\s+all\s+times|keep\s+on\s+hand|staple)/i;

// "at Publix", "from Costco", "kosher store", "at the kosher place"
const STORE_RE = /\b(?:at|from|@|in)\s+(?:the\s+)?(publix|costco|kosher(?:\s+choices?|\s+store|\s+market|\s+place)?)\b/i;

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

const UNIT_WORDS = new Set([
  "dozen","kg","kilo","kilos","kilogram","kilograms","g","gram","grams","lb","lbs","pound","pounds",
  "oz","ounce","ounces","pack","packs","box","boxes","can","cans","bottle","bottles","jar","jars",
  "bag","bags","loaf","loaves","liter","liters","litre","litres","l","ml","gallon","gallons","cup","cups",
  "piece","pieces","pcs","bunch","bunches","carton","cartons","head","heads","stick","sticks",
]);

const LEAD_IN_RE = /^\s*(please\s+)?(buy|get|grab|pick\s+up|need\s+to\s+(?:buy|get)|need|want|remember\s+to\s+(?:buy|get)|remind\s+me\s+to\s+(?:buy|get))\s+/i;

function isNumericToken(w: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(w) || NUMBER_WORDS_SET.has(w.toLowerCase());
}

function normalizeStore(raw: string): string {
  const s = raw.toLowerCase();
  if (s.startsWith("publix")) return "Publix";
  if (s.startsWith("costco")) return "Costco";
  if (s.startsWith("kosher")) return "Kosher";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

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
      if (bufferAdj.length > 0) pushGroup([]);
      currentQty = /^\d+(?:\.\d+)?$/.test(w) ? w : String(NUMBER_WORDS[lower] ?? 1);
      continue;
    }
    if (UNIT_WORDS.has(lower)) {
      if (currentQty) currentQty += " " + w;
      else bufferAdj.push(w);
      continue;
    }
    if (ADJECTIVES.has(lower)) {
      bufferAdj.push(w);
      continue;
    }
    pushGroup([w]);
  }
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
    // Detect + strip the "at STORE" phrase
    let store = "";
    const storeMatch = c.match(STORE_RE);
    if (storeMatch) store = normalizeStore(storeMatch[1].split(/\s+/)[0]);

    const cleaned = c
      .replace(STORE_RE, "")
      .replace(ALWAYS_RE, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;

    const groups = splitWords(cleaned);
    if (groups.length === 0) {
      rows.push({ text: titleCase(cleaned), qty: "", alwaysNeeded: always, store, onHand: 0, minAtHome: 2 });
      continue;
    }
    for (const g of groups) {
      rows.push({ text: titleCase(g.text), qty: g.qty, alwaysNeeded: always, store, onHand: 0, minAtHome: 2 });
    }
  }
  return rows;
}

export default function PantryClient() {
  const { stores, addStore } = useStores();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const recognitionRef = useRef<SR | null>(null);

  const [pending, setPending] = useState<PendingRow[] | null>(null);
  const [rawTranscript, setRawTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
        setPending(parsed.length ? parsed : [{ text: combined, qty: "", alwaysNeeded: false, store: "", onHand: 0, minAtHome: 2 }]);
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
    setPending(prev => prev ? [...prev, { text: "", qty: "", alwaysNeeded: false, store: "", onHand: 0, minAtHome: 2 }] : [{ text: "", qty: "", alwaysNeeded: false, store: "", onHand: 0, minAtHome: 2 }]);
  }
  function setStoreForAll(store: string) {
    setPending(prev => prev ? prev.map(r => ({ ...r, store })) : prev);
  }
  function cancelPending() { setPending(null); setRawTranscript(""); }
  async function commitPending() {
    if (!pending) return;
    const rows = pending.filter(r => r.text.trim());
    if (rows.length === 0) { setPending(null); return; }
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch("/api/pantry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows.map(r => ({ text: r.text, qty: r.qty || null, alwaysNeeded: r.alwaysNeeded, store: r.store || null, onHand: r.onHand, minAtHome: r.minAtHome })) }),
      });
      if (res.ok) {
        const created: Item[] = await res.json();
        setItems(prev => [...created, ...prev]);
        setPending(null); setRawTranscript("");
      } else {
        const detail = await res.text().catch(() => "");
        setSaveError(`Save failed (${res.status}). ${detail.slice(0, 200)}`);
      }
    } catch (e) {
      setSaveError(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  }

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
  async function patchItem(id: string, patch: { text?: string; qty?: string | null; alwaysNeeded?: boolean; store?: string | null; onHand?: number; minAtHome?: number }) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    await fetch(`/api/pantry/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }
  async function adjustOnHand(id: string, delta: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, onHand: Math.max(0, i.onHand + delta) } : i));
    const item = items.find(i => i.id === id);
    if (item) {
      const next = Math.max(0, item.onHand + delta);
      await fetch(`/api/pantry/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ onHand: next }) });
    }
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
  // Shopping list = anything under its own per-item minimum threshold.
  // This is what gets sent to the wife via WhatsApp.
  const shoppingList = activeItems.filter(i => i.onHand < i.minAtHome);
  const wellStocked = activeItems.filter(i => i.onHand >= i.minAtHome);
  const liveTranscript = (finalText + " " + interim).trim();

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, padding: "20px 16px 120px", maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: GOLD, letterSpacing: -0.3 }}>🥑 Pantry</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
            Tap the mic and speak. Review, then send to WhatsApp.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {shoppingList.length > 0 && (
            <>
              <button onClick={() => setPreviewOpen(true)}
                style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                👁 Preview list
              </button>
              <button onClick={() => setSendOpen(true)}
                style={{ background: WA_GREEN, border: `1px solid ${WA_GREEN}`, color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                💬 Send {shoppingList.length}
              </button>
            </>
          )}
          {doneItems.length > 0 && (
            <button onClick={clearDone}
              style={{ background: "#1e2736", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
              Clear bought ({doneItems.length})
            </button>
          )}
        </div>
      </div>

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

      {/* Review table */}
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

          {/* Batch store selector */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, fontWeight: 700 }}>Set all →</span>
            {stores.map(s => (
              <button key={s} onClick={() => setStoreForAll(s)}
                style={{ padding: "4px 10px", background: `${colorForStore(s)}22`, border: `1px solid ${colorForStore(s)}55`, color: colorForStore(s), borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {s}
              </button>
            ))}
            <button onClick={() => { const name = promptAddStore(addStore); if (name) setStoreForAll(name); }}
              style={{ padding: "4px 10px", background: "transparent", border: `1px dashed ${BORDER}`, color: MUTED, borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              + Add store
            </button>
            <button onClick={() => setStoreForAll("")}
              style={{ padding: "4px 10px", background: "transparent", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 12, fontSize: 11, cursor: "pointer" }}>
              Clear
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Item</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, width: 80 }}>Qty</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, width: 90 }}>Store</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, width: 52 }} title="How many at home right now">🏠</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, width: 52 }} title="Alert threshold: when at-home drops below this, item goes on the shopping list">⚠ Min</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, width: 40 }}>★</th>
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
                        style={{ width: "100%", padding: "8px 10px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                    </td>
                    <td style={{ padding: "4px 2px" }}>
                      <input
                        value={r.qty}
                        onChange={e => updatePendingRow(i, { qty: e.target.value })}
                        list="review-qty-presets"
                        placeholder="—"
                        style={{ width: "100%", padding: "8px 10px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                    </td>
                    <td style={{ padding: "4px 2px" }}>
                      <select
                        value={r.store}
                        onChange={e => {
                          if (e.target.value === ADD_STORE_OPTION) { const name = promptAddStore(addStore); if (name) updatePendingRow(i, { store: name }); return; }
                          updatePendingRow(i, { store: e.target.value });
                        }}
                        style={{ width: "100%", padding: "8px 6px", background: BG, border: `1px solid ${r.store ? colorForStore(r.store) : BORDER}`, color: r.store ? colorForStore(r.store) : MUTED, borderRadius: 8, fontSize: 13, fontWeight: r.store ? 700 : 400, outline: "none", boxSizing: "border-box" }}
                      >
                        <option value="">—</option>
                        {stores.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value={ADD_STORE_OPTION}>+ Add store…</option>
                      </select>
                    </td>
                    <td style={{ padding: "4px 2px" }}>
                      <input
                        type="number"
                        min={0}
                        value={r.onHand}
                        onChange={e => updatePendingRow(i, { onHand: Math.max(0, parseInt(e.target.value) || 0) })}
                        style={{ width: "100%", padding: "8px 6px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", textAlign: "center", fontWeight: 700 }}
                      />
                    </td>
                    <td style={{ padding: "4px 2px" }}>
                      <input
                        type="number"
                        min={0}
                        value={r.minAtHome}
                        onChange={e => updatePendingRow(i, { minAtHome: Math.max(0, parseInt(e.target.value) || 0) })}
                        style={{ width: "100%", padding: "8px 6px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", textAlign: "center", fontWeight: 700 }}
                      />
                    </td>
                    <td style={{ padding: "4px 2px", textAlign: "center" }}>
                      <button
                        onClick={() => updatePendingRow(i, { alwaysNeeded: !r.alwaysNeeded })}
                        style={{
                          width: 36, height: 32, borderRadius: 8,
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

          <datalist id="review-qty-presets">
            {QTY_PRESETS.map(q => <option key={q} value={q} />)}
          </datalist>

          <button onClick={addPendingRow}
            style={{ marginTop: 8, width: "100%", padding: "10px", background: "transparent", border: `1px dashed ${BORDER}`, borderRadius: 10, color: MUTED, cursor: "pointer", fontSize: 12 }}>
            + Add row
          </button>

          {saveError && (
            <p style={{ margin: "10px 0 0", padding: "8px 10px", background: "#3b1010", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 12, color: "#fecaca" }}>
              {saveError}
            </p>
          )}

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

      {/* Manual add */}
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
          {shoppingList.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8, fontWeight: 700 }}>
                🛒 Need to buy ({shoppingList.length})
                <span style={{ marginLeft: 8, color: "#f87171", textTransform: "none", fontSize: 10, letterSpacing: 0 }}>
                  low stock (&lt; {LOW_STOCK_THRESHOLD})
                </span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {shoppingList.map(it => (
                  <PantryRow key={it.id} item={it} onToggle={toggleDone} onPatch={patchItem} onDelete={removeItem} onAdjustOnHand={adjustOnHand} />
                ))}
              </div>
            </div>
          )}

          {wellStocked.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, marginBottom: 8, fontWeight: 700 }}>
                ✓ Well stocked ({wellStocked.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {wellStocked.map(it => (
                  <PantryRow key={it.id} item={it} onToggle={toggleDone} onPatch={patchItem} onDelete={removeItem} onAdjustOnHand={adjustOnHand} />
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
                  <PantryRow key={it.id} item={it} onToggle={toggleDone} onPatch={patchItem} onDelete={removeItem} onAdjustOnHand={adjustOnHand} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sendOpen && <SendModal items={shoppingList} onClose={() => setSendOpen(false)} />}
      {previewOpen && <PreviewModal items={shoppingList} onClose={() => setPreviewOpen(false)} onSend={() => { setPreviewOpen(false); setSendOpen(true); }} />}
    </div>
  );
}

// Compact labeled stepper (− [value] +) used for on-hand / min-threshold.
// Fixed content widths so it never gets squeezed weird by flex siblings.
function StepperField({ label, value, onChange, warn }: { label: string; value: number; onChange: (n: number) => void; warn?: boolean }) {
  return (
    <div style={{ flex: "1 1 160px", minWidth: 160 }}>
      <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          style={{ width: 40, height: 44, borderRadius: 8, background: BG, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 20, fontWeight: 700, cursor: "pointer", flexShrink: 0, boxSizing: "border-box", padding: 0 }}
        >−</button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          style={{
            flex: 1, minWidth: 0, height: 44, padding: "0 8px",
            background: BG,
            border: `1px solid ${warn ? "#f87171" : BORDER}`,
            color: TEXT, borderRadius: 8, fontSize: 20, fontWeight: 800,
            textAlign: "center", outline: "none", boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          style={{ width: 40, height: 44, borderRadius: 8, background: BG, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 20, fontWeight: 700, cursor: "pointer", flexShrink: 0, boxSizing: "border-box", padding: 0 }}
        >+</button>
      </div>
    </div>
  );
}

function PantryRow({ item, onToggle, onPatch, onDelete, onAdjustOnHand }: {
  item: Item;
  onToggle: (id: string, done: boolean) => void;
  onPatch: (id: string, patch: { text?: string; qty?: string | null; alwaysNeeded?: boolean; store?: string | null; onHand?: number; minAtHome?: number }) => void;
  onDelete: (id: string) => void;
  onAdjustOnHand: (id: string, delta: number) => void;
}) {
  const { stores, addStore } = useStores();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(item.text);
  const [draftQty, setDraftQty] = useState(item.qty ?? "");
  const [draftStore, setDraftStore] = useState(item.store ?? "");
  const [draftAlways, setDraftAlways] = useState(item.alwaysNeeded);
  const [draftOnHand, setDraftOnHand] = useState(item.onHand);
  const [draftMin, setDraftMin] = useState(item.minAtHome);
  const storeColor = item.store ? colorForStore(item.store) : null;
  const isLow = item.onHand < item.minAtHome;

  function beginEdit() {
    setDraftText(item.text);
    setDraftQty(item.qty ?? "");
    setDraftStore(item.store ?? "");
    setDraftAlways(item.alwaysNeeded);
    setDraftOnHand(item.onHand);
    setDraftMin(item.minAtHome);
    setEditing(true);
  }
  function save() {
    const t = draftText.trim();
    if (!t) return;
    onPatch(item.id, {
      text: t,
      qty: draftQty.trim() || null,
      store: draftStore || null,
      alwaysNeeded: draftAlways,
      onHand: Math.max(0, Math.floor(draftOnHand)),
      minAtHome: Math.max(0, Math.floor(draftMin)),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ padding: 12, background: CARD, border: `2px solid ${GOLD}`, borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Item</label>
          <input
            autoFocus
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); else if (e.key === "Escape") setEditing(false); }}
            style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Qty to buy</label>
            <input
              value={draftQty}
              onChange={e => setDraftQty(e.target.value)}
              list={`qty-presets-${item.id}`}
              placeholder="—"
              style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box", textAlign: "center", fontWeight: 700 }}
            />
            <datalist id={`qty-presets-${item.id}`}>
              {QTY_PRESETS.map(q => <option key={q} value={q} />)}
            </datalist>
          </div>
          <div style={{ flex: 1.2 }}>
            <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Store</label>
            <select
              value={draftStore}
              onChange={e => {
                if (e.target.value === ADD_STORE_OPTION) { const name = promptAddStore(addStore); if (name) setDraftStore(name); return; }
                setDraftStore(e.target.value);
              }}
              style={{ width: "100%", padding: "10px 8px", background: BG, border: `1px solid ${draftStore ? colorForStore(draftStore) : BORDER}`, color: draftStore ? colorForStore(draftStore) : MUTED, borderRadius: 8, fontSize: 14, fontWeight: draftStore ? 700 : 400, outline: "none", boxSizing: "border-box" }}
            >
              <option value="">— None —</option>
              {stores.map(s => <option key={s} value={s}>{s}</option>)}
              <option value={ADD_STORE_OPTION}>+ Add store…</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Always</label>
            <button
              onClick={() => setDraftAlways(!draftAlways)}
              style={{
                width: 52, height: 42, borderRadius: 8,
                background: draftAlways ? `${GOLD}22` : BG,
                border: `1px solid ${draftAlways ? GOLD : BORDER}`,
                color: draftAlways ? GOLD : MUTED,
                fontSize: 18, fontWeight: 700, cursor: "pointer",
              }}
            >
              {draftAlways ? "★" : "☆"}
            </button>
          </div>
        </div>

        {/* On hand + Minimum threshold — compact, symmetric, no overflow */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StepperField
            label="🏠 At home"
            value={draftOnHand}
            onChange={setDraftOnHand}
            warn={draftOnHand < draftMin}
          />
          <StepperField
            label="⚠ Min. threshold"
            value={draftMin}
            onChange={setDraftMin}
          />
        </div>
        {draftOnHand < draftMin && (
          <p style={{ margin: 0, fontSize: 11, color: "#f87171", fontWeight: 600 }}>
            ⚠ Below threshold — will be on the shopping list.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={save}
            disabled={!draftText.trim()}
            style={{ flex: 1, padding: "10px", background: GOLD, color: "#0d1117", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: draftText.trim() ? 1 : 0.4 }}
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{ padding: "10px 16px", background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (confirm(`Delete ${item.text}?`)) { onDelete(item.id); } }}
            style={{ padding: "10px 12px", background: "transparent", color: "#f87171", border: `1px solid #7f1d1d`, borderRadius: 8, fontSize: 13, cursor: "pointer" }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  const rowBorder = isLow && !item.done ? "#f87171" : (item.alwaysNeeded ? `${GOLD}55` : BORDER);

  return (
    <div
      onClick={beginEdit}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        background: isLow && !item.done ? "#2a1414" : CARD,
        border: `1px solid ${rowBorder}`, borderRadius: 12,
        cursor: "pointer",
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle(item.id, !item.done); }}
        aria-label={item.done ? "Mark not bought" : "Mark bought"}
        style={{
          width: 22, height: 22, borderRadius: 6,
          border: `2px solid ${item.done ? "#22c55e" : "#484f58"}`,
          background: item.done ? "#22c55e" : "transparent",
          color: "#0d1117", fontSize: 14, fontWeight: 900,
          cursor: "pointer", flexShrink: 0,
        }}
      >{item.done ? "✓" : ""}</button>

      {/* Left: name + store + on-hand controls */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {item.alwaysNeeded && <span style={{ color: GOLD, fontSize: 14, lineHeight: 1 }}>★</span>}
          <span style={{
            fontSize: 15, fontWeight: 600,
            color: item.done ? MUTED : TEXT,
            textDecoration: item.done ? "line-through" : "none",
          }}>{item.text}</span>
          {item.store && (
            <span style={{ fontSize: 10, padding: "1px 7px", background: `${storeColor}22`, border: `1px solid ${storeColor}55`, borderRadius: 8, color: storeColor ?? MUTED, fontWeight: 700, letterSpacing: 0.3 }}>
              {item.store}
            </span>
          )}
          {isLow && !item.done && (
            <span style={{ fontSize: 10, padding: "1px 7px", background: "#7f1d1d", border: "1px solid #f87171", borderRadius: 8, color: "#fecaca", fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>
              ⚠ Low
            </span>
          )}
        </div>
        <div
          onClick={e => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: MUTED, flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 10, opacity: 0.7 }}>🏠 At home:</span>
          <button
            onClick={() => onAdjustOnHand(item.id, -1)}
            disabled={item.onHand === 0}
            aria-label="Decrement"
            style={{ width: 24, height: 24, borderRadius: 6, background: BG, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 14, cursor: "pointer", opacity: item.onHand === 0 ? 0.3 : 1 }}
          >−</button>
          <span style={{ minWidth: 22, textAlign: "center", fontWeight: 800, color: isLow ? "#f87171" : TEXT, fontSize: 13 }}>
            {item.onHand}
          </span>
          <button
            onClick={() => onAdjustOnHand(item.id, 1)}
            aria-label="Increment"
            style={{ width: 24, height: 24, borderRadius: 6, background: BG, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 14, cursor: "pointer" }}
          >+</button>
          <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>
            min <span style={{ fontWeight: 700, color: TEXT }}>{item.minAtHome}</span>
          </span>
        </div>
      </div>

      {/* Right: qty (big, right-aligned) + Edit */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {item.qty ? (
          <span style={{
            fontSize: 18, padding: "4px 12px", minWidth: 40,
            background: "#1e2736", borderRadius: 12, color: GOLD,
            fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.2,
            textAlign: "right", fontFamily: "'SF Mono', Menlo, monospace",
          }}>
            {item.qty}
          </span>
        ) : (
          <span style={{ color: "#484f58", fontSize: 12, minWidth: 30, textAlign: "right" }}>—</span>
        )}
        <button
          onClick={beginEdit}
          aria-label="Edit"
          style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 6, color: MUTED, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ── WhatsApp send modal ─────────────────────────────────────────────────────
// Renders the statement as a real DOM node → captures to PNG → shares via
// the native share sheet with the image attached (Web Share Level 2), so the
// user picks WhatsApp and the picture arrives as an attachment. If Web Share
// with files isn't available, we download the PNG and open a wa.me link with
// prefilled text so the user can attach from Photos.
function SendModal({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const todayLong = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const [number, setNumber] = useState(DEFAULT_WA_NUMBER);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const statementRef = useRef<HTMLDivElement | null>(null);

  // Group by store; unassigned items last under "Any"
  const grouped: { store: string; items: Item[] }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const key = it.store || "Any";
    if (!seen.has(key)) { seen.add(key); grouped.push({ store: key, items: [] }); }
    grouped.find(g => g.store === key)!.items.push(it);
  }
  // Sort: known stores first (Publix, Costco, Kosher), then Any, then anything else
  grouped.sort((a, b) => {
    const rank = (s: string) => s === "Publix" ? 0 : s === "Costco" ? 1 : s === "Kosher" ? 2 : s === "Any" ? 99 : 50;
    return rank(a.store) - rank(b.store);
  });

  // Render to PNG when the modal mounts (and whenever the items/note change).
  // We render the actual statement DOM off to the side of the modal so
  // html-to-image can walk it and paint each pixel.
  useEffect(() => {
    let cancelled = false;
    async function capture() {
      if (!statementRef.current) return;
      try {
        // Wait a frame so fonts + layout settle
        await new Promise(r => requestAnimationFrame(() => r(null)));
        const dataUrl = await htmlToImage.toPng(statementRef.current, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          cacheBust: true,
        });
        if (!cancelled) setPngUrl(dataUrl);
      } catch (e) {
        console.error("capture failed", e);
      }
    }
    capture();
    return () => { cancelled = true; };
  }, [items, note]);

  async function launch() {
    if (!pngUrl) { setError("Preview still rendering — try again in a second."); return; }
    setSending(true); setError(null);
    try {
      // Convert data URL → File
      const res = await fetch(pngUrl);
      const blob = await res.blob();
      const file = new File([blob], `pantry-${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });

      const shareText = note.trim() || `Pantry list — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      // Prefer Web Share w/ files (iOS/Android WhatsApp appears in the sheet)
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: shareText, title: "Pantry list" });
        setSent(true);
        setTimeout(onClose, 1000);
        return;
      }

      // Fallback: download the image, open wa.me with the recipient prefilled.
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      const cleanNumber = number.replace(/\D/g, "");
      const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(shareText + "\n\n(Attach the pantry image just downloaded.)")}`;
      window.open(url, "_blank");
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      // User cancelled the share sheet — not really an error
      if (e instanceof Error && e.name === "AbortError") { setSending(false); return; }
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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>💬 Send to WhatsApp</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", padding: "0 4px" }}>×</button>
        </div>

        <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Recipient (WhatsApp)</label>
        <input
          type="tel"
          value={number}
          onChange={e => setNumber(e.target.value)}
          placeholder="13058778256"
          style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", marginBottom: 4, boxSizing: "border-box" }}
        />
        <p style={{ margin: "0 0 10px", fontSize: 10, color: MUTED }}>
          Include country code, no + or spaces. Wife (Reut) is pre-filled.
        </p>

        <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, marginBottom: 4 }}>Message (optional)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Whenever you have a chance, thanks ❤️"
          style={{ width: "100%", padding: "10px 12px", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
        />

        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: MUTED, fontWeight: 700, margin: "0 0 6px" }}>Preview (this image will be sent)</p>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#f1f5f9", maxHeight: 400, overflowY: "auto", display: "flex", justifyContent: "center", padding: 8 }}>
          {pngUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={pngUrl} alt="Preview" style={{ maxWidth: "100%", height: "auto", display: "block", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
          ) : (
            <p style={{ color: MUTED, fontSize: 12, padding: 40 }}>Rendering…</p>
          )}
        </div>

        {error && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f87171" }}>{error}</p>}
        {sent && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#22c55e", fontWeight: 700 }}>✓ Launched WhatsApp!</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={launch}
            disabled={sending || sent || !pngUrl || items.length === 0}
            style={{ flex: 1, padding: "12px", background: WA_GREEN, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: sending || sent || !pngUrl ? 0.5 : 1 }}
          >
            {sending ? "Launching…" : sent ? "Sent" : "🚀 Launch WhatsApp"}
          </button>
          <button
            onClick={onClose}
            disabled={sending}
            style={{ padding: "12px 18px", background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>

        {/* Off-screen statement DOM — this is what gets captured to PNG */}
        <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}>
          <div ref={statementRef} style={{ width: 560, background: "#ffffff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
            <StatementBody grouped={grouped} totalCount={items.length} dateStr={todayLong} note={note} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Group items by store for the statement view. Publix → Costco → Kosher → Any.
function groupByStore(items: Item[]): { store: string; items: Item[] }[] {
  const grouped: { store: string; items: Item[] }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const key = it.store || "Any";
    if (!seen.has(key)) { seen.add(key); grouped.push({ store: key, items: [] }); }
    grouped.find(g => g.store === key)!.items.push(it);
  }
  grouped.sort((a, b) => {
    const rank = (s: string) => s === "Publix" ? 0 : s === "Costco" ? 1 : s === "Kosher" ? 2 : s === "Any" ? 99 : 50;
    return rank(a.store) - rank(b.store);
  });
  return grouped;
}

// Preview modal — read-only view of the auto-generated shopping list.
// Same statement-style rendering as SendModal, but no recipient fields;
// user clicks "Send to WhatsApp" to hand off to the send flow.
function PreviewModal({ items, onClose, onSend }: { items: Item[]; onClose: () => void; onSend: () => void }) {
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const grouped = groupByStore(items);
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
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>👁 Shopping list preview</h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED }}>
              Auto-generated from items below their minimum threshold. {items.length} item{items.length === 1 ? "" : "s"}.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", padding: "0 4px" }}>×</button>
        </div>

        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#f1f5f9", maxHeight: 500, overflowY: "auto" }}>
          <div style={{ background: "#ffffff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
            <StatementBody grouped={grouped} totalCount={items.length} dateStr={dateStr} note="" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={onSend}
            disabled={items.length === 0}
            style={{ flex: 1, padding: "12px", background: WA_GREEN, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: items.length === 0 ? 0.5 : 1 }}
          >
            💬 Send to WhatsApp
          </button>
          <button
            onClick={onClose}
            style={{ padding: "12px 18px", background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// The DOM that gets rasterized. Mirror of the on-screen preview.
function StatementBody({ grouped, totalCount, dateStr, note }: { grouped: { store: string; items: Item[] }[]; totalCount: number; dateStr: string; note: string }) {
  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: 16, marginBottom: 16, background: "linear-gradient(180deg,#fdfbf3 0%,#ffffff 100%)", padding: "18px 20px", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: GOLD, fontWeight: 700 }}>Pantry</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 2, letterSpacing: -0.4 }}>Shopping List</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
            {dateStr}<br />
            <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{totalCount} item{totalCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>

      {/* Optional note */}
      {note.trim() && (
        <div style={{ padding: "12px 16px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, fontSize: 14, color: "#78350f", marginBottom: 16, whiteSpace: "pre-wrap" }}>
          {note}
        </div>
      )}

      {/* Store sections */}
      {grouped.map(g => {
        const gc = g.store === "Any" ? null : colorForStore(g.store);
        return (
        <div key={g.store} style={{ marginBottom: 18, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "10px 14px",
            background: gc ? `${gc}15` : "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: gc ?? "#334155",
              textTransform: "uppercase", letterSpacing: 1,
            }}>
              {g.store === "Any" ? "Any store" : g.store}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{g.items.length} item{g.items.length === 1 ? "" : "s"}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {g.items.map(i => (
                <tr key={i.id}>
                  <td style={{ padding: "10px 14px", borderTop: "1px solid #f1f5f9", color: "#0f172a", fontSize: 15 }}>
                    <span style={{ display: "inline-block", width: 18, color: GOLD, fontWeight: 700 }}>
                      {i.alwaysNeeded ? "★" : ""}
                    </span>
                    {i.text}
                  </td>
                  <td style={{ padding: "10px 14px", borderTop: "1px solid #f1f5f9", textAlign: "right", fontSize: 18, fontWeight: 800, color: GOLD, fontFamily: "'SF Mono', Menlo, monospace", width: 110 }}>
                    {i.qty ? i.qty : <span style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 400 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })}

      {/* Footer */}
      <div style={{ marginTop: 8, padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 11, color: "#94a3b8", textAlign: "center", letterSpacing: 0.3 }}>
        ★ = keep on hand at all times
      </div>
    </div>
  );
}
