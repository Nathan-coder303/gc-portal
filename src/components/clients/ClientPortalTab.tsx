"use client";
import { useState, useEffect, useRef } from "react";
import { TrashIcon } from "@/components/ui/icons";

type PortalUser = { id: string; email: string; name: string; createdAt: string };
type Doc   = { id: string; category: string; label: string; fileName: string; fileSize: number; uploadedAt: string };
type Settings = { portalShowMessages: boolean; portalShowDailyPhotos: boolean; portalShowDocuments: boolean; portalShowDailyLogs: boolean };

const DOC_CATEGORIES = [
  { value: "PERMIT_CARD",        label: "Permit Card" },
  { value: "PERMIT_APPLICATION", label: "Permit Application" },
  { value: "NOC",                label: "Notice of Commencement (NOC)" },
  { value: "OTHER",              label: "Other" },
];

const CAT_COLORS: Record<string, string> = {
  PERMIT_CARD: "#22c55e",
  PERMIT_APPLICATION: "#3b82f6",
  NOC: "#C9A84C",
  OTHER: "#8b949e",
};

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PORTAL_URL = "https://gc-portal-two.vercel.app";

const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const GOLD = "#C9A84C";
const MUTED = "#8b949e";
const TEXT = "#e6edf3";

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none py-2.5 px-3 rounded-xl" style={{ background: BG, border: `1px solid ${BORDER}` }}>
      <span className="text-sm" style={{ color: TEXT }}>{label}</span>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span className="text-xs" style={{ color: value ? "#22c55e" : MUTED }}>{value ? "Visible" : "Hidden"}</span>
        <div
          className="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
          style={{ background: value ? "#22c55e" : BORDER }}
          onClick={() => onChange(!value)}
        >
          <div
            className="w-4 h-4 rounded-full absolute top-[2px] transition-all bg-white"
            style={{ left: value ? "22px" : "2px" }}
          />
        </div>
      </div>
    </label>
  );
}

