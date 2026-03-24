"use client";

import { format } from "date-fns";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import DeleteEstimateButton from "@/components/clients/DeleteEstimateButton";
import EditEstimateModal from "@/components/clients/EditEstimateModal";
import SendEstimateEmailButton from "@/components/clients/SendEstimateEmailButton";

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
}: {
  est: EstimateRow;
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const createdStr = new Date(est.createdAt).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  const sentStr = est.lastSentAt ? new Date(est.lastSentAt).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }) : null;

  const statusBadge = est.counterSignedAt ? (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "#0d2318", color: "#22c55e", border: "1px solid #22c55e" }}>
      ✓ Countersigned
    </span>
  ) : est.signedAt ? (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background: "#0d2318", color: "#22c55e", border: "1px solid #22c55e" }}>
      ✓ Signed
    </span>
  ) : null;

  const summary = (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 min-w-0">
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
  );

  return (
    <CollapsibleCard summary={summary}>
      <div className="pt-3 space-y-3">
        {/* Dates */}
        <div className="space-y-0.5">
          <p className="text-xs" style={{ color: "#8b949e" }}>Created: {createdStr} ET</p>
          {sentStr && <p className="text-xs" style={{ color: "#4a9eff" }}>Sent: {sentStr} ET</p>}
          {est.counterSignedAt && (
            <p className="text-xs" style={{ color: "#22c55e" }}>
              Countersigned: {format(new Date(est.counterSignedAt), "MMM d, yyyy")}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/${companyId}/estimates/${est.id}`}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-center"
            style={{ background: "#C9A84C", color: "#0d1117", textDecoration: "none" }}
          >
            Open →
          </a>
          <a
            href={`/api/${companyId}/estimates/${est.id}/pdf?cover=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44", textDecoration: "none" }}
          >
            ↓ PDF
          </a>
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
        </div>
        <div className="flex flex-wrap gap-2">
          <SendEstimateEmailButton
            templateId={est.id}
            companyId={companyId}
            templateName={est.name}
            clientName={clientName}
            clientEmail={clientEmail}
            estimateNumber={est.estimateNumber}
            description={est.description}
            clientAddress={clientAddress}
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
    </CollapsibleCard>
  );
}

export default function CollapsibleEstimateList({
  estimates, companyId, clientId, clientName, clientEmail, clientAddress, canEdit, canDelete,
}: {
  estimates: EstimateRow[];
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  canEdit: boolean;
  canDelete: boolean;
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
          />
        ))}
      </div>
    </div>
  );
}
