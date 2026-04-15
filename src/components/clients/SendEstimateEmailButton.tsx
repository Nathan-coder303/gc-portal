"use client";

import { useState } from "react";
import CoverPagePickerModal, { CoverType, COVER_OPTIONS, PdfOptions, Page2Type } from "@/components/clients/CoverPagePickerModal";


const MIKE_SIGNATURE = `Mike Baruh
Founder/CEO | MIBH Construction
Certified & Licensed General Contractor CGC 1527069
Certified & Licensed Roofer CCC 1336817

📱 Cell: 305.746.7307
📧 Email: mike@mibhconstruction.com
📍 Address: 2950 N 28 Terr, Hollywood, FL 33020
🌐 Website: www.mibhconstruction.com
📸 Instagram: @mibh_construction`;

type Props = {
  templateId: string;
  companyId: string;
  templateName: string;
  clientName: string;
  clientEmail: string | null;
  estimateNumber?: string | null;
  description?: string | null;
  clientAddress?: string | null;
  isCommercial?: boolean;
  clientCoverPhotoType?: string | null;
  clientCoverPhotoUrl?: string | null;
  clientCoverTitle?: string | null;
  hasInsertFile?: boolean;
};

export default function SendEstimateEmailButton({ templateId, companyId, templateName, clientName, clientEmail, estimateNumber, description, clientAddress, isCommercial, clientCoverPhotoType, clientCoverPhotoUrl, clientCoverTitle, hasInsertFile }: Props) {
  const firstName = clientName.split(" ")[0];
  const defaultBody = `Dear ${firstName},\n\nPlease find attached your estimate for the project.\n\nDo not hesitate to contact us with any questions.\n\n${MIKE_SIGNATURE}`;

  const scope = description || templateName;
  const subjectParts = ["Estimate"];
  if (estimateNumber) subjectParts.push(`#${estimateNumber}`);
  subjectParts.push("from MIBH CONSTRUCTION");
  if (scope) subjectParts.push(`for ${scope}`);
  if (clientAddress) subjectParts.push(`at ${clientAddress}`);
  const defaultSubject = subjectParts.join(" ");

  const defaultCover: CoverType = (clientCoverPhotoType as CoverType) ?? (isCommercial ? "ADDITIONS" : "FLAT_ROOFS");

  const n = templateName.toLowerCase();
  const defaultPage2: Page2Type = n.includes("retail") ? "RETAIL" : n.includes("roof") ? "ROOF" : n.includes("addition") ? "ADDITION" : "NONE";

  const [step, setStep] = useState<"cover" | "email" | null>(null);
  const [coverType, setCoverType] = useState<CoverType>(defaultCover);
  const [page2, setPage2] = useState<Page2Type>(defaultPage2);
  const [includeInsert, setIncludeInsert] = useState(true);
  const [to, setTo] = useState(clientEmail ?? "");
  const [cc, setCc] = useState("mikebaruh@gmail.com");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function openCoverPicker() {
    setCoverType(defaultCover);
    setResult(null);
    setStep("cover");
  }

  function handleCoverConfirm(opts: PdfOptions) {
    setCoverType(opts.coverType);
    setPage2(opts.page2);
    setIncludeInsert(opts.includeInsert);
    setStep("email");
  }

  async function send() {
    if (!to) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/${companyId}/send-estimate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, to, cc: cc.trim() || undefined, bcc: bcc.trim() || undefined, subject, body, coverType, page2, includeInsert }),
      });
      const text = await res.text();
      let data: { error?: string; detail?: string } = {};
      try { data = JSON.parse(text); } catch { /* non-JSON response */ }
      if (res.ok) {
        setResult({ ok: true, msg: "Email sent successfully!" });
        setTimeout(() => { setStep(null); setResult(null); }, 2000);
      } else {
        const msg = data.detail ? `${data.error}: ${data.detail}` : (data.error ?? `Server error ${res.status}`);
        setResult({ ok: false, msg });
        console.error("send-estimate-email error:", res.status, text.slice(0, 500));
      }
    } catch (err) {
      setResult({ ok: false, msg: `Request failed: ${String(err)}` });
    } finally {
      setSending(false);
    }
  }

  const selectedOption = COVER_OPTIONS.find(o => o.type === coverType);

  return (
    <>
      <button
        onClick={openCoverPicker}
        className="text-xs px-2 py-1 rounded-lg font-medium transition-colors"
        style={{ background: "#1a2436", border: "1px solid #30373f", color: "#8b949e" }}
        title="Send estimate via email"
      >
        ✉ Send
      </button>

      {step === "cover" && (
        <CoverPagePickerModal
          isCommercial={isCommercial}
          initialCoverType={defaultCover}
          customCoverUrl={clientCoverPhotoUrl}
          hasInsertFile={hasInsertFile}
          initialPage2={defaultPage2}
          confirmLabel="Next: Write Email →"
          onConfirm={handleCoverConfirm}
          onClose={() => setStep(null)}
        />
      )}

      {step === "email" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>Send Estimate via Gmail</h2>
              <button onClick={() => setStep(null)} style={{ color: "#8b949e" }} className="text-xl leading-none">×</button>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b949e" }}>
                Sending: <span style={{ color: "#C9A84C" }}>{templateName}</span>
              </p>
              <button
                onClick={() => setStep("cover")}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
              >
                Cover: {selectedOption?.label ?? coverType}
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
