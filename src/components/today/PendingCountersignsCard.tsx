"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CountersignModal from "@/components/estimates/CountersignModal";

type PendingEstimate = {
  id: string;
  name: string;
  estimateNumber: string | null;
  signedAt: string;
  signedByName: string | null;
  clientName: string | null;
  clientId: string | null;
};

export default function PendingCountersignsCard({
  companyId,
  initialEstimates,
}: {
  companyId: string;
  initialEstimates: PendingEstimate[];
}) {
  const router = useRouter();
  const [estimates, setEstimates] = useState<PendingEstimate[]>(initialEstimates);
  const [signingId, setSigningId] = useState<string | null>(null);

  const signingEst = estimates.find(e => e.id === signingId) ?? null;

  function handleDone() {
    setEstimates(prev => prev.filter(e => e.id !== signingId));
    setSigningId(null);
    router.refresh();
  }

  return (
    <>
      <div
        className="rounded-xl p-5 flex flex-col gap-3"
        style={{ background: "#161b22", border: `1px solid ${estimates.length > 0 ? "#22c55e55" : "#30373f"}` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#C9A84C" }}>
            Pending Countersignatures
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ background: estimates.length > 0 ? "#22c55e" : "#30373f", color: estimates.length > 0 ? "#0d1117" : "#8b949e" }}
          >
            {estimates.length}
          </span>
        </div>
        <div className="text-[26px] sm:text-3xl font-black leading-none" style={{ color: "#e6edf3" }}>{estimates.length}</div>

        {estimates.length === 0 ? (
          <p className="text-xs" style={{ color: "#8b949e" }}>No estimates awaiting countersignature.</p>
        ) : (
          <ul className="space-y-3">
            {estimates.map((est) => (
              <li key={est.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium" style={{ color: "#e6edf3" }}>
                    {est.estimateNumber ? `#${est.estimateNumber}` : est.name}
                  </div>
                  {est.clientName && (
                    <div className="text-xs" style={{ color: "#8b949e" }}>{est.clientName}</div>
                  )}
                  {est.signedByName && (
                    <div className="text-xs" style={{ color: "#8b949e" }}>
                      Signed by {est.signedByName} · {new Date(est.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSigningId(est.id)}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}
                >
                  ✍️ Sign
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {signingEst && (
        <CountersignModal
          companyId={companyId}
          templateId={signingEst.id}
          estimateLabel={signingEst.estimateNumber ? `Estimate #${signingEst.estimateNumber} — ${signingEst.name}` : signingEst.name}
          clientName={signingEst.clientName}
          signedByName={signingEst.signedByName}
          signedAt={signingEst.signedAt}
          onDone={handleDone}
          onClose={() => setSigningId(null)}
        />
      )}
    </>
  );
}