export default function ClientPortalTab({
  companyId, clientId, clientName, clientEmail,
}: {
  companyId: string; clientId: string; clientName: string; clientEmail: string | null;
}) {
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [newName, setNewName] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [settings, setSettings] = useState<Settings>({
    portalShowMessages: true,
    portalShowDailyPhotos: true,
    portalShowDocuments: true,
    portalShowDailyLogs: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Credentials form
  const [credEmail, setCredEmail] = useState(clientEmail ?? "");
  const [credPassword, setCredPassword] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [credMsg, setCredMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Doc upload
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState("PERMIT_CARD");
  const [docLabel, setDocLabel] = useState("");
  const [docUploading, setDocUploading] = useState(false);

  // Email template modal
  const [showEmailTpl, setShowEmailTpl] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/${companyId}/clients/${clientId}/portal/credentials`).then(r => r.json()),
      fetch(`/api/${companyId}/clients/${clientId}/portal/docs`).then(r => r.json()),
      fetch(`/api/${companyId}/clients/${clientId}/portal/settings`).then(r => r.json()),
    ]).then(([cred, dc, sett]) => {
      setPortalUser(cred.portalUser ?? null);
      setPortalUsers(cred.portalUsers ?? []);
      setDocs(Array.isArray(dc) ? dc : []);
      if (sett && !sett.error) setSettings(sett);
      // Don't prefill — empty form means "add a new login"
      setCredEmail("");
    }).finally(() => setLoading(false));
  }, [companyId, clientId]);

  async function toggleSetting(key: keyof Settings, value: boolean) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSavingSettings(true);
    await fetch(`/api/${companyId}/clients/${clientId}/portal/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSavingSettings(false);
  }

  async function saveCredentials() {
    if (!credEmail.trim() || !credPassword.trim()) return;
    setCredSaving(true);
    setCredMsg(null);
    const res = await fetch(`/api/${companyId}/clients/${clientId}/portal/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credEmail.trim(), password: credPassword, name: newName.trim() || clientName }),
    });
    const data = await res.json();
    if (res.ok) {
      // Refresh list
      const wasNew = !portalUsers.some(u => u.email === credEmail.trim().toLowerCase());
      setPortalUsers(prev => wasNew ? [...prev, data.portalUser] : prev.map(u => u.id === data.portalUser.id ? data.portalUser : u));
      if (!portalUser) setPortalUser(data.portalUser);
      setCredEmail("");
      setCredPassword("");
      setNewName("");
      setCredMsg({ ok: true, text: wasNew ? `Added ${data.portalUser.email}` : `Updated ${data.portalUser.email}` });
    } else {
      setCredMsg({ ok: false, text: data.error ?? "Failed" });
    }
    setCredSaving(false);
  }

  async function removePortalUser(userId: string, email: string) {
    if (!confirm(`Remove portal access for ${email}?`)) return;
    await fetch(`/api/${companyId}/clients/${clientId}/portal/credentials?userId=${userId}`, { method: "DELETE" });
    const next = portalUsers.filter(u => u.id !== userId);
    setPortalUsers(next);
    setPortalUser(next[0] ?? null);
    setCredMsg({ ok: true, text: `Removed ${email}` });
  }

  async function uploadDoc(file: File) {
    if (!docLabel.trim()) return alert("Enter a label for this document.");
    setDocUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", docCategory);
    fd.append("label", docLabel.trim());
    const res = await fetch(`/api/${companyId}/clients/${clientId}/portal/docs`, { method: "POST", body: fd });
    if (res.ok) {
      const doc = await res.json();
      setDocs(prev => [doc, ...prev]);
      setDocLabel("");
    }
    setDocUploading(false);
  }

  async function deleteDoc(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/portal/docs?id=${id}`, { method: "DELETE" });
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  function buildEmailTemplate(pwd: string) {
    const portalLink = `${PORTAL_URL}/client-portal/${clientId}`;
    return `Dear ${clientName.split(" ")[0]},

We are pleased to give you access to your dedicated Client Portal, where you can track your project's progress, view photos, and download important documents like permit cards, permit applications, and the Notice of Commencement (NOC).

─── YOUR PORTAL ACCESS ───

🔗 Portal Link: ${portalLink}
📧 Username (email): ${credEmail}
🔑 Password: ${pwd || "[ password you set ]"}

─── WHAT YOU CAN DO ───

💬 Message your contractor directly
📸 View & download site photos from daily logs
📄 Access permit cards, applications, and legal documents
📥 Download any file directly to your device
🔒 Secure — only accessible with your login

─── HOW TO LOG IN ───

1. Go to: ${portalLink}
2. Enter your email and password above
3. Bookmark the page for easy access

If you have any questions, don't hesitate to reach out.

Mike Baruh
Founder/CEO | MIBH Construction
📱 305.746.7307 | mike@mibhconstruction.com`;
  }

  if (loading) return <p className="text-sm py-8 text-center" style={{ color: MUTED }}>Loading…</p>;

  const inputStyle = { background: BG, border: `1px solid ${BORDER}`, color: TEXT };

  return (
    <div className="space-y-8">

      {/* ── Section 1: Access Credentials ── */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD }}>Client Portal Logins</h2>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>Add the client, spouse, partner, or anyone who should see this portal. All logins share the same view.</p>
          </div>
          {portalUsers.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
              {portalUsers.length} {portalUsers.length === 1 ? "user" : "users"}
            </span>
          )}
        </div>

        {portalUsers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>Active logins</p>
            {portalUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#0a1a0f", border: "1px solid #22c55e33" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: "#22c55e22", color: "#22c55e" }}>
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{u.name}</p>
                  <p className="text-xs truncate" style={{ color: MUTED }}>{u.email}</p>
                </div>
                <button
                  onClick={() => removePortalUser(u.id, u.email)}
                  className="text-xs px-2.5 py-1 rounded shrink-0"
                  style={{ background: "#2a1010", color: "#ef4444", border: "1px solid #ef444433" }}
                  title="Remove login"
                >
                  ✕
                </button>
              </div>
            ))}
            <p className="text-xs" style={{ color: MUTED }}>
              Portal link: <span style={{ color: "#58a6ff" }}>{PORTAL_URL}/client-portal/{clientId}</span>
            </p>
          </div>
        )}

        <div className="rounded-xl p-4 space-y-3" style={{ background: BG, border: `1px dashed ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
            {portalUsers.length === 0 ? "Create first login" : "Add another login"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Display Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
                placeholder={`e.g. ${clientName.split(" ")[0]}'s spouse`}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Login Email</label>
              <input
                type="email"
                value={credEmail}
                onChange={e => setCredEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
                placeholder="spouse@email.com"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Password</label>
              <input
                type="text"
                value={credPassword}
                onChange={e => setCredPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
                placeholder="Set a password"
              />
            </div>
          </div>

          {credMsg && (
            <p className="text-xs font-medium" style={{ color: credMsg.ok ? "#22c55e" : "#ef4444" }}>{credMsg.text}</p>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={saveCredentials}
              disabled={credSaving || !credEmail.trim() || !credPassword.trim()}
              className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: GOLD, color: "#0d1117" }}
            >
              {credSaving ? "Saving…" : "+ Add Login"}
            </button>
            {portalUsers.length > 0 && (
              <button
                onClick={() => { setEmailPassword(""); setShowEmailTpl(true); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}
              >
                ✉ Email Credentials Template
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Portal Section Visibility ── */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: GOLD }}>What Client Sees</h2>
          {savingSettings && <span className="text-xs" style={{ color: MUTED }}>Saving…</span>}
        </div>
        <p className="text-xs" style={{ color: MUTED }}>
          Toggle which sections appear in the client portal. Changes take effect immediately.
        </p>
        <Toggle
          value={settings.portalShowMessages}
          onChange={v => toggleSetting("portalShowMessages", v)}
          label="Messages — direct chat with contractor"
        />
        <Toggle
          value={settings.portalShowDailyPhotos}
          onChange={v => toggleSetting("portalShowDailyPhotos", v)}
          label="Photo Gallery — all site photos from daily logs"
        />
        <Toggle
          value={settings.portalShowDocuments}
          onChange={v => toggleSetting("portalShowDocuments", v)}
          label="Documents — permits, NOC, and uploaded files"
        />
        <Toggle
          value={settings.portalShowDailyLogs}
          onChange={v => toggleSetting("portalShowDailyLogs", v)}
          label="Daily Logs — view logs with PDF download"
        />
      </div>

      {/* ── Section 3: Documents ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>Documents</h2>

        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Category</label>
            <select
              value={docCategory}
              onChange={e => setDocCategory(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ ...inputStyle, width: "auto" }}
            >
              {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Document Label</label>
            <input
              value={docLabel}
              onChange={e => setDocLabel(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              placeholder="e.g. Permit Card – April 2026"
            />
          </div>
          <label className="cursor-pointer px-4 py-2 rounded-xl text-sm font-bold" style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}>
            {docUploading ? "Uploading…" : "+ Upload Doc"}
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) { uploadDoc(e.target.files[0]); e.target.value = ""; } }}
            />
          </label>
        </div>

        {docs.length === 0 ? (
          <p className="text-sm" style={{ color: "#484f58" }}>No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${CAT_COLORS[d.category]}22`, color: CAT_COLORS[d.category] }}>
                      {DOC_CATEGORIES.find(c => c.value === d.category)?.label ?? d.category}
                    </span>
                    <span className="text-sm font-semibold truncate" style={{ color: TEXT }}>{d.label}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#484f58" }}>{d.fileName} · {fmt(d.fileSize)}</div>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <a
                    href={`/api/client-portal/${clientId}/docs/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded font-semibold"
                    style={{ color: "#58a6ff", background: "#58a6ff11", border: "1px solid #58a6ff33" }}
                  >
                    View
                  </a>
                  <button onClick={() => deleteDoc(d.id)} style={{ color: "#ef4444" }}>
                    <TrashIcon size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Email Template Modal ── */}
      {showEmailTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}`, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: TEXT }}>Portal Credentials Email</h3>
              <button onClick={() => setShowEmailTpl(false)} style={{ color: MUTED, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Password to show in email</label>
              <input
                type="text"
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                placeholder="Enter the password you set"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Email body (copy & paste)</label>
              <textarea
                rows={18}
                readOnly
                value={buildEmailTemplate(emailPassword)}
                className="w-full rounded-lg px-3 py-2 text-xs font-mono"
                style={{ ...inputStyle, resize: "vertical" }}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(buildEmailTemplate(emailPassword));
                setShowEmailTpl(false);
              }}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ background: GOLD, color: "#0d1117" }}
            >
              Copy to Clipboard & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
