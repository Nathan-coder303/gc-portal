"use client";

import { useState } from "react";
import { updatePartner, archivePartner, createPartnerPortalAccess } from "@/app/[companyId]/[projectId]/ledger/actions";

type Partner = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  ownershipPct: number | null;
};

export default function PartnerManager({
  partners,
  projectId,
}: {
  partners: Partner[];
  projectId: string;
}) {
  const [editing, setEditing] = useState<Partner | null>(null);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await updatePartner(fd);
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(id: string, name: string) {
    if (!confirm(`Archive partner "${name}"? Their historical ledger entries will be preserved.`)) return;
    setArchiving(id);
    try {
      await archivePartner(id);
    } finally {
      setArchiving(null);
    }
  }

  async function handleGrantAccess(partner: Partner) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await createPartnerPortalAccess({
        partnerId: partner.id,
        projectId,
        email: accessEmail,
        password: accessPassword,
      });
      setSuccess(`Portal access created for ${partner.name}. They can now log in.`);
      setGrantingId(null);
      setAccessEmail("");
      setAccessPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create access");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <h2 className="font-semibold text-slate-800 mb-4">Partners</h2>

      {success && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: "#0d2a1a", border: "1px solid #166534", color: "#4ade80" }}>
          {success}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="mb-4 p-4 bg-blue-50 rounded-lg grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={editing.id} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input type="text" name="name" required defaultValue={editing.name} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" name="email" defaultValue={editing.email ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role / Title</label>
            <input type="text" name="role" defaultValue={editing.role ?? ""} placeholder="e.g. Managing Partner" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ownership %</label>
            <input type="number" name="ownershipPct" min="0" max="100" step="0.01"
              defaultValue={editing.ownershipPct ?? ""} placeholder="e.g. 40" className={field} />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {loading ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => { setEditing(null); setError(""); }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="text-left py-2 text-slate-500 font-medium">Name</th>
            <th className="text-left py-2 text-slate-500 font-medium">Email</th>
            <th className="text-left py-2 text-slate-500 font-medium">Role</th>
            <th className="text-right py-2 text-slate-500 font-medium">Ownership</th>
            <th className="py-2 w-40"></th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <>
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2.5 font-medium text-slate-800">{p.name}</td>
                <td className="py-2.5 text-slate-500">{p.email ?? "—"}</td>
                <td className="py-2.5 text-slate-500">{p.role ?? "—"}</td>
                <td className="py-2.5 text-right font-mono text-slate-600">
                  {p.ownershipPct != null ? `${p.ownershipPct}%` : "—"}
                </td>
                <td className="py-2.5">
                  <div className="flex gap-2 justify-end flex-wrap">
                    <button onClick={() => { setEditing(p); setError(""); setSuccess(""); }}
                      className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button
                      onClick={() => { setGrantingId(grantingId === p.id ? null : p.id); setError(""); setSuccess(""); setAccessEmail(p.email ?? ""); setAccessPassword(""); }}
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}>
                      🔑 Portal Access
                    </button>
                    <button onClick={() => handleArchive(p.id, p.name)}
                      disabled={archiving === p.id}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50">
                      {archiving === p.id ? "..." : "Archive"}
                    </button>
                  </div>
                </td>
              </tr>
              {grantingId === p.id && (
                <tr key={`${p.id}-access`}>
                  <td colSpan={5} className="py-3 px-2">
                    <div className="rounded-lg p-4" style={{ background: "#1e2736", border: "1px solid #C9A84C44" }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: "#C9A84C" }}>
                        Create portal login for {p.name}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email</label>
                          <input
                            type="email"
                            value={accessEmail}
                            onChange={(e) => setAccessEmail(e.target.value)}
                            placeholder="partner@email.com"
                            className="w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                            style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Password (min 8 chars)</label>
                          <input
                            type="password"
                            value={accessPassword}
                            onChange={(e) => setAccessPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                            style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                          />
                        </div>
                      </div>
                      <p className="text-xs mt-2 mb-3" style={{ color: "#8b949e" }}>
                        Partner will only see <strong style={{ color: "#e6edf3" }}>Ledger</strong> and <strong style={{ color: "#e6edf3" }}>Schedule</strong> for this project.
                      </p>
                      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGrantAccess(p)}
                          disabled={loading || !accessEmail || !accessPassword}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                          style={{ background: "#C9A84C", color: "#0d1117" }}>
                          {loading ? "Creating..." : "Create Access"}
                        </button>
                        <button onClick={() => setGrantingId(null)}
                          className="px-3 py-1.5 text-xs rounded-lg"
                          style={{ background: "#30373f", color: "#8b949e" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
