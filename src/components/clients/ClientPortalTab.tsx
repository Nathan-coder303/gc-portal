"use client";
import { useState, useEffect, useRef } from "react";
import { TrashIcon } from "@/components/ui/icons";

type PortalUser = { id: string; email: string; name: string; createdAt: string };
type Photo = { id: string; caption: string | null; fileName: string; fileSize: number; uploadedAt: string };
type Doc   = { id: string; category: string; label: string; fileName: string; fileSize: number; uploadedAt: string };

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

export default function ClientPortalTab({
  companyId, clientId, clientName, clientEmail,
}: {
  companyId: string; clientId: string; clientName: string; clientEmail: string | null;
}) {
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  // Credentials form
  const [credEmail, setCredEmail] = useState(clientEmail ?? "");
  const [credPassword, setCredPassword] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [credMsg, setCredMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Photo upload
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);

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
      fetch(`/api/${companyId}/clients/${clientId}/portal/photos`).then(r => r.json()),
      fetch(`/api/${companyId}/clients/${clientId}/portal/docs`).then(r => r.json()),
    ]).then(([cred, ph, dc]) => {
      setPortalUser(cred.portalUser ?? null);
      setPhotos(Array.isArray(ph) ? ph : []);
      setDocs(Array.isArray(dc) ? dc : []);
      if (cred.portalUser) setCredEmail(cred.portalUser.email);
    }).finally(() => setLoading(false));
  }, [companyId, clientId]);

  async function saveCredentials() {
    if (!credEmail.trim() || !credPassword.trim()) return;
    setCredSaving(true);
    setCredMsg(null);
    const res = await fetch(`/api/${companyId}/clients/${clientId}/portal/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credEmail.trim(), password: credPassword, name: clientName }),
    });
    const data = await res.json();
    if (res.ok) {
      setPortalUser(data.portalUser);
      setCredPassword("");
      setCredMsg({ ok: true, text: "Portal access " + (portalUser ? "updated" : "created") + "!" });
    } else {
      setCredMsg({ ok: false, text: data.error ?? "Failed" });
    }
    setCredSaving(false);
  }

  async function revokeAccess() {
    if (!confirm("Remove portal access for this client?")) return;
    await fetch(`/api/${companyId}/clients/${clientId}/portal/credentials`, { method: "DELETE" });
    setPortalUser(null);
    setCredMsg({ ok: true, text: "Access revoked." });
  }

  async function uploadPhoto(file: File) {
    setPhotoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    if (photoCaption.trim()) fd.append("caption", photoCaption.trim());
    const res = await fetch(`/api/${companyId}/clients/${clientId}/portal/photos`, { method: "POST", body: fd });
    if (res.ok) {
      const photo = await res.json();
      setPhotos(prev => [photo, ...prev]);
      setPhotoCaption("");
    }
    setPhotoUploading(false);
  }

  async function deletePhoto(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/portal/photos?id=${id}`, { method: "DELETE" });
    setPhotos(prev => prev.filter(p => p.id !== id));
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

📸 View & download project photos in real time
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

  if (loading) return <p className="text-sm py-8 text-center" style={{ color: "#8b949e" }}>Loading…</p>;

  const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };

  return (
    <div className="space-y-8">
      {/* ── Section 1: Access Credentials ── */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>Client Portal Access</h2>
          {portalUser && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
              Active
            </span>
          )}
        </div>

        {portalUser && (
          <div className="rounded-xl px-4 py-3 text-sm space-y-1" style={{ background: "#0a1a0f", border: "1px solid #22c55e33" }}>
            <div style={{ color: "#22c55e" }}>Portal access is active</div>
            <div className="text-xs" style={{ color: "#8b949e" }}>Login: <span style={{ color: "#e6edf3" }}>{portalUser.email}</span></div>
            <div className="text-xs" style={{ color: "#8b949e" }}>
              Link: <span style={{ color: "#58a6ff" }}>{PORTAL_URL}/client-portal/{clientId}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Login Email</label>
            <input
              type="email"
              value={credEmail}
              onChange={e => setCredEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              placeholder="client@email.com"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>
              {portalUser ? "New Password (leave blank to keep)" : "Password"}
            </label>
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
            disabled={credSaving || !credEmail.trim() || (!credPassword.trim() && !portalUser)}
            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            {credSaving ? "Saving…" : portalUser ? "Update Access" : "Create Portal Access"}
          </button>
          {portalUser && (
            <>
              <button
                onClick={() => { setEmailPassword(""); setShowEmailTpl(true); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}
              >
                ✉ Email Credentials
              </button>
              <button
                onClick={revokeAccess}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }}
              >
                Revoke Access
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Section 2: Photos ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>Project Photos</h2>

        {/* Upload row */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Caption (optional)</label>
            <input
              value={photoCaption}
              onChange={e => setPhotoCaption(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
              placeholder="e.g. Tear-off complete – April 24"
            />
          </div>
          <label className="cursor-pointer px-4 py-2 rounded-xl text-sm font-bold" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
            {photoUploading ? "Uploading…" : "+ Upload Photo"}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) { uploadPhoto(e.target.files[0]); e.target.value = ""; } }}
            />
          </label>
        </div>

        {photos.length === 0 ? (
          <p className="text-sm" style={{ color: "#484f58" }}>No photos uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map(p => (
              <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: "#161b22", border: "1px solid #30373f" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/client-portal/${clientId}/photos/${p.id}`}
                  alt={p.caption ?? p.fileName}
                  className="w-full object-cover"
                  style={{ aspectRatio: "4/3" }}
                />
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-xs truncate" style={{ color: "#8b949e" }}>{p.caption || p.fileName}</span>
                  <button onClick={() => deletePhoto(p.id)} className="shrink-0" style={{ color: "#ef4444" }}>
                    <TrashIcon size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Documents ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>Documents</h2>

        {/* Upload row */}
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Category</label>
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
            <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Document Label</label>
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
              <div key={d.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#161b22", border: "1px solid #30373f" }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${CAT_COLORS[d.category]}22`, color: CAT_COLORS[d.category] }}>
                      {DOC_CATEGORIES.find(c => c.value === d.category)?.label ?? d.category}
                    </span>
                    <span className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{d.label}</span>
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
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Portal Credentials Email</h3>
              <button onClick={() => setShowEmailTpl(false)} style={{ color: "#8b949e", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Password to show in email</label>
              <input
                type="text"
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                placeholder="Enter the password you set"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#8b949e" }}>Email body (copy & paste)</label>
              <textarea
                rows={16}
                readOnly
                value={buildEmailTemplate(emailPassword)}
                className="w-full rounded-lg px-3 py-2 text-xs font-mono"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", resize: "vertical" }}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(buildEmailTemplate(emailPassword));
                setShowEmailTpl(false);
              }}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              Copy to Clipboard & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
