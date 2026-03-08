"use client";

import { useState } from "react";
import { format } from "date-fns";
import { deleteExpense, bulkArchiveExpenses, bulkReclassifyExpenses } from "@/app/[companyId]/[projectId]/expenses/actions";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [reclassifyCodeId, setReclassifyCodeId] = useState<string>("");
  const [showReclassify, setShowReclassify] = useState(false);

  const canBulkAction = canEdit || canArchive;
  const showActions = canEdit || canArchive;
  const allSelected = expenses.length > 0 && selected.size === expenses.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(expenses.map((e) => e.id)));
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this expense? It will be hidden but not permanently deleted.")) return;
    setArchiving(id);
    try {
      await deleteExpense(id);
    } finally {
      setArchiving(null);
    }
  }

  async function handleBulkArchive() {
    if (!confirm(`Archive ${selected.size} selected expense(s)?`)) return;
    setBulkWorking(true);
    try {
      await bulkArchiveExpenses(Array.from(selected));
      setSelected(new Set());
    } finally {
      setBulkWorking(false);
    }
  }

  async function handleBulkReclassify() {
    setBulkWorking(true);
    try {
      await bulkReclassifyExpenses(Array.from(selected), reclassifyCodeId || null);
      setSelected(new Set());
      setShowReclassify(false);
      setReclassifyCodeId("");
    } finally {
      setBulkWorking(false);
    }
  }

  const colCount = (canBulkAction ? 1 : 0) + 9 + (showActions ? 1 : 0);

  return (
    <>
      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          costCodes={costCodes}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {/* Bulk action bar */}
      {canBulkAction && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-slate-400 hover:text-white text-xs"
          >
            Clear
          </button>
          {canEdit && (
            <div className="flex items-center gap-2">
              {showReclassify ? (
                <>
                  <select
                    value={reclassifyCodeId}
                    onChange={(e) => setReclassifyCodeId(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none"
                  >
                    <option value="">— no code —</option>
                    {costCodes.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkReclassify}
                    disabled={bulkWorking}
                    className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 text-xs font-medium"
                  >
                    {bulkWorking ? "..." : "Apply"}
                  </button>
                  <button
                    onClick={() => setShowReclassify(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowReclassify(true)}
                  className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 text-xs font-medium"
                >
                  Reclassify
                </button>
              )}
            </div>
          )}
          {canArchive && (
            <button
              onClick={handleBulkArchive}
              disabled={bulkWorking}
              className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 text-xs font-medium"
            >
              {bulkWorking ? "..." : "Archive selected"}
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {canBulkAction && (
                <th className="px-4 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-slate-300"
                  />
                </th>
              )}
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
                <td colSpan={colCount}
                  className="px-4 py-8 text-center text-sm text-slate-400">
                  No expenses match the current filters
                </td>
              </tr>
            )}
            {expenses.map((e) => {
              const isSelected = selected.has(e.id);
              return (
                <tr
                  key={e.id}
                  className={`border-b border-slate-50 hover:bg-slate-50 ${
                    isSelected ? "bg-blue-50" :
                    e.isDuplicate ? "bg-red-50" : e.isPossibleDup ? "bg-amber-50" : ""
                  }`}
                >
                  {canBulkAction && (
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(e.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                  )}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
