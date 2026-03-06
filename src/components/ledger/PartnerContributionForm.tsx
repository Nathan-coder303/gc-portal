"use client";

import { useRef, useState } from "react";
import { addPartnerContribution } from "@/app/[companyId]/[projectId]/ledger/actions";

type Partner = { id: string; name: string };

export default function PartnerContributionForm({
  projectId,
  partners,
}: {
  projectId: string;
  partners: Partner[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await addPartnerContribution(fd);
      formRef.current?.reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Partner</label>
        <select
          name="partnerId"
          required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select Partner —</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
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
        <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($)</label>
        <input
          type="number"
          name="amount"
          required
          min="0.01"
          step="0.01"
          placeholder="0.00"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Adding..." : "Record Contribution"}
        </button>
        {success && <span className="text-sm text-green-600 font-medium">Recorded!</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
