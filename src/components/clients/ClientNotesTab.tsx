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

function AudioPlayer({ src, mimeType }: { src: string; mimeType: string | null }) {
  const [canPlay, setCanPlay] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = document.createElement("audio");
    if (mimeType && mimeType !== "") {
      // Check if browser can play this format
      const support = audio.canPlayType(mimeType);
      setCanPlay(support !== "");
    } else {
      setCanPlay(true); // unknown format, let browser try
    }
  }, [mimeType]);

  if (canPlay === false) {
    return (
      <p className="text-xs italic py-2" style={{ color: "#8b949e" }}>
        ⚠ Audio format not supported on this device. Play on desktop or re-record.
      </p>
    );
  }

  return (
    <audio
      ref={audioRef}
      controls
      src={src}
      className="w-full"
      onError={() => setCanPlay(false)}
    />
  );
}

function NoteCard({
  note, companyId, clientId, onDelete,
}: {
  note: Note; companyId: string; clientId: string; onDelete: (id: string) => void;
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

      {audioSrc && (
        <div className="mb-3">
          <AudioPlayer src={audioSrc} mimeType={note.audioMimeType} />
          {note.audioSize && (
            <p className="text-xs mt-1" style={{ color: "#8b949e" }}>🎙 {fmtSize(note.audioSize)}</p>
          )}
        </div>
      )}

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
  companyId, clientId, initialNotes,
}: {
  companyId: string; clientId: string; initialNotes: Note[];
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

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported on this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow microphone permission in your browser settings.");
      return;
    }

    // Don't specify mimeType — let the browser pick its native format.
    // On Chrome: audio/webm;codecs=opus. On iOS Safari: audio/mp4.
    // Using mr.mimeType after construction gives us the actual format chosen.
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach(t => t.stop());
      setError("Audio recording is not supported on this browser. Try Chrome or Safari on iOS 14.3+.");
      return;
    }

    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(250);

    // Web Speech API — Chrome/Edge only, silent fail on iOS Safari
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
        rec.onerror = () => { /* non-fatal — audio still records */ };
        rec.start();
        recognitionRef.current = rec;
      } catch { /* speech API unavailable, still record audio */ }
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
      // mr.mimeType is set by the browser — captures the actual format used
      const mimeType = mr.mimeType || "audio/webm";
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }));
      mr.stop();
      mr.stream.getTracks().forEach(t => t.stop());
    });

    // Small delay for speech recognition to fire final results
    await new Promise(r => setTimeout(r, 600));

    const transcription = finalTextRef.current.trim() || liveText.trim();
    const ext = audioBlob.type.includes("mp4") || audioBlob.type.includes("aac") || audioBlob.type.includes("m4a") ? "m4a" : "webm";

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
      <div className="rounded-2xl p-5 mb-6" style={{ background: "#1e2736", border: `1px solid ${recording ? GOLD + "88" : "#30373f"}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Voice Note</h3>
          {recording && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514944" }}>
              ● REC {fmtElapsed(elapsed)}
            </span>
          )}
        </div>

        <div
          className="rounded-xl p-4 mb-4 min-h-[80px] text-sm leading-relaxed"
          style={{ background: "#0d1117", border: "1px solid #30373f", color: recording ? "#e6edf3" : "#8b949e" }}
        >
          {liveText || (recording ? "Listening… (transcription available on Chrome/desktop)" : "Press record and start speaking. Transcription works in Chrome; audio is saved on all devices.")}
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
            {recording ? "Speak clearly" : `${notes.length} note${notes.length !== 1 ? "s" : ""} saved`}
          </span>
        </div>
      </div>

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
