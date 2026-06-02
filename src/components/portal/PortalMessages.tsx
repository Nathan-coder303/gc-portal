"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Attachment = { id: string; name: string; url: string; mimeType: string };
type Message = {
  id: string;
  content: string;
  attachments: string | null;
  senderType: string;
  senderName: string;
  readByClient: boolean;
  createdAt: string;
};

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

function parseAtts(raw: string | null): Attachment[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function PortalMessages({ clientId }: { clientId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/client-portal/${clientId}/messages`);
    if (res.ok) setMessages(await res.json());
  }, [clientId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!content.trim() && files.length === 0) return;
    setSending(true);
    const fd = new FormData();
    fd.append("content", content.trim());
    for (const f of files) fd.append("files", f);
    const res = await fetch(`/api/client-portal/${clientId}/messages`, { method: "POST", body: fd });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setContent("");
      setFiles([]);
      textareaRef.current?.focus();
    }
    setSending(false);
  }

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: `1px solid ${BORDER}`, background: BG, height: 480 }}>
      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ background: CARD, borderBottom: `1px solid ${BORDER}` }}>
        <p className="text-sm font-bold" style={{ color: TEXT }}>Messages</p>
        <p className="text-xs mt-0.5" style={{ color: MUTED }}>Direct communication with your contractor</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm pt-8" style={{ color: MUTED }}>No messages yet.</p>
        )}
        {messages.map((msg) => {
          const isContractor = msg.senderType === "CONTRACTOR";
          const atts = parseAtts(msg.attachments);
          const time = new Date(msg.createdAt).toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          });
          return (
            <div key={msg.id} className={`flex ${isContractor ? "justify-start" : "justify-end"}`}>
              <div style={{ maxWidth: "80%" }}>
                <p className="text-xs mb-1" style={{ color: MUTED, textAlign: isContractor ? "left" : "right" }}>
                  {isContractor ? msg.senderName : "You"} · {time}
                </p>
                <div
                  className="rounded-2xl px-4 py-2.5 text-sm"
                  style={{
                    background: isContractor ? CARD : "#C9A84C1a",
                    border: `1px solid ${isContractor ? BORDER : "#C9A84C44"}`,
                    color: TEXT,
                    borderBottomLeftRadius: isContractor ? 4 : 16,
                    borderBottomRightRadius: isContractor ? 16 : 4,
                  }}
                >
                  {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                  {atts.length > 0 && (
                    <div className={`${msg.content ? "mt-2" : ""} space-y-1.5`}>
                      {atts.map((att) => (
                        <a
                          key={att.id}
                          href={`/api/client-portal/${clientId}/messages/${msg.id}?attachment=${att.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {att.mimeType.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/client-portal/${clientId}/messages/${msg.id}?attachment=${att.id}`}
                              alt={att.name}
                              className="rounded-xl max-w-full block"
                              style={{ maxHeight: 200, border: `1px solid ${BORDER}` }}
                            />
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: "#1e2736", color: GOLD, border: `1px solid ${BORDER}` }}>
                              📎 {att.name}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="shrink-0 px-3 pt-2 pb-3 space-y-2" style={{ background: CARD, borderTop: `1px solid ${BORDER}` }}>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT }}>
                {f.name}
                <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ color: MUTED }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Reply to your contractor…"
            rows={2}
            className="flex-1 rounded-xl px-3 py-2 text-sm resize-none"
            style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
          />
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: BG, border: `1px solid ${BORDER}`, color: MUTED }}
              title="Attach file"
            >
              📎
            </button>
            <button
              onClick={send}
              disabled={sending || (!content.trim() && files.length === 0)}
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base disabled:opacity-40"
              style={{ background: GOLD, color: "#0d1117" }}
            >
              {sending ? "…" : "↑"}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={e => {
            if (e.target.files) setFiles(p => [...p, ...Array.from(e.target.files!)]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
