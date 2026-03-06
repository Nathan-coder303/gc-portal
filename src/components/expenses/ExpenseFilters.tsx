"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type CostCode = { id: string; code: string; name: string };

export default function ExpenseFilters({ costCodes }: { costCodes: CostCode[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clear = () => router.push(pathname);

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" defaultValue={searchParams.get("from") ?? ""}
            onChange={e => set("from", e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" defaultValue={searchParams.get("to") ?? ""}
            onChange={e => set("to", e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Vendor</label>
          <input type="text" placeholder="Filter vendor…"
            defaultValue={searchParams.get("vendor") ?? ""}
            onChange={e => set("vendor", e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Cost Code</label>
          <select defaultValue={searchParams.get("costCode") ?? ""}
            onChange={e => set("costCode", e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All</option>
            {costCodes.map(c => (
              <option key={c.id} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
          <select defaultValue={searchParams.get("category") ?? ""}
            onChange={e => set("category", e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All</option>
            {["Materials","Labor","Equipment","Subcontractor","Overhead","Other"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Paid By</label>
          <input type="text" placeholder="Filter paid by…"
            defaultValue={searchParams.get("paidBy") ?? ""}
            onChange={e => set("paidBy", e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Flags</label>
          <select defaultValue={searchParams.get("flags") ?? ""}
            onChange={e => set("flags", e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All</option>
            <option value="dup">Duplicates</option>
            <option value="possibleDup">Possible Dups</option>
          </select>
        </div>
        {hasFilters && (
          <button onClick={clear}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
