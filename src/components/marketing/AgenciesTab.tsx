"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Attachment = { id: string; name: string; url: string; size: number; mimeType: string };

type Agency = {
  id: string;
  name: string;
  contractStartDate: string;
  payAmount: number | string;
  payFrequency: string;
  upfrontFee: number | string | null;
  commitment: string | null;
  facebookFees: number | string | null;
  appointmentsBooked: number;
  adSpendAmount: number | string | null;
  adSpendSinceDate: string | null;
  expectedSaleValue: number | string | null;
  loginUrl: string | null;
  loginEmail: string | null;
  loginPassword: string | null;
  notes: string | null;
  attachments: string | null; // JSON
};

const FREQUENCIES = [
  { value: "MONTH",       label: "Per Month" },
  { value: "APPOINTMENT", label: "Per Appointment" },
  { value: "LEAD",        label: "Per Lead" },
  { value: "QUARTER",     label: "Per Quarter" },
  { value: "YEAR",        label: "Per Year" },
  { value: "FLAT",        label: "Flat / One-time" },
  { value: "OTHER",       label: "Other" },
];

function freqLabel(v: string): string {
  return FREQUENCIES.find(f => f.value === v)?.label ?? v;
}

function fmtMoney(n: number | string | null): string {
  if (n == null || n === "") return "—";
  const num = typeof n === "number" ? n : Number(n);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseAttachments(raw: string | null): Attachment[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as Attachment[]; } catch { return []; }
}

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

type FormState = {
  name: string;
  contractStartDate: string;
  payAmount: string;
  payFrequency: string;
  upfrontFee: string;
  commitment: string;
  facebookFees: string;
  appointmentsBooked: string;
  adSpendAmount: string;
  adSpendSinceDate: string;
  expectedSaleValue: string;
  loginUrl: string;
  loginEmail: string;
  loginPassword: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    contractStartDate: new Date().toISOString().slice(0, 10),
    payAmount: "",
    payFrequency: "MONTH",
    upfrontFee: "",
    commitment: "",
    facebookFees: "",
    appointmentsBooked: "",
    adSpendAmount: "",
    adSpendSinceDate: "",
    expectedSaleValue: "",
    loginUrl: "",
    loginEmail: "",
    loginPassword: "",
    notes: "",
  };
}

// Compute how much you currently owe the agency based on their pay model
function amountOwedToAgency(a: Agency): number {
  const upfront = a.upfrontFee != null ? Number(a.upfrontFee) : 0;
  const pay = Number(a.payAmount) || 0;
  const appts = a.appointmentsBooked ?? 0;
  if (a.payFrequency === "APPOINTMENT") return upfront + (pay * appts);
  if (a.payFrequency === "LEAD") return upfront + (pay * appts);
  // For monthly / quarter / year / flat / other → just the upfront so far
  // (recurring is tracked manually as it comes due).
  return upfront;
}

