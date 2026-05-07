"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportedBid = {
  contractorName: string;
  projectName: string | null;
  amount: number | null;
  division: string;
};

function fmtAmount(n: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function BidsModal({ bids, onClose }: { bids: ImportedBid[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        style={{ background: "#161b22", border: "1px solid #30373f" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #30373f" }}>
          <h2 className="font-semibold text-sm" style={{ color: "#e6edf3" }}>
            Imported Bids ({bids.length})
          </h2>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {bids.map((b, i) => (
            <div
              key={i}
              className="rounded-xl px-4 py-3 flex items-start justify-between gap-3"
              style={{ background: "#1e2736", border: "1px solid #30373f" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#e6edf3" }}>{b.contractorName}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: "#8b949e" }}>
                  {b.projectName ?? "Unmatched"} · {b.division}
                </p>
              </div>
              <span className="text-sm font-semibold shrink-0" style={{ color: b.amount ? "#22c55e" : "#8b949e" }}>
                {fmtAmount(b.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SyncBidsButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [result, setResult] = useState("");
  const [importedBids, setImportedBids] = useState<ImportedBid[]>([]);
  const [showModal, setShowModal] = useState(false);

  async function sync() {
    setStatus("syncing");
    setResult("Starting…");
    setImportedBids([]);
    let totalAdded = 0;
    let totalNotBid = 0;
    let totalNoClient = 0;
    const allBids: ImportedBid[] = [];
    let round = 0;

    try {
      while (round < 15) {
        round++;
        const res = await fetch(`/api/${companyId}/sync-starred-bids`, { method: "POST" });
        const text = await res.text();
        let data: { error?: string; added?: number; notBid?: number; triage?: number; remaining?: number; importedBids?: ImportedBid[] };
        try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 200)}`); }
        if (!res.ok) throw new Error([data.error, (data as Record<string,unknown>).detail].filter(Boolean).join(": "));

        totalAdded += data.added ?? 0;
        totalNotBid += data.notBid ?? 0;
        totalNoClient += data.triage ?? 0;
        if (data.importedBids?.length) allBids.push(...data.importedBids);

        const remaining = data.remaining ?? 0;
        setResult(
          `Round ${round}: ${totalAdded} bids saved · ${totalNoClient} unmatched · ${totalNotBid} not bids · ${remaining} left…`
        );

        if (remaining === 0) break;
        if ((data.added ?? 0) === 0 && (data.triage ?? 0) === 0 && (data.notBid ?? 0) > 0) break;
      }

      setImportedBids(allBids);

      if (totalAdded > 0) {
        setResult(`Done: +${totalAdded} bids imported · ${totalNoClient} unmatched · ${totalNotBid} not bids`);
        router.refresh();
      } else {
        setResult(
          totalNoClient > 0
            ? `0 bids saved — ${totalNoClient} emails found but couldn't match to a client. ${totalNotBid} were not bids.`
            : `No new bids found (${totalNotBid} emails were not bids)`
        );
      }
      setStatus("done");
    } catch (e) {
      setResult(String(e));
      setStatus("error");
    }
  }

  const color = status === "error" ? "#f85149" : status === "done" && result.startsWith("0") ? "#f0a500" : "#22c55e";

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={sync}
          disabled={status === "syncing"}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50 whitespace-nowrap"
          style={{ background: "#0d2318", border: "1px solid #22c55e", color: "#22c55e" }}
          title={result || "Pulls bids from PlanHub notifications + starred emails in Gmail"}
        >
          {status === "syncing" ? "Syncing…" : "⭐ Sync All Bids"}
        </button>
        {result && (
          <span className="text-xs text-right" style={{ color, maxWidth: 240 }}>
            {status === "done" && importedBids.length > 0 ? (
              <>
                Done:{" "}
                <button
                  onClick={() => setShowModal(true)}
                  className="underline font-semibold"
                  style={{ color }}
                >
                  +{importedBids.length} bids
                </button>
                {result.replace(/^Done: \+\d+ bids/, "")}
              </>
            ) : (
              <span className="truncate block max-w-[220px]" title={result}>{result}</span>
            )}
          </span>
        )}
      </div>
      {showModal && <BidsModal bids={importedBids} onClose={() => setShowModal(false)} />}
    </>
  );
}
