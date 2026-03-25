"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Note = {
  id: string;
  transcription: string | null;
  audioUrl: string | null;
  audioMimeType: string | null;
  audioSize: number | null;
  createdAt: string;
};

const GOLD = "#C9A84C";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function NoteCard({
  note,
  companyId,
  clientId,
  onDelete,
}: {
  note: Note;
  companyId: string;
  clientId: string;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/${companyId}/clients/${clientId}/notes?noteId=${note.id}`, { method: "DELETE" });
    onDelete(note.id);
  }

  const audioSrc = note.audioUrl
    ? `/api/${companyId}/clients/${clientId}/notes/${note.id}`
    : null;

  return (
    <div className="rounded-xl p-4" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-xs" style={{ color: "#8b949e" }}>{fmtDate(note.createdAt)}</span>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-0.5 rounded" style={{ color: "#f85149", border: "1px solid #f8514933" }}>
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
            <button onClick={handleDelete} disabled={deleting} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#f8514922", color: "#f85149" }}>
              {deleting ? "…" : "Yes"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-0.5 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>
              No
            </button>
          </div>
        )}
      </div>

      {/* Audio player */}
      {audioSrc && (
        <div className="mb-3">
          <audio
            controls
            src={audioSrc}
            className="w-full"
            style={{ height: 36, accentColor: GOLD }}
          />
          {note.audioSize && (
            <p className="text-xs mt-1" style={{ color: "#8b949e" }}>🎙 {fmtSize(note.audioSize)}</p>
          )}
        </div>
      )}

      {/* Transcription */}
      {note.transcription ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#e6edf3" }}>
          {note.transcription}
        </p>
      ) : (
        <p className="text-sm italic" style={{ color: "#8b949e" }}>No transcription</p>
      )}
    </div>
  );
}

export default function ClientNotesTab({
  companyId,
  clientId,
  initialNotes,
}: {
  companyId: string;
  clientId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTextRef = useRef("");

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  async function startRecording() {
    setError(null);
    setLiveText("");
    finalTextRef.current = "";
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow microphone permission.");
      return;
    }

    // Pick best supported mime type — iOS Safari needs mp4, Chrome uses webm
    const preferredMime = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
      "",
    ].find(m => !m || MediaRecorder.isTypeSupported(m)) ?? "";
    const mr = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(250);

    // Web Speech API for live transcription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = new (SpeechRecognition as any)();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += t + " ";
          } else {
            interim += t;
          }
        }
        if (final) finalTextRef.current += final;
        setLiveText(finalTextRef.current + interim);
      };

      rec.onerror = () => { /* non-fatal */ };
      rec.start();
      recognitionRef.current = rec;
    }

    // Elapsed timer
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    setRecording(true);
  }

  async function stopRecording() {
    setRecording(false);
    setProcessing(true);
    stopTimer();

    // Stop speech recognition
    recognitionRef.current?.stop();

    // Stop MediaRecorder and collect blob
    const audioBlob = await new Promise<Blob>((resolve) => {
      const mr = mediaRecorderRef.current!;
      const mimeType = mr.mimeType || "audio/webm";
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }));
      mr.stop();
      mr.stream.getTracks().forEach(t => t.stop());
    });

    // Small delay so speech recognition fires final results
    await new Promise(r => setTimeout(r, 600));

    const transcription = finalTextRef.current.trim() || liveText.trim();
    const ext = audioBlob.type.includes("mp4") || audioBlob.type.includes("aac") ? "m4a" : "webm";

    // Upload
    const fd = new FormData();
    fd.append("transcription", transcription);
    fd.append("audio", audioBlob, `note.${ext}`);

    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/notes`, { method: "POST", body: fd });
      const note = await res.json();
      setNotes(prev => [{ ...note }, ...prev]);
      setLiveText("");
      finalTextRef.current = "";
    } catch {
      setError("Failed to save note. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  useEffect(() => () => stopTimer(), [stopTimer]);

  const fmtElapsed = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div>
      {/* Recorder card */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#1e2736", border: `1px solid ${recording ? GOLD + "88" : "#30373f"}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Voice Note</h3>
          {recording && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514944" }}>
              ● REC {fmtElapsed(elapsed)}
            </span>
          )}
        </div>

        {/* Live transcription area */}
        <div
          className="rounded-xl p-4 mb-4 min-h-[80px] text-sm leading-relaxed"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: recording ? "#e6edf3" : "#8b949e" }}
        >
          {liveText || (recording ? "Listening…" : "Press record and start speaking. Your words will appear here in real time.")}
        </div>

        {error && <p className="text-xs mb-3" style={{ color: "#f85149" }}>{error}</p>}

        <div className="flex items-center gap-3">
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={processing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ background: GOLD, color: "#0d1117" }}
            >
              🎙 {processing ? "Saving…" : "Record"}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ background: "#f85149", color: "#fff" }}
            >
              ⏹ Stop & Save
            </button>
          )}
          <span className="text-xs" style={{ color: "#8b949e" }}>
            {recording ? "Speak clearly — transcription is live" : `${notes.length} note${notes.length !== 1 ? "s" : ""} saved`}
          </span>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <p className="text-sm" style={{ color: "#8b949e" }}>No notes yet. Record your first voice note above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <NoteCard
              key={n.id}
              note={n}
              companyId={companyId}
              clientId={clientId}
              onDelete={id => setNotes(prev => prev.filter(x => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
