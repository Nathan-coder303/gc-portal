"use client";

import { useState, useTransition } from "react";
import { updateClientEstimate } from "@/app/[companyId]/clients/actions";

export default function EditEstimateModal({
  estimateId,
  clientId,
  companyId,
  initialName,
  initialDescription,
  initialEstimateNumber,
  initialEstimateDate,
  initialSqFt,
  initialDurationMonths,
}: {
  estimateId: string;
  clientId: string;
  companyId: string;
  initialName: string;
  initialDescription: string | null;
  initialEstimateNumber: string | null;
  initialEstimateDate: string | null;
  initialSqFt: number | null;
  initialDurationMonths: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [estimateNumber, setEstimateNumber] = useState(initialEstimateNumber ?? "");
  const todayIso = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD"
  const [estimateDate, setEstimateDate] = useState(initialEstimateDate ?? todayIso);
  const [sqFt, setSqFt] = useState(initialSqFt?.toString() ?? "");
  const [durationMonths, setDurationMonths] = useState(initialDurationMonths?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setName(initialName);
    setDescription(initialDescription ?? "");
    setEstimateNumber(initialEstimateNumber ?? "");
    setEstimateDate(initialEstimateDate ?? "");
    setSqFt(initialSqFt?.toString() ?? "");
    setDurationMonths(initialDurationMonths?.toString() ?? "");
    setOpen(true);
  }

  function handleSave() {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateClientEstimate(estimateId, clientId, companyId, {
        name,
        description: description || null,
        estimateNumber: estimateNumber || null,
        estimateDate: estimateDate || null,
        sqFt: sqFt ? Number(sqFt) : null,
        durationMonths: durationMonths ? Number(durationMonths) : null,
      });
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs px-2 py-1 rounded"
        style={{ color: "#C9A84C", border: "1px solid #C9A84C44" }}
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md mx-4"
            style={{ background: "#1e2736", border: "1px solid #30373f" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Edit Estimate</h2>
              <button onClick={() => setOpen(false)} className="text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded px-3 py-2 text-sm outline-none"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Estimate #</label>
                  <input
                    value={estimateNumber}
                    onChange={(e) => setEstimateNumber(e.target.value)}
                    className="w-full rounded px-3 py-2 text-sm outline-none"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Estimate Date</label>
                  <input
                    type="date"
                    value={estimateDate}
                    onChange={(e) => setEstimateDate(e.target.value)}
                    className="w-full rounded px-3 py-2 text-sm outline-none"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", colorScheme: "dark" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Sq Ft</label>
                  <input
                    type="number"
                    min={0}
                    value={sqFt}
                    onChange={(e) => setSqFt(e.target.value)}
                    className="w-full rounded px-3 py-2 text-sm outline-none"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Duration (months)</label>
                  <input
                    type="number"
                    min={0}
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full rounded px-3 py-2 text-sm outline-none"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="text-sm px-4 py-2 rounded"
                style={{ color: "#8b949e", border: "1px solid #30373f" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !name.trim()}
                className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
