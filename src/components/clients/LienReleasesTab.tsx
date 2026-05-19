"use client";

import { useState, useTransition } from "react";

const GOLD = "#C9A84C";
const INPUT = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", borderRadius: 6, padding: "6px 10px", fontSize: 13, width: "100%" } as const;

type LienRelease = {
  id: string;
  type: "PARTIAL" | "FINAL";
  subName: string;
  recipientEmail: string | null;
  amount: string | null;
  throughDate: string | null;
  legalDescription: string;
  signatureToken: string | null;
  signedAt: string | null;
  signedByName: string | null;
  emailSentAt: string | null;
  createdAt: string;
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LienReleasesTab({
  companyId,
  clientId,
  initialReleases,
}: {
  companyId: string;
  clientId: string;
  initialReleases: LienRelease[];
}) {
  const [releases, setReleases] = useState<LienRelease[]>(initialReleases);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();

  // Form state
  const [type, setType] = useState<"PARTIAL" | "FINAL">("PARTIAL");
  const [subName, setSubName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [throughDate, setThroughDate] = useState("");
  const [legalDescription, setLegalDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Send email state
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendName, setSendName] = useState("");
  const [sendingReq, setSendingReq] = useState(false);


  async function handleCreate() {
    if (!subName.trim() || !legalDescription.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/lien-releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, subName: subName.trim(), recipientEmail: recipientEmail.trim() || null, amount: amount.trim() || null, throughDate: throughDate || null, legalDescription: legalDescription.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setReleases(prev => [{ ...data, emailSentAt: null }, ...prev]);
        setShowForm(false);
        setSubName(""); setRecipientEmail(""); setAmount(""); setThroughDate(""); setLegalDescription("");
      }
    } finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lien release?")) return;
    startTransition(async () => {
      await fetch(`/api/${companyId}/clients/${clientId}/lien-releases`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setReleases(prev => prev.filter(r => r.id !== id));
    });
  }

  async function handleSend(r: LienRelease) {
    if (!sendEmail.trim()) return;
    setSendingReq(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/lien-releases/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, recipientEmail: sendEmail.trim(), recipientName: sendName.trim() || null }),
      });
      if (res.ok) {
        setReleases(prev => prev.map(x => x.id === r.id ? { ...x, emailSentAt: new Date().toISOString(), recipientEmail: sendEmail.trim() } : x));
        setSendingId(null); setSendEmail(""); setSendName("");
      }
    } finally { setSendingReq(false); }
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Release of Liens</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="text-xs font-semibold px-4 py-2 rounded-lg"
          style={{ background: GOLD, color: "#0d1117" }}>
          {showForm ? "Cancel" : "+ New Release"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          <h3 className="text-sm font-semibold" style={{ color: GOLD }}>New Lien Release</h3>

          {/* Type */}
          <div className="flex gap-3">
            {(["PARTIAL", "FINAL"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={type === t
                  ? { background: GOLD, color: "#0d1117", borderColor: GOLD }
                  : { background: "transparent", color: "#8b949e", borderColor: "#30373f" }}>
                {t === "PARTIAL" ? "Partial Release" : "Final Release"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Subcontractor / Lienor Name *</label>
              <input style={INPUT} value={subName} onChange={e => setSubName(e.target.value)} placeholder="Company or individual name" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Recipient Email</label>
              <input style={INPUT} type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Amount (consideration)</label>
              <input style={INPUT} value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10.00" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Through Date</label>
              <input style={INPUT} type="date" value={throughDate} onChange={e => setThroughDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Legal Description *</label>
            <textarea
              style={{ ...INPUT, minHeight: 120, resize: "vertical", fontFamily: "monospace" }}
              value={legalDescription}
              onChange={e => setLegalDescription(e.target.value)}
              placeholder={"BAL HARBOUR RES SEC PB 44-98\nLOT 12 BLK 4\n..."}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={creating || !subName.trim() || !legalDescription.trim()}
              className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ background: GOLD, color: "#0d1117" }}>
              {creating ? "Creating…" : "Create Release"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-sm"
              style={{ color: "#8b949e", border: "1px solid #30373f" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {releases.length === 0 && !showForm ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <p className="text-sm" style={{ color: "#8b949e" }}>No lien releases yet. Click &ldquo;+ New Release&rdquo; to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map(r => (
            <div key={r.id} className="rounded-xl p-4 space-y-3" style={{ background: "#1e2736", border: "1px solid #30373f" }}>

              {/* Row 1: title + badges */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: r.type === "PARTIAL" ? "#1e3a5f" : "#0d2318", color: r.type === "PARTIAL" ? "#60a5fa" : "#22c55e" }}>
                      {r.type}
                    </span>
                    {r.signedAt && (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#0d2318", color: "#22c55e" }}>
                        ✓ Signed {fmt(r.signedAt)}
                      </span>
                    )}
                    {!r.signedAt && r.emailSentAt && (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1e2736", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                        Sent — awaiting signature
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{r.subName}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                    {r.amount && `$${r.amount}`}
                    {r.amount && r.throughDate && " · "}
                    {r.throughDate && `Through ${fmt(r.throughDate)}`}
                    {(r.amount || r.throughDate) && " · "}
                    Created {fmt(r.createdAt)}
                  </p>
                  {r.signedByName && (
                    <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>Signed by: {r.signedByName}</p>
                  )}
                  {r.emailSentAt && r.recipientEmail && (
                    <p className="text-xs mt-0.5" style={{ color: "#22c55e" }}>
                      ✓ Sent to {r.recipientEmail}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <a href={`/api/${companyId}/lien-releases/${r.id}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-center"
                    style={{ background: "#0d1117", color: GOLD, border: `1px solid ${GOLD}44` }}>
                    📄 Preview PDF
                  </a>
                  {!r.signedAt && (
                    <button onClick={() => { setSendingId(sendingId === r.id ? null : r.id); setSendEmail(r.recipientEmail ?? ""); setSendName(r.subName); }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #60a5fa44" }}>
                      ✉ Send to Sign
                    </button>
                  )}
                  {r.signedAt && (
                    <a href={`/api/${companyId}/lien-releases/${r.id}/pdf`} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-center"
                      style={{ background: "#0d2318", color: "#22c55e", border: "1px solid #22c55e44" }}>
                      ⬇ Download
                    </a>
                  )}
                  <button onClick={() => handleDelete(r.id)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: "#8b949e", border: "1px solid #30373f" }}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Send form (inline) */}
              {sendingId === r.id && (
                <div className="rounded-lg p-3 space-y-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                  <p className="text-xs font-semibold" style={{ color: "#8b949e" }}>Send signing link via email</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Name</label>
                      <input style={INPUT} value={sendName} onChange={e => setSendName(e.target.value)} placeholder="Recipient name" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email *</label>
                      <input style={INPUT} type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="email@example.com" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSend(r)} disabled={sendingReq || !sendEmail.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ background: GOLD, color: "#0d1117" }}>
                      {sendingReq ? "Sending…" : "Send Email"}
                    </button>
                    <button onClick={() => setSendingId(null)} className="px-4 py-1.5 rounded-lg text-xs"
                      style={{ color: "#8b949e", border: "1px solid #30373f" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
