"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const GOLD = "#C9A84C";

export type FollowUpItem = {
  id: string;
  text: string;
  audioUrl: string | null;
  audioMimeType: string | null;
  audioSize: number | null;
  clientId: string | null;
  clientName: string | null;
  leadId?: string | null;
  leadName?: string | null;
  completedAt: string | null;
  createdAt: string;
  dueDate?: string | null;
};

type ClientOption = {
  id: string;
  name: string;
};

type LeadOption = {
  id: string;
  name: string | null;
};

// ─── Audio Player ────────────────────────────────────────────────────────────

function AudioPlayer({ src, mimeType }: { src: string; mimeType: string | null }) {
  const [canPlay, setCanPlay] = useState<boolean | null>(null);

  useEffect(() => {
    const audio = document.createElement("audio");
    if (mimeType && mimeType !== "") {
      setCanPlay(audio.canPlayType(mimeType) !== "");
    } else {
      setCanPlay(true);
    }
  }, [mimeType]);

  if (canPlay === false) {
    return (
      <p className="text-xs italic" style={{ color: "#8b949e" }}>
        ⚠ Audio not supported on this device
      </p>
    );
  }

  return (
    <audio
      controls
      src={src}
      className="w-full"
      style={{ height: 32 }}
      onError={() => setCanPlay(false)}
    />
  );
}

// ─── Single Item Row ──────────────────────────────────────────────────────────

