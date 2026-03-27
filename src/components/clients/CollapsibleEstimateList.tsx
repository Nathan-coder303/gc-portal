"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DeleteEstimateButton from "@/components/clients/DeleteEstimateButton";
import EditEstimateModal from "@/components/clients/EditEstimateModal";
import SendEstimateEmailButton from "@/components/clients/SendEstimateEmailButton";
import CoverPagePickerModal, { CoverType } from "@/components/clients/CoverPagePickerModal";

type EstimateRow = {
  id: string;
  name: string;
  estimateNumber: string | null;
  description: string | null;
  estimateDate: string | null;
  sqFt: number | null;
  durationMonths: number | null;
  hasSkylights: boolean | null;
  hasRoofDrains: boolean | null;
  createdAt: string;
  lastSentAt: string | null;
  signedAt: string | null;
  signedByName: string | null;
  counterSignedAt: string | null;
  total: number;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function EstimateCard({
  est, companyId, clientId, clientName, clientEmail, clientAddress, canEdit, canDelete,
  isCommercial, clientCoverPhotoUrl,
}: {
  est: EstimateRow;
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  canEdit: boolean;
  canDelete: boolean;
  isCommercial?: boolean;
  clientCoverPhotoUrl?: string | null;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const createdStr = new Date(est.createdAt).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  const sentStr = est.lastSentAt ? new Date(est.lastSentAt).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }) : null;

  const statusBadge = est.counterSignedAt ? (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#0d2318", color: "#22c55e", border: "1px solid #22c55e" }}>
      ✓ Countersigned
    </span>
  ) : est.signedAt ? (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#0d2318", color: "#22c55e", border: "1px solid #22c55e" }}>
      ✓ Signed
    </span>
  ) : null;

  function handlePdfConfirm(coverType: CoverType) {
    setShowCoverPicker(false);
    window.open(`/api/${companyId}/estimates/${est.id}/pdf?cover=1&coverType=${coverType}`, "_blank");
  }

  return (
    <>
      <div
        className="rounded-xl cursor-pointer transition-all"
        style={{ background: "#1e2736", border: `1px solid ${hovered ? "#C9A84C" : "#30373f"}` }}
        onClick={() => router.push(`/${companyId}/estimates/${est.id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="px-5 py-4">
          {/* Top row: name + total */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: "#e6edf3" }}>{est.name}</span>
                {est.estimateNumber && <span className="text-xs" style={{ color: "#8b949e" }}>#{est.estimateNumber}</span>}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                {sentStr ? `Sent ${sentStr} ET` : `Created ${createdStr} ET`}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {statusBadge}
              <span className="font-bold text-sm" style={{ color: "#C9A84C" }}>${fmt(est.total)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowCoverPicker(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
            >
              ↓ PDF
            </button>
            {est.counterSignedAt && (
              <a
                href={`/api/${companyId}/estimates/${est.id}/pdf?countersigned=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "#0d231822", color: "#22c55e", border: "1px solid #22c55e55", textDecoration: "none" }}
              >
                ↓ Signed PDF
              </a>
            )}
            <SendEstimateEmailButton
              templateId={est.id}
              companyId={companyId}
              templateName={est.name}
              clientName={clientName}
              clientEmail={clientEmail}
              estimateNumber={est.estimateNumber}
              description={est.description}
              clientAddress={clientAddress}
              isCommercial={isCommercial}
              clientCoverPhotoUrl={clientCoverPhotoUrl}
            />
            {canEdit && (
              <EditEstimateModal
                estimateId={est.id}
                clientId={clientId}
                companyId={companyId}
                initialName={est.name}
                initialDescription={est.description}
                initialEstimateNumber={est.estimateNumber}
                initialEstimateDate={est.estimateDate}
                initialSqFt={est.sqFt}
                initialDurationMonths={est.durationMonths}
                initialHasSkylights={est.hasSkylights}
                initialHasRoofDrains={est.hasRoofDrains}
              />
            )}
            {canDelete && (
              <DeleteEstimateButton estimateId={est.id} clientId={clientId} companyId={companyId} />
            )}
          </div>
        </div>
      </div>

      {showCoverPicker && (
        <CoverPagePickerModal
          isCommercial={isCommercial}
          customCoverUrl={clientCoverPhotoUrl}
          confirmLabel="Download PDF"
          onConfirm={handlePdfConfirm}
          onClose={() => setShowCoverPicker(false)}
        />
      )}
    </>
  );
}

export default function CollapsibleEstimateList({
  estimates, companyId, clientId, clientName, clientEmail, clientAddress, canEdit, canDelete,
  isCommercial, clientCoverPhotoUrl,
}: {
  estimates: EstimateRow[];
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  canEdit: boolean;
  canDelete: boolean;
  isCommercial?: boolean;
  clientCoverPhotoUrl?: string | null;
}) {
  if (estimates.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
        <p className="text-sm" style={{ color: "#8b949e" }}>No estimates yet.</p>
        <p className="text-xs mt-1" style={{ color: "#8b949e" }}>Open a template and use &quot;Save to Client&quot; to create one.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Estimates</h2>
        <span className="text-sm" style={{ color: "#8b949e" }}>{estimates.length} estimate{estimates.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2">
        {estimates.map(est => (
          <EstimateCard
            key={est.id}
            est={est}
            companyId={companyId}
            clientId={clientId}
            clientName={clientName}
            clientEmail={clientEmail}
            clientAddress={clientAddress}
            canEdit={canEdit}
            canDelete={canDelete}
            isCommercial={isCommercial}
            clientCoverPhotoUrl={clientCoverPhotoUrl}
          />
        ))}
      </div>
    </div>
  );
}
