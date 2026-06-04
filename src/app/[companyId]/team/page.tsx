"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

type Role = "ADMIN" | "PM" | "BOOKKEEPER" | "PARTNER";

type TeamUser = {
  id: string;
  email: string;
  name: string;
  lastName: string | null;
  role: Role;
  createdAt: string;
};

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: "ADMIN",      label: "Admin",      hint: "Full access including team management" },
  { value: "PM",         label: "PM",         hint: "Project + estimating + messaging" },
  { value: "BOOKKEEPER", label: "Bookkeeper", hint: "Financials + invoices + expenses" },
  { value: "PARTNER",    label: "Partner",    hint: "Read-only across estimates" },
];

export default function TeamPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; role: Role; sendInvite: boolean }>({ name: "", email: "", role: "PM", sendInvite: true });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; tempPassword?: string; emailSent?: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/${companyId}/team`);
    if (res.ok) {
      const { users } = await res.json();
      setUsers(users);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function submitInvite() {
    setSubmitting(true);
    setResult(null);
    const res = await fetch(`/api/${companyId}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult({ ok: true, msg: `Created ${data.user.name}`, tempPassword: data.tempPassword, emailSent: data.emailSent });
      setInviteForm({ name: "", email: "", role: "PM", sendInvite: true });
      await load();
    } else {
      setResult({ ok: false, msg: data.error ?? "Failed" });
    }
  }

  async function changeRole(userId: string, role: Role) {
    await fetch(`/api/${companyId}/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await load();
  }

  async function resetPassword(userId: string, name: string) {
    if (!confirm(`Reset password for ${name}? They'll need the new temporary password.`)) return;
    const res = await fetch(`/api/${companyId}/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult({ ok: true, msg: `Temp password for ${name}`, tempPassword: data.tempPassword });
    } else {
      setResult({ ok: false, msg: data.error ?? "Failed" });
    }
  }

  async function removeUser(userId: string, name: string) {
    if (!confirm(`Remove ${name}? They'll lose access immediately.`)) return;
    const res = await fetch(`/api/${companyId}/team/${userId}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const data = await res.json();
      setResult({ ok: false, msg: data.error ?? "Failed" });
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8" style={{ color: TEXT }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-sm mt-1" style={{ color: MUTED }}>People with access to the portal. Anyone here joins all client conversations.</p>
        </div>
        <button
          onClick={() => { setInviteOpen(true); setResult(null); }}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{ background: GOLD, color: "#0d1117" }}
        >
          + Invite
        </button>
      </div>

      {result && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: result.ok ? "#0d2a1a" : "#2a1010", border: `1px solid ${result.ok ? "#22c55e44" : "#ef444444"}`, color: result.ok ? "#22c55e" : "#ef4444" }}>
          <p className="font-semibold">{result.msg}</p>
          {result.tempPassword && (
            <p className="mt-1.5 text-xs" style={{ color: TEXT }}>
              Temp password (copy now): <code className="px-2 py-0.5 rounded ml-1" style={{ background: BG, color: GOLD, fontFamily: "monospace" }}>{result.tempPassword}</code>
              {result.emailSent === false && <span className="ml-2" style={{ color: "#f59e0b" }}>(email send failed — share manually)</span>}
              {result.emailSent === true && <span className="ml-2" style={{ color: "#22c55e" }}>(emailed)</span>}
            </p>
          )}
          <button onClick={() => setResult(null)} className="absolute top-2 right-3 text-xs" style={{ color: MUTED }}>✕</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-center py-12" style={{ color: MUTED }}>Loading…</p>
      ) : users.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="text-2xl mb-2">👥</p>
          <p className="text-sm font-semibold mb-1">No team members yet</p>
          <p className="text-xs" style={{ color: MUTED }}>Click + Invite to add the first one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: "#1e2736", color: GOLD }}>
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.name}{u.lastName ? ` ${u.lastName}` : ""}</p>
                <p className="text-xs truncate" style={{ color: MUTED }}>{u.email}</p>
              </div>
              <select
                value={u.role}
                onChange={e => changeRole(u.id, e.target.value as Role)}
                className="rounded-lg px-2 py-1 text-xs font-semibold shrink-0"
                style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
              >
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button
                onClick={() => resetPassword(u.id, u.name)}
                className="text-xs px-2.5 py-1 rounded shrink-0"
                style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}
                title="Reset password"
              >
                🔑
              </button>
              <button
                onClick={() => removeUser(u.id, u.name)}
                className="text-xs px-2.5 py-1 rounded shrink-0"
                style={{ background: "#2a1010", color: "#ef4444", border: "1px solid #ef444433" }}
                title="Remove user"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold">Invite team member</p>
              <button onClick={() => setInviteOpen(false)} style={{ color: MUTED, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Name</label>
              <input
                value={inviteForm.name}
                onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Email</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                placeholder="jane@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Role</label>
              <div className="space-y-1.5">
                {ROLE_OPTIONS.map(r => (
                  <label key={r.value} className="flex items-start gap-2 cursor-pointer rounded-lg px-3 py-2" style={{ background: inviteForm.role === r.value ? "#C9A84C22" : BG, border: `1px solid ${inviteForm.role === r.value ? "#C9A84C66" : BORDER}` }}>
                    <input
                      type="radio"
                      name="role"
                      checked={inviteForm.role === r.value}
                      onChange={() => setInviteForm({ ...inviteForm, role: r.value })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: TEXT }}>{r.label}</p>
                      <p className="text-xs" style={{ color: MUTED }}>{r.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inviteForm.sendInvite}
                onChange={e => setInviteForm({ ...inviteForm, sendInvite: e.target.checked })}
              />
              <span className="text-xs" style={{ color: MUTED }}>Email login details automatically</span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={submitInvite}
                disabled={submitting || !inviteForm.name.trim() || !inviteForm.email.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: GOLD, color: "#0d1117" }}
              >
                {submitting ? "Creating…" : "Create"}
              </button>
              <button onClick={() => setInviteOpen(false)} className="px-5 py-2.5 rounded-xl text-sm" style={{ background: "#1e2736", color: TEXT, border: `1px solid ${BORDER}` }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
