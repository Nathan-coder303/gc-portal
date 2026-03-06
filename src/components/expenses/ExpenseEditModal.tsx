"use client";

import { useState } from "react";
import { updateExpense } from "@/app/[companyId]/[projectId]/expenses/actions";

type CostCode = { id: string; code: string; name: string };

type Expense = {
  id: string;
  date: string;         // "YYYY-MM-DD"
  vendor: string;
  description: string;
  costCodeId: string | null;
  category: string;
  amount: number;
  tax: number;
  paymentMethod: string;
  paidBy: string;
  receiptUrl: string | null;
  notes: string | null;
};

export default function ExpenseEditModal({
  expense,
  costCodes,
  onClose,
}: {
  expense: Expense;
  costCodes: CostCode[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await updateExpense(fd);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-base">Edit Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-2 gap-3">
          <input type="hidden" name="id" value={expense.id} />

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" name="date" required defaultValue={expense.date} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
            <input type="text" name="vendor" required defaultValue={expense.vendor} className={field} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input type="text" name="description" required defaultValue={expense.description} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cost Code</label>
            <select name="costCodeId" defaultValue={expense.costCodeId ?? ""} className={field}>
              <option value="">— None —</option>
              {costCodes.map((c) => (
                <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select name="category" required defaultValue={expense.category} className={field}>
              {["Materials","Labor","Equipment","Subcontractor","Overhead","Other"].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($)</label>
            <input type="number" name="amount" required min="0" step="0.01"
              defaultValue={expense.amount.toFixed(2)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tax ($)</label>
            <input type="number" name="tax" min="0" step="0.01"
              defaultValue={expense.tax.toFixed(2)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
            <select name="paymentMethod" required defaultValue={expense.paymentMethod} className={field}>
              {["Credit Card","Check","ACH","Cash","Wire"].map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Paid By</label>
            <input type="text" name="paidBy" required defaultValue={expense.paidBy} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Receipt URL</label>
            <input type="text" name="receiptUrl" defaultValue={expense.receiptUrl ?? ""} className={field}
              placeholder="https://..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input type="text" name="notes" defaultValue={expense.notes ?? ""} className={field} />
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-2 border-t border-slate-100">
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
