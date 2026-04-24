"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DeleteEstimateButton from "@/components/clients/DeleteEstimateButton";
import EditEstimateModal from "@/components/clients/EditEstimateModal";
import CoverPagePickerModal, { PdfOptions, Page2Type, CoverType, COVER_OPTIONS } from "@/components/clients/CoverPagePickerModal";

const MIKE_SIGNATURE = `Mike Baruh
Founder/CEO | MIBH Construction
Certified & Licensed General Contractor CGC 1527069
Certified & Licensed Roofer CCC 1336817

📱 Cell: 305.746.7307
📧 Email: mike@mibhconstruction.com
📍 Address: 2950 N 28 Terr, Hollywood, FL 33020
🌐 Website: www.mibhconstruction.com
📸 Instagram: @mibh_construction`;

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
  isCommercial, clientCoverPhotoType, clientCoverPhotoUrl, hasInsertFile,
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
  clientCoverPhotoType?: string | null;
  clientCoverPhotoUrl?: string | null;
  hasInsertFile?: boolean;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [step, setStep] = useState<"cover" | "email" | null>(null);
  const [pdfOpts, setPdfOpts] = useState<PdfOptions | null>(null);

  // Email compose state
  const firstName = clientName.split(" ")[0];
  const scope = est.description || est.name;
  const subjectParts = ["Estimate"];
  if (est.estimateNumber) subjectParts.push(`#${est.estimateNumber}`);
  subjectParts.push(`for ${clientName}`);
  if (scope) subjectParts.push(`– ${scope}`);
  if (clientAddress) subjectParts.push(`at ${clientAddress}`);

  const [to, setTo] = useState(clientEmail ?? "");
  const [cc, setCc] = useState("mikebaruh@gmail.com");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(subjectParts.join(" "));
  const [body, setBody] = useState(`Dear ${firstName},\n\nPlease find attached your estimate for the project.\n\nDo not hesitate to contact us with any questions.\n\n${MIKE_SIGNATURE}`);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

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

  const n = est.name.toLowerCase();
  const initialPage2: Page2Type = n.includes("retail") ? "RETAIL" : n.includes("roof") ? "ROOF" : n.includes("addition") ? "ADDITION" : "NONE";

  function buildPdfUrl(opts: PdfOptions, preview = false) {
    const base = `/api/${companyId}/estimates/${est.id}/pdf?cover=1&coverType=${opts.coverType}&page2=${opts.page2}&includeInsert=${opts.includeInsert ? 1 : 0}&divSummary=${opts.includeDivisionSummary ? 1 : 0}&forcedBreakCsi=${opts.forcedBreakCsiPrefixes.join(",")}${preview ? "&preview=1" : ""}`;
    if (opts.coverType === "CUSTOM" && opts.coverBlobUrl) {
      return `${base}&coverBlobUrl=${encodeURIComponent(opts.coverBlobUrl)}`;
    }
    return base;
  }

  function handlePdfConfirm(opts: PdfOptions) {
    setStep(null);
    window.open(buildPdfUrl(opts), "_blank");
  }

  function handlePdfPreview(opts: PdfOptions) {
    window.open(buildPdfUrl(opts, true), "_blank");
  }

  function handleSendEmail(opts: PdfOptions) {
    setPdfOpts(opts);
    setResult(null);
    setStep("email");
  }

  async function send() {
    if (!to || !pdfOpts) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/${companyId}/send-estimate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: est.id,
          to,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject,
          body,
          coverType: pdfOpts.coverType,
          page2: pdfOpts.page2,
          includeInsert: pdfOpts.includeInsert,
        }),
      });
      const text = await res.text();
      let data: { error?: string; detail?: string } = {};
      try { data = JSON.parse(text); } catch { /* non-JSON */ }
      if (res.ok) {
        setResult({ ok: true, msg: "Email sent successfully!" });
        setTimeout(() => { setStep(null); setResult(null); }, 2000);
      } else {
        const msg = data.detail ? `${data.error}: ${data.detail}` : (data.error ?? `Server error ${res.status}`);
        setResult({ ok: false, msg });
      }
    } catch (err) {
      setResult({ ok: false, msg: `Request failed: ${String(err)}` });
    } finally {
      setSending(false);
    }
  }

  const selectedOption = COVER_OPTIONS.find(o => o.type === pdfOpts?.coverType);

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
              <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Created {createdStr} ET</div>
              {sentStr && <div className="text-xs" style={{ color: "#C9A84C88" }}>Last sent {sentStr} ET</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {statusBadge}
              <span className="font-bold text-sm" style={{ color: "#C9A84C" }}>${fmt(est.total)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setStep("cover")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
            >
              ↓ PDF / ✉ Send
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

      {/* PDF Options modal */}
      {step === "cover" && (
        <CoverPagePickerModal
          isCommercial={isCommercial}
          initialCoverType={(clientCoverPhotoType as CoverType) ?? undefined}
          customCoverUrl={clientCoverPhotoUrl}
          hasInsertFile={hasInsertFile}
          initialPage2={initialPage2}
          confirmLabel="Download PDF"
          showPreview
          companyId={companyId}
          clientId={clientId}
          onConfirm={handlePdfConfirm}
          onPreview={handlePdfPreview}
          onSendEmail={handleSendEmail}
          onClose={() => setStep(null)}
        />
      )}

      {/* Email compose modal */}
      {step === "email" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setStep(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>Send Estimate via Gmail</h2>
              <button onClick={() => setStep(null)} style={{ color: "#8b949e" }} className="text-xl leading-none">×</button>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b949e" }}>
                Sending: <span style={{ color: "#C9A84C" }}>{est.name}</span>
              </p>
              <button
                onClick={() => setStep("cover")}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
              >
                Cover: {selectedOption?.label ?? pdfOpts?.coverType}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>To</label>
                <input
                  type="email"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                  placeholder="client@email.com"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>CC</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={e => setCc(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="cc@email.com"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>BCC</label>
                  <input
                    type="text"
                    value={bcc}
                    onChange={e => setBcc(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                    placeholder="bcc@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Message</label>
                <textarea
                  rows={10}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", resize: "vertical" }}
                />
              </div>
            </div>

            {result && (
              <p className="text-sm font-medium" style={{ color: result.ok ? "#22c55e" : "#ef4444" }}>
                {result.msg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={send}
                disabled={sending || !to}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-opacity"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {sending ? "Sending…" : "Send Email + PDF"}
              </button>
              <button
                onClick={() => setStep(null)}
                className="px-5 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: "#30373f", color: "#e6edf3" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CollapsibleEstimateList({
  estimates, companyId, clientId, clientName, clientEmail, clientAddress, canEdit, canDelete,
  isCommercial, clientCoverPhotoType, clientCoverPhotoUrl, hasInsertFile,
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
  clientCoverPhotoType?: string | null;
  clientCoverPhotoUrl?: string | null;
  hasInsertFile?: boolean;
}) {
  if (estimates.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center space-y-3" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
        <p className="text-sm" style={{ color: "#8b949e" }}>No estimates yet.</p>
        {canEdit && (
          <a
            href={`/${companyId}/estimates`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#C9A84C", color: "#0d1117" }}
          >
            + New estimate
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Estimates</h2>
        <div className="flex items-center gap-3">
          {canEdit && (
            <a
              href={`/${companyId}/estimates`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              + New estimate
            </a>
          )}
          <span className="text-sm" style={{ color: "#8b949e" }}>{estimates.length} estimate{estimates.length !== 1 ? "s" : ""}</span>
        </div>
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
            clientCoverPhotoType={clientCoverPhotoType}
            clientCoverPhotoUrl={clientCoverPhotoUrl}
            hasInsertFile={hasInsertFile}
          />
        ))}
      </div>
    </div>
  );
}
