"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { put } from "@vercel/blob/client";
import SwipeToReply from "@/components/shared/SwipeToReply";

type Attachment = { id: string; name: string; url: string; mimeType: string };
type Message = {
  id: string;
  companyId: string;
  clientId: string;
  content: string;
  attachments: string | null;
  senderType: string;
  senderName: string;
  readByClient: boolean;
  readByContractor: boolean;
  replyToId: string | null;
  createdAt: string;
};

function quotePreview(content: string, atts: Attachment[]) {
  if (content.trim()) return content.length > 80 ? content.slice(0, 80) + "…" : content;
  if (atts.length > 0) return `📎 ${atts.length} attachment${atts.length > 1 ? "s" : ""}`;
  return "(message)";
}

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

export default function MessagesTab({
  companyId,
  clientId,
  clientName,
  clientEmail,
}: {
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notifyClient, setNotifyClient] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const [welcomeResult, setWelcomeResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesById = new Map(messages.map(m => [m.id, m]));

  function startReply(msg: Message) {
    setReplyTo(msg);
    textareaRef.current?.focus();
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/messages`);
    if (res.ok) setMessages(await res.json());
  }, [companyId, clientId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!content.trim() && files.length === 0) return;
    setSending(true);
    setUploadError(null);
    try {
      const attachments: { id: string; name: string; url: string; mimeType: string }[] = [];
      for (const file of files) {
        const tokenRes = await fetch(`/api/${companyId}/clients/${clientId}/messages/upload-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        if (!tokenRes.ok) throw new Error("Failed to get upload token");
        const { token, pathname } = await tokenRes.json() as { token: string; pathname: string };
        const blob = await put(pathname, file, { access: "private", token });
        attachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          url: blob.url,
          mimeType: file.type || (file.name.match(/\.(heic|heif)$/i) ? "image/jpeg" : "application/octet-stream"),
        });
      }

      const res = await fetch(`/api/${companyId}/clients/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), notifyClient, attachments, replyToId: replyTo?.id ?? null }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setContent("");
        setFiles([]);
        setReplyTo(null);
        textareaRef.current?.focus();
      } else {
        setUploadError("Failed to send message");
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
    setSending(false);
  }

  async function sendWelcome() {
    setSendingWelcome(true);
    setWelcomeResult(null);
    const res = await fetch(`/api/${companyId}/clients/${clientId}/send-welcome-email`, { method: "POST" });
    const data = await res.json();
    setWelcomeResult(res.ok ? { ok: true, msg: "Welcome email sent!" } : { ok: false, msg: data.error ?? "Failed to send" });
    setSendingWelcome(false);
  }

  const unread = messages.filter(m => m.senderType === "CLIENT" && !m.readByContractor).length;

  return (
    <>
    {/* Input lives outside overflow-hidden so iOS Safari fires onChange reliably */}
    <input
      id="msg-file-input"
      type="file"
      multiple
      accept="image/*,image/heic,image/heif,.pdf,.doc,.docx,.xlsx,.xls"
      className="hidden"
      onChange={e => {
        const f = e.target.files;
        if (f && f.length > 0) setFiles(prev => [...prev, ...Array.from(f)]);
      }}
    />
    <div className="flex flex-col rounded-xl overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 480, background: BG, border: `1px solid ${BORDER}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: CARD, borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: TEXT }}>Messages — {clientName}</span>
          {unread > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#22c55e", color: "#0d1117" }}>
              {unread} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {welcomeResult && (
            <span className="text-xs" style={{ color: welcomeResult.ok ? "#22c55e" : "#ef4444" }}>{welcomeResult.msg}</span>
          )}
          {clientEmail && (
            <button
              onClick={sendWelcome}
              disabled={sendingWelcome}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: "#C9A84C22", color: GOLD, border: `1px solid #C9A84C44` }}
            >
              {sendingWelcome ? "Sending…" : "Send Welcome Email"}
            </button>
          )}
          <button
            onClick={load}
            className="p-1.5 rounded-lg text-xs"
            style={{ background: BG, border: `1px solid ${BORDER}`, color: MUTED }}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm pt-12" style={{ color: MUTED }}>
            No messages yet. Start the conversation below.
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderType === "CONTRACTOR";
          const atts = parseAtts(msg.attachments);
          const time = new Date(msg.createdAt).toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          });
          const repliedTo = msg.replyToId ? messagesById.get(msg.replyToId) : null;
          return (
            <SwipeToReply key={msg.id} onReply={() => startReply(msg)}>
              <div className={`group flex ${isMine ? "justify-end" : "justify-start"} items-end gap-1`}>
                {isMine && (
                  <button
                    onClick={() => startReply(msg)}
                    className="hidden sm:block opacity-50 hover:opacity-100 transition-opacity text-sm px-2 py-1 rounded"
                    style={{ color: MUTED, background: BG, border: `1px solid ${BORDER}` }}
                    title="Reply"
                  >↩</button>
                )}
                <div style={{ maxWidth: "75%" }}>
                  <p className="text-xs mb-1" style={{ color: MUTED, textAlign: isMine ? "right" : "left" }}>
                    {msg.senderName} · {time}
                  </p>
                  <div
                    className="rounded-2xl px-4 py-2.5 text-sm"
                    style={{
                      background: isMine ? "#C9A84C1a" : CARD,
                      border: `1px solid ${isMine ? "#C9A84C44" : BORDER}`,
                      color: TEXT,
                      borderBottomRightRadius: isMine ? 4 : 16,
                      borderBottomLeftRadius: isMine ? 16 : 4,
                    }}
                  >
                    {repliedTo && (
                      <div
                        className="rounded-lg px-2.5 py-1.5 mb-2 border-l-2"
                        style={{ background: "#0d1117", borderLeftColor: GOLD, borderTop: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}
                      >
                        <p className="text-[11px] font-bold" style={{ color: GOLD }}>{repliedTo.senderName}</p>
                        <p className="text-xs truncate" style={{ color: MUTED }}>{quotePreview(repliedTo.content, parseAtts(repliedTo.attachments))}</p>
                      </div>
                    )}
                    {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                    {atts.length > 0 && (
                      <div className={`${msg.content ? "mt-2" : ""} space-y-1.5`}>
                        {atts.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/${companyId}/clients/${clientId}/messages/${msg.id}?attachment=${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {att.mimeType.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/${companyId}/clients/${clientId}/messages/${msg.id}?attachment=${att.id}`}
                                alt={att.name}
                                className="rounded-xl max-w-full block"
                                style={{ maxHeight: 220, border: `1px solid ${BORDER}` }}
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
                  {isMine && (
                    <p className="text-xs mt-0.5 text-right" style={{ color: msg.readByClient ? "#22c55e" : MUTED }}>
                      {msg.readByClient ? "✓ Read" : "Delivered"}
                    </p>
                  )}
                </div>
                {!isMine && (
                  <button
                    onClick={() => startReply(msg)}
                    className="hidden sm:block opacity-50 hover:opacity-100 transition-opacity text-sm px-2 py-1 rounded"
                    style={{ color: MUTED, background: BG, border: `1px solid ${BORDER}` }}
                    title="Reply"
                  >↩</button>
                )}
              </div>
            </SwipeToReply>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="shrink-0 px-3 pt-2 pb-3 space-y-2" style={{ background: CARD, borderTop: `1px solid ${BORDER}` }}>
        {uploadError && (
          <p className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "#2a1010", color: "#ef4444", border: "1px solid #ef444433" }}>
            {uploadError}
          </p>
        )}

        {replyTo && (
          <div className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 border-l-2" style={{ background: BG, borderLeftColor: GOLD, borderTop: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold" style={{ color: GOLD }}>Replying to {replyTo.senderName}</p>
              <p className="text-xs truncate" style={{ color: MUTED }}>{quotePreview(replyTo.content, parseAtts(replyTo.attachments))}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-xs shrink-0" style={{ color: MUTED }} title="Cancel reply">✕</button>
          </div>
        )}

        {/* Attachments row */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1 mr-2">
            {files.map((f, i) => (
              <div key={i} className="relative">
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT }}>
                  📎 {f.name}
                </span>
                <button
                  onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: "#ef4444", color: "#fff" }}
                >×</button>
              </div>
            ))}
          </div>
          <label
            htmlFor="msg-file-input"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0 transition-opacity hover:opacity-80"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            + Add
          </label>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 rounded-xl px-3 py-2 text-sm resize-none"
            style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
          />
          <button
            onClick={send}
            disabled={sending || (!content.trim() && files.length === 0)}
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base disabled:opacity-40 shrink-0"
            style={{ background: GOLD, color: "#0d1117" }}
          >
            {sending ? "…" : "↑"}
          </button>
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setNotifyClient(v => !v)}>
            <div className="w-8 h-[18px] rounded-full relative transition-colors" style={{ background: notifyClient ? "#22c55e" : BORDER }}>
              <div className="w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all bg-white" style={{ left: notifyClient ? "18px" : "2px" }} />
            </div>
            <span className="text-xs" style={{ color: MUTED }}>Email client to check portal</span>
          </label>
        </div>
      </div>
    </div>
    </>
  );
}
