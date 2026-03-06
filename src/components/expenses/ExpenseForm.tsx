"use client";

import { useRef, useState } from "react";
import { addExpense } from "@/app/[companyId]/[projectId]/expenses/actions";

type CostCode = { id: string; code: string; name: string };

export default function ExpenseForm({
  projectId,
  costCodes,
}: {
  projectId: string;
  costCodes: CostCode[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    try {
      await addExpense(formData);
      formRef.current?.reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
        <input
          type="date"
          name="date"
          required
          defaultValue={new Date().toISOString().split("T")[0]}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
        <input
          type="text"
          name="vendor"
          required
          placeholder="e.g. Home Depot"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <input
          type="text"
          name="description"
          required
          placeholder="e.g. Lumber 2x4 studs"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Cost Code</label>
        <select
          name="costCodeId"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— None —</option>
          {costCodes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} – {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
        <select
          name="category"
          required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select —</option>
          <option>Materials</option>
          <option>Labor</option>
          <option>Equipment</option>
          <option>Subcontractor</option>
          <option>Overhead</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($)</label>
        <input
          type="number"
          name="amount"
          required
          min="0"
          step="0.01"
          placeholder="0.00"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tax ($)</label>
        <input
          type="number"
          name="tax"
          min="0"
          step="0.01"
          defaultValue="0"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
        <select
          name="paymentMethod"
          required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select —</option>
          <option>Credit Card</option>
          <option>Check</option>
          <option>ACH</option>
          <option>Cash</option>
          <option>Wire</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Paid By</label>
        <input
          type="text"
          name="paidBy"
          required
          placeholder="e.g. Mike Ross"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="col-span-2 flex items-end gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Adding..." : "Add Expense"}
        </button>
        {success && <span className="text-sm text-green-600 font-medium">Expense added!</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