function ItemRow({
  item,
  companyId,
  onToggle,
  onDelete,
  onUpdate,
}: {
  item: FollowUpItem;
  companyId: string;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (updated: FollowUpItem) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [editDate, setEditDate] = useState(
    item.dueDate ? item.dueDate.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const isComplete = !!item.completedAt;

  async function handleToggle() {
    setToggling(true);
    const res = await fetch(`/api/${companyId}/follow-ups/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: isComplete ? null : new Date().toISOString() }),
    });
    if (res.ok) onToggle(item.id, !isComplete);
    setToggling(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/${companyId}/follow-ups/${item.id}`, { method: "DELETE" });
    onDelete(item.id);
  }

  async function handleSaveEdit() {
    setSaving(true);
    const res = await fetch(`/api/${companyId}/follow-ups/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: editText.trim() || item.text,
        dueDate: editDate || null,
      }),
    });
    if (res.ok) {
      const raw = await res.json();
      onUpdate({
        ...item,
        text: raw.text,
        dueDate: raw.dueDate ?? null,
      });
      setEditing(false);
    }
    setSaving(false);
  }

  const audioSrc = item.audioUrl
    ? `/api/${companyId}/follow-ups/${item.id}/audio`
    : null;

  if (editing) {
    return (
      <div
        className="flex flex-col gap-2 py-2 px-1 rounded-lg"
        style={{ background: "#1e2736" }}
        onClick={e => e.stopPropagation()}
      >
        <input
          type="text"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSaveEdit()}
          autoFocus
          className="w-full text-sm px-3 py-2 rounded-lg outline-none"
          style={{ background: "#0d1117", border: "1px solid #484f58", color: "#e6edf3" }}
        />
        <input
          type="date"
          value={editDate}
          onChange={e => setEditDate(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg outline-none"
          style={{ background: "#0d1117", border: "1px solid #484f58", color: editDate ? "#e6edf3" : "#8b949e", colorScheme: "dark" }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="text-xs px-3 py-1 rounded-lg font-semibold"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            onClick={() => { setEditing(false); setEditText(item.text); setEditDate(item.dueDate ? item.dueDate.slice(0, 10) : ""); }}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ color: "#8b949e", border: "1px solid #30373f" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1 py-2 px-1 rounded-lg transition-colors"
      style={{ background: hovered ? "#1e2736" : "transparent" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border transition-all"
          style={{
            border: isComplete ? `2px solid ${GOLD}` : "2px solid #484f58",
            background: isComplete ? GOLD : "transparent",
          }}
          title={isComplete ? "Mark incomplete" : "Mark complete"}
        />

        {/* Text */}
        <span
          className="flex-1 text-sm leading-snug"
          style={{
            color: isComplete ? "#8b949e" : "#e6edf3",
            textDecoration: isComplete ? "line-through" : "none",
          }}
        >
          {item.text || <em style={{ color: "#8b949e" }}>Voice note</em>}
          {!isComplete && item.dueDate && item.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && (
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}>
              past due
            </span>
          )}
        </span>

        {/* Edit button — always visible */}
        <button
          onClick={() => setEditing(true)}
          className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded opacity-50 hover:opacity-100"
          style={{ color: "#58a6ff", border: "1px solid #58a6ff33" }}
        >
          ✎
        </button>

        {/* Delete button — hover only */}
        {hovered && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded opacity-70 hover:opacity-100"
            style={{ color: "#f85149", border: "1px solid #f8514933" }}
          >
            {deleting ? "…" : "✕"}
          </button>
        )}
      </div>

      {/* Due date label */}
      {item.dueDate && (
        <div className="ml-6">
          <span className="text-[10px]" style={{ color: "#8b949e" }}>
            {new Date(item.dueDate).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
      )}

      {/* Client or Lead badge */}
      {(item.clientName || item.leadName) && (
        <div className="ml-6">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}
          >
            {item.clientName || item.leadName}
          </span>
        </div>
      )}

      {/* Audio player */}
      {audioSrc && (
        <div className="ml-6 mt-1">
          <AudioPlayer src={audioSrc} mimeType={item.audioMimeType} />
        </div>
      )}
    </div>
  );
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddForm({
  companyId,
  category,
  clients,
  leads,
  onSaved,
  onCancel,
}: {
  companyId: string;
  category: "TASK" | "FOLLOW_UP" | "ESTIMATE";
  clients: ClientOption[];
  leads: LeadOption[];
  onSaved: (item: FollowUpItem) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [textValue, setTextValue] = useState("");
  const [dueDateValue, setDueDateValue] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice state
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTextRef = useRef("");
  const pendingBlobRef = useRef<Blob | null>(null);
  const pendingTranscriptRef = useRef("");

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const fmtElapsed = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  async function startRecording() {
    setError(null);
    setLiveText("");
    finalTextRef.current = "";
    chunksRef.current = [];
    pendingBlobRef.current = null;
    pendingTranscriptRef.current = "";

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording not supported on this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied.");
      return;
    }

    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach(t => t.stop());
      setError("MediaRecorder not supported. Try Chrome or Safari.");
      return;
    }

    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(250);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec = new (SR as any)();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (event: any) => {
          let interim = "";
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) final += t + " ";
            else interim += t;
          }
          if (final) finalTextRef.current += final;
          setLiveText(finalTextRef.current + interim);
        };
        rec.onerror = () => { /* non-fatal */ };
        rec.start();
        recognitionRef.current = rec;
      } catch { /* speech API unavailable */ }
    }

    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    setRecording(true);
  }

  async function stopRecording() {
    setRecording(false);
    setProcessing(true);
    stopTimer();
    recognitionRef.current?.stop();

    const audioBlob = await new Promise<Blob>((resolve) => {
      const mr = mediaRecorderRef.current!;
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const mimeType = mr.mimeType || (isIOS ? "audio/mp4" : "audio/webm");
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }));
      mr.stop();
      mr.stream.getTracks().forEach(t => t.stop());
    });

    await new Promise(r => setTimeout(r, 600));
    const transcript = finalTextRef.current.trim() || liveText.trim();

    pendingBlobRef.current = audioBlob;
    pendingTranscriptRef.current = transcript;
    if (transcript) setTextValue(transcript);
    setProcessing(false);
  }

  async function handleSave() {
    const text = textValue.trim();
    const blob = pendingBlobRef.current;

    if (!text && !blob) {
      setError("Please enter text or record audio.");
      return;
    }

    setSaving(true);
    setError(null);

    const fd = new FormData();
    fd.append("category", category);
    fd.append("text", text);
    if (selectedClientId) fd.append("clientId", selectedClientId);
    if (selectedLeadId && !selectedClientId) fd.append("leadId", selectedLeadId);
    if (dueDateValue) fd.append("dueDate", dueDateValue);
    if (blob) {
      const ext = blob.type.includes("mp4") || blob.type.includes("aac") || blob.type.includes("m4a") ? "m4a" : "webm";
      fd.append("audio", blob, `note.${ext}`);
    }

    try {
      const res = await fetch(`/api/${companyId}/follow-ups`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to save.");
        setSaving(false);
        return;
      }
      const raw = await res.json();
      const item: FollowUpItem = {
        id: raw.id,
        text: raw.text,
        audioUrl: raw.audioUrl,
        audioMimeType: raw.audioMimeType,
        audioSize: raw.audioSize,
        clientId: raw.clientId,
        clientName: raw.client?.name ?? null,
        leadId: raw.leadId ?? null,
        leadName: raw.lead?.name ?? null,
        completedAt: raw.completedAt ?? null,
        createdAt: raw.createdAt,
      };
      onSaved(item);
      setTextValue("");
      setDueDateValue("");
      setSelectedClientId("");
      setSelectedLeadId("");
      pendingBlobRef.current = null;
      pendingTranscriptRef.current = "";
      setLiveText("");
      finalTextRef.current = "";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="mt-3 rounded-xl p-3 flex flex-col gap-2"
      style={{ background: "#1e2736", border: "1px solid #30373f" }}
    >
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("text")}
          className="text-xs px-2 py-1 rounded font-medium transition-colors"
          style={{
            background: mode === "text" ? GOLD : "transparent",
            color: mode === "text" ? "#0d1117" : "#8b949e",
            border: mode === "text" ? "none" : "1px solid #30373f",
          }}
        >
          Text
        </button>
        <button
          onClick={() => setMode("voice")}
          className="text-xs px-2 py-1 rounded font-medium transition-colors"
          style={{
            background: mode === "voice" ? GOLD : "transparent",
            color: mode === "voice" ? "#0d1117" : "#8b949e",
            border: mode === "voice" ? "none" : "1px solid #30373f",
          }}
        >
          🎙 Voice
        </button>
      </div>

      {mode === "text" ? (
        <input
          type="text"
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          placeholder="Add item…"
          autoFocus
          className="w-full text-sm px-3 py-2 rounded-lg outline-none"
          style={{
            background: "#0d1117",
            border: "1px solid #484f58",
            color: "#e6edf3",
          }}
        />
      ) : (
        <div>
          {/* Live transcript / hint */}
          <div
            className="rounded-lg px-3 py-2 text-xs min-h-[48px] mb-2"
            style={{
              background: "#0d1117",
              border: `1px solid ${recording ? GOLD + "88" : "#30373f"}`,
              color: recording ? "#e6edf3" : "#8b949e",
            }}
          >
            {liveText || (recording ? "Listening…" : "Press Record and speak.")}
          </div>
          <div className="flex items-center gap-2">
            {!recording ? (
              <button
                onClick={startRecording}
                disabled={processing}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: GOLD, color: "#0d1117" }}
              >
                🎙 {processing ? "Processing…" : "Record"}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: "#f85149", color: "#fff" }}
              >
                ⏹ Stop
              </button>
            )}
            {recording && (
              <span className="text-xs font-mono" style={{ color: "#f85149" }}>
                ● {fmtElapsed(elapsed)}
              </span>
            )}
            {pendingBlobRef.current && !recording && (
              <span className="text-xs" style={{ color: "#8b949e" }}>
                Audio ready
              </span>
            )}
          </div>
          {/* Editable text after voice */}
          {(pendingBlobRef.current || textValue) && !recording && (
            <input
              type="text"
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              placeholder="Edit transcription (optional)…"
              className="w-full text-sm px-3 py-2 rounded-lg outline-none mt-2"
              style={{
                background: "#0d1117",
                border: "1px solid #484f58",
                color: "#e6edf3",
              }}
            />
          )}
        </div>
      )}

      {/* Due date */}
      <input
        type="date"
        value={dueDateValue}
        onChange={e => setDueDateValue(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-lg outline-none"
        style={{ background: "#0d1117", border: "1px solid #484f58", color: dueDateValue ? "#e6edf3" : "#8b949e", colorScheme: "dark" }}
      />

      {/* Assignment pickers */}
      <div className="flex flex-col gap-1.5">
        {/* Lead picker */}
        {leads.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => { setShowLeadPicker(v => !v); setShowClientPicker(false); }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs"
              style={{ background: "#0d1117", border: `1px solid ${selectedLeadId ? GOLD + "88" : "#484f58"}`, color: selectedLeadId ? GOLD : "#8b949e" }}
            >
              <span>{selectedLeadId ? (leads.find(l => l.id === selectedLeadId)?.name ?? "Lead") : "Assign to lead"}</span>
              <span>{showLeadPicker ? "▲" : "▼"}</span>
            </button>
            {showLeadPicker && (
              <div className="mt-1 rounded-lg overflow-hidden max-h-36 overflow-y-auto" style={{ border: "1px solid #30373f", background: "#0d1117" }}>
                {selectedLeadId && (
                  <button
                    type="button"
                    onClick={() => { setSelectedLeadId(""); setShowLeadPicker(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs"
                    style={{ color: "#8b949e", borderBottom: "1px solid #30373f" }}
                  >
                    — Clear
                  </button>
                )}
                {leads.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setSelectedLeadId(l.id); setSelectedClientId(""); setShowLeadPicker(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#1e2736]"
                    style={{ color: l.id === selectedLeadId ? GOLD : "#e6edf3", borderBottom: "1px solid #30373f11" }}
                  >
                    {l.name ?? "(no name)"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Client picker */}
        {clients.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => { setShowClientPicker(v => !v); setShowLeadPicker(false); }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs"
              style={{ background: "#0d1117", border: `1px solid ${selectedClientId ? GOLD + "88" : "#484f58"}`, color: selectedClientId ? GOLD : "#8b949e" }}
            >
              <span>{selectedClientId ? (clients.find(c => c.id === selectedClientId)?.name ?? "Client") : "Assign to client"}</span>
              <span>{showClientPicker ? "▲" : "▼"}</span>
            </button>
            {showClientPicker && (
              <div className="mt-1 rounded-lg overflow-hidden max-h-36 overflow-y-auto" style={{ border: "1px solid #30373f", background: "#0d1117" }}>
                {selectedClientId && (
                  <button
                    type="button"
                    onClick={() => { setSelectedClientId(""); setShowClientPicker(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs"
                    style={{ color: "#8b949e", borderBottom: "1px solid #30373f" }}
                  >
                    — Clear
                  </button>
                )}
                {clients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedClientId(c.id); setSelectedLeadId(""); setShowClientPicker(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#1e2736]"
                    style={{ color: c.id === selectedClientId ? GOLD : "#e6edf3", borderBottom: "1px solid #30373f11" }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: "#f85149" }}>{error}</p>}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: GOLD, color: "#0d1117" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: "#8b949e", border: "1px solid #30373f" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Card Component ──────────────────────────────────────────────────────

export default function TodayTaskCard({
  companyId,
  category,
  label,
  initialItems,
  initialUpcoming,
  clients,
  leads,
}: {
  companyId: string;
  category: "TASK" | "FOLLOW_UP" | "ESTIMATE";
  label: string;
  initialItems: FollowUpItem[];
  initialUpcoming?: FollowUpItem[];
  clients: ClientOption[];
  leads?: LeadOption[];
}) {
  const [items, setItems] = useState<FollowUpItem[]>(initialItems);
  const [upcomingItems, setUpcomingItems] = useState<FollowUpItem[]>(initialUpcoming ?? []);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [hovered, setHovered] = useState(false);

  const openCount = items.filter(i => !i.completedAt).length;
  const doneCount = items.filter(i => !!i.completedAt).length;

  function handleToggle(id: string, nowComplete: boolean) {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, completedAt: nowComplete ? new Date().toISOString() : null }
          : item
      )
    );
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    setUpcomingItems(prev => prev.filter(i => i.id !== id));
  }

  function handleUpdate(updated: FollowUpItem) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    setUpcomingItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  function handleSaved(item: FollowUpItem) {
    setItems(prev => [...prev, item]);
    setShowAdd(false);
  }

  // Split open/done for rendering
  const openItems = items.filter(i => !i.completedAt);
  const doneItems = items.filter(i => !!i.completedAt);

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2 transition-all cursor-pointer"
      style={{
        background: "#161b22",
        border: `1px solid ${hovered ? "#C9A84C55" : "#30373f"}`,
        transform: hovered ? "scale(1.01)" : "scale(1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !showAdd && setShowAdd(true)}
    >
      {/* Header */}
      <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
        <span className="text-[26px] sm:text-3xl font-black leading-none" style={{ color: "#C9A84C" }}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              {openCount} open{doneCount > 0 ? ` · ${doneCount} done` : ""}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setShowAdd(v => !v); }}
            className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
            style={{
              border: `1px solid ${GOLD}66`,
              color: GOLD,
              background: showAdd ? "#C9A84C22" : "transparent",
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div onClick={e => e.stopPropagation()}>
          <AddForm
            companyId={companyId}
            category={category}
            clients={clients}
            leads={leads ?? []}
            onSaved={handleSaved}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {/* Item list */}
      {items.length === 0 && !showAdd ? (
        <p className="text-xs" style={{ color: "#8b949e" }}>
          No items yet. Click &quot;+&quot; to get started.
        </p>
      ) : (
        <div className="flex flex-col divide-y" style={{ borderColor: "#30373f" }} onClick={e => e.stopPropagation()}>
          {openItems.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              companyId={companyId}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
          {doneItems.length > 0 && (
            <>
              {openItems.length > 0 && (
                <div className="py-1">
                  <span className="text-xs" style={{ color: "#484f58" }}>Completed</span>
                </div>
              )}
              {doneItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  companyId={companyId}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Upcoming tasks */}
      {upcomingItems.length > 0 && (
        <div onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowUpcoming(v => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg mt-1"
            style={{ background: "#1e273688", border: "1px solid #C9A84C22" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#C9A84C" }}>
              Upcoming ({upcomingItems.length})
            </span>
            <span style={{ color: "#C9A84C", fontSize: 11 }}>{showUpcoming ? "▲" : "▼"}</span>
          </button>
          {showUpcoming && (
            <div className="mt-1 flex flex-col divide-y rounded-lg overflow-hidden" style={{ borderColor: "#30373f", border: "1px solid #30373f" }}>
              {upcomingItems.map(item => {
                const dateLabel = item.dueDate
                  ? new Date(item.dueDate).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
                  : "";
                return (
                  <div key={item.id} className="px-2 py-2" style={{ background: "#0d1117" }}>
                    {dateLabel && (
                      <div className="text-[10px] font-bold mb-1" style={{ color: "#C9A84C" }}>{dateLabel}</div>
                    )}
                    <ItemRow
                      item={item}
                      companyId={companyId}
                      onToggle={(id, done) => {
                        if (done) {
                          setUpcomingItems(prev => prev.filter(i => i.id !== id));
                          setItems(prev => [...prev, { ...item, completedAt: new Date().toISOString() }]);
                        }
                      }}
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
