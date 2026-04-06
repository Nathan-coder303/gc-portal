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

export default function CountersignAlert({
  companyId,
  estimates: initialEstimates,
}: {
  companyId: string;
  estimates: PendingEstimate[];
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(initialEstimates);
  const [signingId, setSigningId] = useState<string | null>(null);

  const signingEst = remaining.find(e => e.id === signingId) ?? null;

  if (remaining.length === 0) return null;

  function handleDone() {
    setRemaining(prev => prev.filter(e => e.id !== signingId));
    setSigningId(null);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setSigningId(remaining[0].id)}
        className="w-full flex items-center gap-3 mb-3 px-4 py-3 rounded-xl text-left transition-opacity hover:opacity-90"
        style={{ background: "#1a2a1a", border: "1px solid #22c55e55" }}
      >
        <span style={{ fontSize: 18 }}>✍️</span>
        <div className="flex-1">
          <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
            {remaining.length} estimate{remaining.length > 1 ? "s" : ""} awaiting your countersignature
          </span>
          <span className="text-xs ml-2" style={{ color: "#8b949e" }}>
            {remaining.map(e => e.estimateNumber ? `#${e.estimateNumber}` : e.name).join(", ")}
          </span>
        </div>
        <span className="text-xs font-semibold shrink-0" style={{ color: "#22c55e" }}>Tap to sign →</span>
      </button>

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
