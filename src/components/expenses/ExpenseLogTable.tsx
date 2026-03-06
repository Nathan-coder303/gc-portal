"use client";

import { useState } from "react";
import { format } from "date-fns";
import { deleteExpense } from "@/app/[companyId]/[projectId]/expenses/actions";
import ExpenseEditModal from "./ExpenseEditModal";

type CostCode = { id: string; code: string; name: string };

type Expense = {
  id: string;
  date: string;
  vendor: string;
  description: string;
  costCodeId: string | null;
  costCodeCode: string | null;
  category: string;
  amount: number;
  tax: number;
  paymentMethod: string;
  paidBy: string;
  receiptUrl: string | null;
  notes: string | null;
  isDuplicate: boolean;
  isPossibleDup: boolean;
};

export default function ExpenseLogTable({
  expenses,
  costCodes,
  canEdit,
  canArchive,
}: {
  expenses: Expense[];
  costCodes: CostCode[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  async function handleArchive(id: string) {
    if (!confirm("Archive this expense? It will be hidden but not permanently deleted.")) return;
    setArchiving(id);
    try {
      await deleteExpense(id);
    } finally {
      setArchiving(null);
    }
  }

  const showActions = canEdit || canArchive;

  return (
    <>
      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          costCodes={costCodes}
          onClose={() => setEditingExpense(null)}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Date</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Vendor</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Description</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Cost Code</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Category</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Payment</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Paid By</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Amount</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Tax</th>
              {showActions && <th className="px-4 py-2.5 w-24"></th>}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={showActions ? 10 : 9}
                  className="px-4 py-8 text-center text-sm text-slate-400">
                  No expenses match the current filters
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr
                key={e.id}
                className={`border-b border-slate-50 hover:bg-slate-50 ${
                  e.isDuplicate ? "bg-red-50" : e.isPossibleDup ? "bg-amber-50" : ""
                }`}
              >
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                  {format(new Date(e.date + "T00:00:00"), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {e.vendor}
                  {e.isDuplicate && (
                    <span className="ml-2 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded">exact dup</span>
                  )}
                  {e.isPossibleDup && !e.isDuplicate && (
                    <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">possible dup</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600 max-w-xs">
                  <div className="truncate">{e.description}</div>
                  {e.notes && <div className="text-xs text-slate-400 truncate">{e.notes}</div>}
                </td>
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">{e.costCodeCode ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{e.category}</td>
                <td className="px-4 py-2 text-slate-500">{e.paymentMethod}</td>
                <td className="px-4 py-2 text-slate-500">{e.paidBy}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-800 whitespace-nowrap">
                  ${e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-400 whitespace-nowrap">
                  {e.tax > 0 ? `$${e.tax.toFixed(2)}` : "—"}
                </td>
                {showActions && (
                  <td className="px-4 py-2">
                    <div className="flex gap-2 justify-end">
                      {canEdit && (
                        <button
                          onClick={() => setEditingExpense(e)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      {canArchive && (
                        <button
                          onClick={() => handleArchive(e.id)}
                          disabled={archiving === e.id}
                          className="text-xs text-red-500 hover:underline disabled:opacity-50"
                        >
                          {archiving === e.id ? "..." : "Archive"}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
