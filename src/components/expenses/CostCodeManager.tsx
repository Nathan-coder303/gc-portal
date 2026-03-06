"use client";

import { useState } from "react";
import { upsertCostCode, deleteCostCode } from "@/app/[companyId]/[projectId]/expenses/actions";

type CostCode = { id: string; code: string; name: string; budgetAmount: number };

export default function CostCodeManager({
  projectId,
  costCodes,
}: {
  projectId: string;
  costCodes: CostCode[];
}) {
  const [editing, setEditing] = useState<CostCode | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("projectId", projectId);
    if (editing) fd.set("id", editing.id);
    try {
      await upsertCostCode(fd);
      setEditing(null);
      setAdding(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this cost code? Expenses linked to it will become uncategorized.")) return;
    await deleteCostCode(id);
  }

  const FormRow = ({ cc }: { cc?: CostCode }) => (
    <form onSubmit={handleSave} className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
      <input type="text" name="code" required placeholder="Code" defaultValue={cc?.code}
        className="w-28 border border-slate-200 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <input type="text" name="name" required placeholder="Name" defaultValue={cc?.name}
        className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <input type="number" name="budgetAmount" min="0" step="0.01" placeholder="Budget $"
        defaultValue={cc?.budgetAmount ?? ""}
        className="w-32 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="submit" disabled={loading}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? "..." : "Save"}
      </button>
      <button type="button" onClick={() => { setEditing(null); setAdding(false); }}
        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50">
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Cost Codes</h2>
        {!adding && !editing && (
          <button onClick={() => setAdding(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + Add Code
          </button>
        )}
      </div>

      {adding && <div className="mb-3"><FormRow /></div>}

      <table className="w-full text-sm">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="text-left py-2 text-slate-500 font-medium">Code</th>
            <th className="text-left py-2 text-slate-500 font-medium">Name</th>
            <th className="text-right py-2 text-slate-500 font-medium">Budget</th>
            <th className="py-2 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {costCodes.map(cc =>
            editing?.id === cc.id ? (
              <tr key={cc.id}><td colSpan={4} className="py-2"><FormRow cc={cc} /></td></tr>
            ) : (
              <tr key={cc.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2.5 font-mono text-slate-700 font-medium">{cc.code}</td>
                <td className="py-2.5 text-slate-700">{cc.name}</td>
                <td className="py-2.5 text-right font-mono text-slate-600">
                  ${Number(cc.budgetAmount).toLocaleString()}
                </td>
                <td className="py-2.5">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAdding(false); setEditing(cc); }}
                      className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(cc.id)}
                      className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
