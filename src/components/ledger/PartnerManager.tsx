"use client";

import { useState } from "react";
import { updatePartner, archivePartner } from "@/app/[companyId]/[projectId]/ledger/actions";

type Partner = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  ownershipPct: number | null;
};

export default function PartnerManager({ partners }: { partners: Partner[] }) {
  const [editing, setEditing] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  const field = "w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <h2 className="font-semibold text-slate-800 mb-4">Partners</h2>

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
            <th className="py-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-2.5 font-medium text-slate-800">{p.name}</td>
              <td className="py-2.5 text-slate-500">{p.email ?? "—"}</td>
              <td className="py-2.5 text-slate-500">{p.role ?? "—"}</td>
              <td className="py-2.5 text-right font-mono text-slate-600">
                {p.ownershipPct != null ? `${p.ownershipPct}%` : "—"}
              </td>
              <td className="py-2.5">
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditing(p); setError(""); }}
                    className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleArchive(p.id, p.name)}
                    disabled={archiving === p.id}
                    className="text-xs text-red-500 hover:underline disabled:opacity-50">
                    {archiving === p.id ? "..." : "Archive"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
