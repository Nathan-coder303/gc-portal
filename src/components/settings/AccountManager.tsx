"use client";

import { useState } from "react";
import { updateAccount, archiveAccount } from "@/app/[companyId]/[projectId]/ledger/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";

type Account = { id: string; name: string; type: string; isPartnerCapital: boolean; projectId: string };

export default function AccountManager({ accounts }: { accounts: Account[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>, accountId: string, projectId: string) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("id", accountId);
    fd.set("projectId", projectId);
    try {
      await updateAccount(fd);
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(id: string, projectId: string, name: string) {
    if (!confirm(`Archive account "${name}"? Historical journal entries referencing it will be preserved.`)) return;
    setArchiving(id);
    try {
      await archiveAccount(id, projectId);
    } finally {
      setArchiving(null);
    }
  }

  const field = "border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1";

  return (
    <div>
      <h2 className="font-semibold text-slate-800 mb-4">Ledger Accounts</h2>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="text-left py-2 text-slate-500 font-medium">Account</th>
            <th className="text-left py-2 text-slate-500 font-medium">Type</th>
            <th className="text-left py-2 text-slate-500 font-medium">Partner Capital</th>
            <th className="py-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-2.5 font-medium text-slate-800">
                {editing === a.id ? (
                  <form
                    onSubmit={(e) => handleSave(e, a.id, a.projectId)}
                    className="flex items-center gap-2"
                  >
                    <input type="text" name="name" required defaultValue={a.name} className={field} />
                    <button type="submit" disabled={loading}
                      className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 font-medium whitespace-nowrap">
                      {loading ? "..." : "Save"}
                    </button>
                    <button type="button" onClick={() => setEditing(null)}
                      className="px-2.5 py-1 border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50 whitespace-nowrap">
                      Cancel
                    </button>
                  </form>
                ) : a.name}
              </td>
              <td className="py-2.5 text-slate-500">{a.type}</td>
              <td className="py-2.5 text-slate-500">{a.isPartnerCapital ? "Yes" : "—"}</td>
              <td className="py-2.5">
                {editing !== a.id && (
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(a.id)}
                      className="w-7 h-7 rounded flex items-center justify-center"
                      style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                      title="Edit">
                      <PencilIcon size={13} />
                    </button>
                    <button onClick={() => handleArchive(a.id, a.projectId, a.name)}
                      disabled={archiving === a.id}
                      className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-50"
                      style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                      title="Archive">
                      <TrashIcon size={13} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
