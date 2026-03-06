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
  const [success, setSuccess] = useState<string>("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptHash, setReceiptHash] = useState("");
  const [receiptName, setReceiptName] = useState("");

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setReceiptUrl(data.url);
      if (data.hash) setReceiptHash(data.hash);
      setReceiptName(file.name);
    } catch {
      setError("Receipt upload failed");
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const fd = new FormData(e.currentTarget);
    if (receiptUrl) fd.set("receiptUrl", receiptUrl);
    if (receiptHash) fd.set("receiptHash", receiptHash);
    try {
      const result = await addExpense(fd);
      formRef.current?.reset();
      setReceiptUrl("");
      setReceiptHash("");
      setReceiptName("");
      if (result.isDuplicate) {
        setSuccess("Expense added — flagged as exact duplicate.");
      } else if (result.isPossibleDup) {
        setSuccess("Expense added — flagged as possible duplicate (similar entry exists).");
      } else {
        setSuccess("Expense added!");
      }
      setTimeout(() => setSuccess(""), 4000);
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
        <input type="date" name="date" required
          defaultValue={new Date().toISOString().split("T")[0]}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
        <input type="text" name="vendor" required placeholder="e.g. Home Depot"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <input type="text" name="description" required placeholder="e.g. Lumber 2x4 studs"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Cost Code</label>
        <select name="costCodeId"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— None —</option>
          {costCodes.map((c) => (
            <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
        <select name="category" required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— Select —</option>
          {["Materials","Labor","Equipment","Subcontractor","Overhead","Other"].map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($)</label>
        <input type="number" name="amount" required min="0" step="0.01" placeholder="0.00"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tax ($)</label>
        <input type="number" name="tax" min="0" step="0.01" defaultValue="0"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
        <select name="paymentMethod" required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— Select —</option>
          {["Credit Card","Check","ACH","Cash","Wire"].map(m => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Paid By</label>
        <input type="text" name="paidBy" required placeholder="e.g. Mike Ross"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <input type="text" name="notes" placeholder="Optional notes"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Receipt</label>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*,application/pdf"
            onChange={handleReceiptUpload} disabled={uploadingReceipt}
            className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" />
          {uploadingReceipt && <span className="text-xs text-slate-400">Uploading...</span>}
          {receiptName && !uploadingReceipt && (
            <span className="text-xs text-green-600 font-medium">{receiptName} uploaded</span>
          )}
        </div>
        <input type="text" name="receiptUrl" value={receiptUrl}
          onChange={e => setReceiptUrl(e.target.value)}
          placeholder="Or paste receipt URL"
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
      <div className="col-span-4 flex items-center gap-3 pt-1">
        <button type="submit" disabled={loading || uploadingReceipt}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {loading ? "Adding..." : "Add Expense"}
        </button>
        {success && (
          <span className={`text-sm font-medium ${success.includes("duplicate") ? "text-amber-600" : "text-green-600"}`}>
            {success}
          </span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
