"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export default function AssumptionControls({
  burn30d,
}: {
  burn30d: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [local, setLocal] = useState({
    burn: searchParams.get("burn") ?? "",
    contingency: searchParams.get("contingency") ?? "10",
    injection: searchParams.get("injection") ?? "0",
    horizon: searchParams.get("horizon") ?? "30",
  });

  const apply = useCallback(() => {
    const params = new URLSearchParams();
    if (local.burn && parseFloat(local.burn) > 0) params.set("burn", local.burn);
    if (local.contingency && local.contingency !== "10") params.set("contingency", local.contingency);
    if (local.injection && parseFloat(local.injection) > 0) params.set("injection", local.injection);
    if (local.horizon && local.horizon !== "30") params.set("horizon", local.horizon);
    router.push(`${pathname}?${params.toString()}`);
  }, [local, router, pathname]);

  const reset = () => {
    setLocal({ burn: "", contingency: "10", injection: "0", horizon: "30" });
    router.push(pathname);
  };

  const changed =
    local.burn !== (searchParams.get("burn") ?? "") ||
    local.contingency !== (searchParams.get("contingency") ?? "10") ||
    local.injection !== (searchParams.get("injection") ?? "0") ||
    local.horizon !== (searchParams.get("horizon") ?? "30");

  const inputCls = "border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-medium text-slate-700 text-sm">Projection Assumptions</h3>
        <span className="text-xs text-slate-400">Changes update the forecast below</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Burn Rate ($/day)
            <span className="ml-1 text-slate-400 font-normal">default: ${burn30d.toFixed(0)}/d</span>
          </label>
          <input
            type="number"
            min="0"
            step="10"
            placeholder={`${burn30d.toFixed(0)}`}
            value={local.burn}
            onChange={(e) => setLocal((p) => ({ ...p, burn: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Contingency %
          </label>
          <input
            type="number"
            min="0"
            max="50"
            step="1"
            value={local.contingency}
            onChange={(e) => setLocal((p) => ({ ...p, contingency: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Cash Injection ($)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={local.injection}
            onChange={(e) => setLocal((p) => ({ ...p, injection: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Horizon</label>
          <select
            value={local.horizon}
            onChange={(e) => setLocal((p) => ({ ...p, horizon: e.target.value }))}
            className={inputCls}
          >
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={apply}
          disabled={!changed}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-40"
        >
          Apply
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
}