// ── Credentials display block (used on each agency card) ───────────────────
function CredentialsBlock({ url, email, password }: { url: string | null; email: string | null; password: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  if (!url && !email && !password) return null;

  function copy(label: string, value: string) {
    try {
      navigator.clipboard?.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* */ }
  }

  return (
    <div className="rounded-lg p-3" style={{ background: "#0c1219", border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: GOLD }}>🔑 Login Credentials</p>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-semibold px-2 py-1 rounded"
            style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}>
            Open ↗
          </a>
        )}
      </div>
      <div className="space-y-1.5 font-mono text-xs">
        {email && (
          <div className="flex items-center gap-2">
            <span style={{ color: MUTED, minWidth: 64 }}>Email</span>
            <button onClick={() => copy("email", email)} className="flex-1 text-left truncate" style={{ color: TEXT }}>
              {email}
            </button>
            <span className="text-[10px]" style={{ color: copied === "email" ? "#22c55e" : MUTED }}>
              {copied === "email" ? "✓ copied" : "tap to copy"}
            </span>
          </div>
        )}
        {password && (
          <div className="flex items-center gap-2">
            <span style={{ color: MUTED, minWidth: 64 }}>Password</span>
            <button onClick={() => copy("password", password)} className="flex-1 text-left truncate" style={{ color: TEXT }}>
              {revealed ? password : "•".repeat(Math.min(password.length, 16))}
            </button>
            <button onClick={() => setRevealed(r => !r)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#1e2736", color: MUTED, border: `1px solid ${BORDER}` }}>
              {revealed ? "Hide" : "Show"}
            </button>
            <span className="text-[10px]" style={{ color: copied === "password" ? "#22c55e" : MUTED }}>
              {copied === "password" ? "✓" : ""}
            </span>
          </div>
        )}
        {url && (
          <div className="flex items-center gap-2">
            <span style={{ color: MUTED, minWidth: 64 }}>URL</span>
            <button onClick={() => copy("url", url)} className="flex-1 text-left truncate" style={{ color: "#58a6ff", textDecoration: "underline" }}>
              {url}
            </button>
            <span className="text-[10px]" style={{ color: copied === "url" ? "#22c55e" : MUTED }}>
              {copied === "url" ? "✓" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentZone({
  companyId, agency, onUpdated,
}: {
  companyId: string;
  agency: Agency;
  onUpdated: (newAttachmentsJson: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachments = parseAttachments(agency.attachments);

  async function uploadFile(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/${companyId}/marketing/agencies/${agency.id}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      const att = await res.json() as Attachment;
      const updated = [...attachments, att];
      onUpdated(JSON.stringify(updated));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      await uploadFile(f);
    }
  }

  async function removeAttachment(id: string) {
    if (!confirm("Remove this attachment?")) return;
    const res = await fetch(`/api/${companyId}/marketing/agencies/${agency.id}/attachments?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      onUpdated(JSON.stringify(attachments.filter(a => a.id !== id)));
    }
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(a => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: BG, border: `1px solid ${BORDER}` }}>
              <span className="text-base shrink-0">📎</span>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: GOLD }}>{a.name}</p>
                <p className="text-[10px]" style={{ color: MUTED }}>{fmtSize(a.size)}</p>
              </a>
              <button onClick={() => removeAttachment(a.id)} className="text-xs px-2 py-0.5 rounded shrink-0" style={{ color: "#f87171", background: "#2d1010" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className="rounded-xl px-3 py-3 text-center transition-colors cursor-pointer"
        style={{
          background: dragOver ? `${GOLD}11` : "#0d1117",
          border: `1px dashed ${dragOver ? GOLD : BORDER}`,
        }}
        onClick={() => fileRef.current?.click()}
      >
        <p className="text-xs font-semibold" style={{ color: dragOver ? GOLD : MUTED }}>
          {uploading ? "Uploading…" : dragOver ? "Drop to attach" : "+ Attach contract / drag & drop"}
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="sr-only"
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
          accept="application/pdf,image/*,.doc,.docx,.txt"
        />
      </div>

      {err && <p className="text-[11px]" style={{ color: "#f87171" }}>{err}</p>}
    </div>
  );
}

export default function AgenciesTab({ companyId }: { companyId: string }) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agency | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${companyId}/marketing/agencies`, { cache: "no-store" });
      if (res.ok) setAgencies(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }

  function openEdit(a: Agency) {
    setEditing(a);
    setForm({
      name: a.name,
      contractStartDate: a.contractStartDate.slice(0, 10),
      payAmount: String(a.payAmount),
      payFrequency: a.payFrequency,
      upfrontFee: a.upfrontFee != null ? String(a.upfrontFee) : "",
      commitment: a.commitment ?? "",
      facebookFees: a.facebookFees != null ? String(a.facebookFees) : "",
      appointmentsBooked: a.appointmentsBooked ? String(a.appointmentsBooked) : "",
      adSpendAmount: a.adSpendAmount != null ? String(a.adSpendAmount) : "",
      adSpendSinceDate: a.adSpendSinceDate ? a.adSpendSinceDate.slice(0, 10) : "",
      expectedSaleValue: a.expectedSaleValue != null ? String(a.expectedSaleValue) : "",
      loginUrl: a.loginUrl ?? "",
      loginEmail: a.loginEmail ?? "",
      loginPassword: a.loginPassword ?? "",
      notes: a.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.contractStartDate) { setError("Contract start date is required"); return; }
    if (!form.payAmount || isNaN(Number(form.payAmount))) { setError("Pay amount is required"); return; }

    setSaving(true);
    setError(null);
    try {
      const url = editing
        ? `/api/${companyId}/marketing/agencies/${editing.id}`
        : `/api/${companyId}/marketing/agencies`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contractStartDate: form.contractStartDate,
          payAmount: form.payAmount,
          payFrequency: form.payFrequency,
          upfrontFee: form.upfrontFee || null,
          commitment: form.commitment || null,
          facebookFees: form.facebookFees || null,
          appointmentsBooked: form.appointmentsBooked || 0,
          adSpendAmount: form.adSpendAmount || null,
          adSpendSinceDate: form.adSpendSinceDate || null,
          expectedSaleValue: form.expectedSaleValue || null,
          loginUrl: form.loginUrl || null,
          loginEmail: form.loginEmail || null,
          loginPassword: form.loginPassword || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const saved = await res.json();
      setAgencies(prev => editing
        ? prev.map(a => a.id === saved.id ? { ...a, ...saved } : a)
        : [...prev, saved]);
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Agency) {
    if (!confirm(`Remove ${a.name} from your marketing agencies?`)) return;
    const res = await fetch(`/api/${companyId}/marketing/agencies/${a.id}`, { method: "DELETE" });
    if (res.ok) setAgencies(prev => prev.filter(x => x.id !== a.id));
  }

  function patchLocalAttachments(agencyId: string, attachmentsJson: string) {
    setAgencies(prev => prev.map(a => a.id === agencyId ? { ...a, attachments: attachmentsJson } : a));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: MUTED }}>
          {agencies.length} {agencies.length === 1 ? "agency" : "agencies"} on contract
        </p>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: GOLD, color: BG }}
        >
          + Add Agency
        </button>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: MUTED }}>Loading agencies…</div>
      ) : agencies.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="text-3xl mb-3">🤝</div>
          <p className="text-sm font-semibold mb-1" style={{ color: TEXT }}>No marketing agencies yet</p>
          <p className="text-xs" style={{ color: MUTED }}>Add one to start tracking contract costs and Facebook fees.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agencies.map(a => (
            <div key={a.id} className="rounded-2xl p-4 space-y-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold truncate" style={{ color: TEXT }}>{a.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                    Contract since {fmtDate(a.contractStartDate)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(a)} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "#1e2736", color: GOLD, border: `1px solid ${GOLD}33` }}>Edit</button>
                  <button onClick={() => remove(a)} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "#2d1010", color: "#f87171" }}>✕</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg px-3 py-2" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>Pay</p>
                  <p className="text-sm font-bold font-mono" style={{ color: GOLD }}>{fmtMoney(a.payAmount)}</p>
                  <p className="text-[10px]" style={{ color: MUTED }}>{freqLabel(a.payFrequency)}</p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>Upfront Fee</p>
                  <p className="text-sm font-bold font-mono" style={{ color: a.upfrontFee ? "#f59e0b" : MUTED }}>
                    {a.upfrontFee ? fmtMoney(a.upfrontFee) : "—"}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>Commitment</p>
                  <p className="text-sm font-semibold" style={{ color: a.commitment ? "#22c55e" : MUTED }}>
                    {a.commitment ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>Facebook Fees</p>
                  <p className="text-sm font-bold font-mono" style={{ color: a.facebookFees ? "#3b82f6" : MUTED }}>
                    {a.facebookFees ? fmtMoney(a.facebookFees) : "—"}
                  </p>
                </div>
              </div>

              {/* ── Performance / ROI section ──────────────────────────────── */}
              {(() => {
                const owed = amountOwedToAgency(a);
                const sale = a.expectedSaleValue != null && a.expectedSaleValue !== "" ? Number(a.expectedSaleValue) : null;
                const adSpend = a.adSpendAmount != null && a.adSpendAmount !== "" ? Number(a.adSpendAmount) : null;
                const totalCost = owed + (adSpend ?? 0);
                const roi = sale != null && totalCost > 0 ? sale - totalCost : null;
                const hasPerf = a.appointmentsBooked > 0 || adSpend != null || sale != null;
                if (!hasPerf) return null;
                return (
                  <div className="rounded-lg p-3" style={{ background: "#0c1219", border: `1px solid ${GOLD}33` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: GOLD }}>📊 Performance</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-[10px] uppercase" style={{ color: MUTED }}>Appts</p>
                        <p className="text-sm font-bold" style={{ color: a.appointmentsBooked > 0 ? "#22c55e" : MUTED }}>
                          {a.appointmentsBooked}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase" style={{ color: MUTED }}>
                          Ad Spend{a.adSpendSinceDate ? ` · since ${fmtDate(a.adSpendSinceDate)}` : ""}
                        </p>
                        <p className="text-sm font-bold font-mono" style={{ color: adSpend != null ? "#3b82f6" : MUTED }}>
                          {adSpend != null ? fmtMoney(adSpend) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase" style={{ color: MUTED }}>Owed to agency</p>
                        <p className="text-sm font-bold font-mono" style={{ color: owed > 0 ? "#f59e0b" : MUTED }}>
                          {owed > 0 ? fmtMoney(owed) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase" style={{ color: MUTED }}>Expected sale</p>
                        <p className="text-sm font-bold font-mono" style={{ color: sale != null ? "#22c55e" : MUTED }}>
                          {sale != null ? fmtMoney(sale) : "—"}
                        </p>
                      </div>
                    </div>
                    {roi != null && (
                      <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                          Net (Sale − Cost)
                        </span>
                        <span className="text-base font-bold font-mono" style={{ color: roi >= 0 ? "#22c55e" : "#f87171" }}>
                          {roi >= 0 ? "+" : ""}{fmtMoney(roi)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <CredentialsBlock url={a.loginUrl} email={a.loginEmail} password={a.loginPassword} />

              {a.notes && (
                <p className="text-xs" style={{ color: MUTED }}>{a.notes}</p>
              )}

              <AttachmentZone
                companyId={companyId}
                agency={a}
                onUpdated={json => patchLocalAttachments(a.id, json)}
              />
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => !saving && setModalOpen(false)}>
          <div style={{ background: CARD, border: `1px solid ${GOLD}55`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-1" style={{ color: TEXT }}>{editing ? "Edit Agency" : "Add Marketing Agency"}</h3>
            <p className="text-xs mb-4" style={{ color: MUTED }}>Track contract terms and monthly costs.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Agency Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Building Reach (Connor)"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Contract Start Date *</label>
                <input
                  type="date"
                  value={form.contractStartDate}
                  onChange={e => setForm({ ...form, contractStartDate: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Pay Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.payAmount}
                    onChange={e => setForm({ ...form, payAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Pay Frequency *</label>
                  <select
                    value={form.payFrequency}
                    onChange={e => setForm({ ...form, payFrequency: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                  >
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Upfront Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.upfrontFee}
                    onChange={e => setForm({ ...form, upfrontFee: e.target.value })}
                    placeholder="One-time, paid at signing"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Commitment</label>
                  <input
                    type="text"
                    value={form.commitment}
                    onChange={e => setForm({ ...form, commitment: e.target.value })}
                    placeholder="e.g. 6 months, Month-to-month"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Facebook Fees ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.facebookFees}
                  onChange={e => setForm({ ...form, facebookFees: e.target.value })}
                  placeholder="Monthly ad spend, etc. (optional)"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                />
              </div>

              {/* Performance tracking — record what's actually happening on this contract */}
              <div className="rounded-lg p-3" style={{ background: "#0c1219", border: `1px solid ${GOLD}33` }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: GOLD }}>📊 Performance</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Appointments booked</label>
                    <input
                      type="number" min={0} step={1}
                      value={form.appointmentsBooked}
                      onChange={e => setForm({ ...form, appointmentsBooked: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Expected sale value ($)</label>
                    <input
                      type="number" step="0.01"
                      value={form.expectedSaleValue}
                      onChange={e => setForm({ ...form, expectedSaleValue: e.target.value })}
                      placeholder="From appts in pipeline"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Ad spend ($)</label>
                    <input
                      type="number" step="0.01"
                      value={form.adSpendAmount}
                      onChange={e => setForm({ ...form, adSpendAmount: e.target.value })}
                      placeholder="Meta / Google ad spend"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Spending since</label>
                    <input
                      type="date"
                      value={form.adSpendSinceDate}
                      onChange={e => setForm({ ...form, adSpendSinceDate: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }}
                    />
                  </div>
                </div>
              </div>

              {/* Login credentials — so the dashboard is one tap away */}
              <div className="rounded-lg p-3" style={{ background: "#0c1219", border: `1px solid ${BORDER}` }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: GOLD }}>🔑 Login Credentials</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Login URL</label>
                    <input type="url" value={form.loginUrl} onChange={e => setForm({ ...form, loginUrl: e.target.value })}
                      placeholder="https://app.example.com/login"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Email</label>
                      <input type="email" value={form.loginEmail} onChange={e => setForm({ ...form, loginEmail: e.target.value })}
                        autoComplete="off"
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Password</label>
                      <input type="text" value={form.loginPassword} onChange={e => setForm({ ...form, loginPassword: e.target.value })}
                        autoComplete="off"
                        className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                        style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1 uppercase tracking-wide" style={{ color: MUTED }}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Contact info, scope of services, etc."
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT, outline: "none", resize: "none" }}
                />
              </div>

              {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ background: GOLD, color: BG }}
              >
                {saving ? "Saving…" : (editing ? "Save Changes" : "Add Agency")}
              </button>
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg disabled:opacity-50"
                style={{ background: "#30373f", color: MUTED }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
