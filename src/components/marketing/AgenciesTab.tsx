"use client";

import { useState, useEffect, useCallback } from "react";

type Agency = {
  id: string;
  name: string;
  contractStartDate: string;
  payAmount: number | string;
  payFrequency: string;
  facebookFees: number | string | null;
  notes: string | null;
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
  facebookFees: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    contractStartDate: new Date().toISOString().slice(0, 10),
    payAmount: "",
    payFrequency: "MONTH",
    facebookFees: "",
    notes: "",
  };
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
      facebookFees: a.facebookFees != null ? String(a.facebookFees) : "",
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
          facebookFees: form.facebookFees || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const saved = await res.json();
      setAgencies(prev => editing
        ? prev.map(a => a.id === saved.id ? saved : a)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: MUTED }}>
            {agencies.length} {agencies.length === 1 ? "agency" : "agencies"} on contract
          </p>
        </div>
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
            <div key={a.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between gap-3 mb-3">
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
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>Facebook Fees</p>
                  <p className="text-sm font-bold font-mono" style={{ color: a.facebookFees ? "#3b82f6" : MUTED }}>
                    {a.facebookFees ? fmtMoney(a.facebookFees) : "—"}
                  </p>
                </div>
              </div>

              {a.notes && (
                <p className="text-xs mt-2" style={{ color: MUTED }}>{a.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
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
