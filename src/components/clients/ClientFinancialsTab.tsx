"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/ui/icons";
import { FormulaInput } from "@/components/FormulaInput";
import { STANDARD_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, isSameMonth, isToday, eachDayOfInterval,
} from "date-fns";

type SubContractor = { id: string; name: string; email: string | null; phone: string | null; divisionCode: string; divisionName: string };
type SubPayment = { id: string; amount: number; method: string; paidAt: string; checkNumber: string | null; notes: string | null };
type ScopeItem = { id: string; csiCode: string | null; name: string; amount: number; salePrice: number | null };
type EstimateLineItem = { id: string; name: string; csiCode: string | null; salePrice: number };
type EstimateDivision = { divisionId: string; divisionName: string; csiCode: string | null; items: EstimateLineItem[] };
type ClientSub = { id: string; subContractorId: string | null; subName: string; scope: string | null; division: string | null; contractAmount: number; notes: string | null; payments: SubPayment[]; scopeItems: ScopeItem[] };
type Supplier = { id: string; name: string };
type MaterialPurchase = { id: string; supplierId: string; supplierName: string; amount: number; description: string | null; purchasedAt: string; notes: string | null };
type PermitFee = { id: string; name: string | null; amount: number; description: string | null; incurredAt: string; notes: string | null };
type InvoicePayment = { id: string; amount: number };
type ClientInvoice = { id: string; amount: number; status: string; pct?: number | string | null; payments: InvoicePayment[] };
type ChangeOrderItem = { id: string; name: string; csiCode: string | null; divisionName: string; qty: string | null; unitCost: string | null; markupPct: string | null };
type ChangeOrderPayment = { id: string; amount: number | string; method: string; paidDate: string; notes: string | null };
type ChangeOrder = { id: string; title: string; orderNumber: string | null; status: string; signedAt: string | null; createdAt: string; items: ChangeOrderItem[]; payments?: ChangeOrderPayment[] };
type LienRelease = { id: string; type: "PARTIAL" | "FINAL"; subName: string; recipientEmail: string | null; amount: string | null; throughDate: string | null; legalDescription: string; signatureToken: string | null; signedAt: string | null; signedByName: string | null; emailSentAt: string | null; createdAt: string };

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }

// Picker of available scope items (from the contract or change orders) — click + to add to the working list.
function ScopePicker({ divs, onPick, accent, emptyLabel }: { divs: EstimateDivision[]; onPick: (id: string) => void; accent: string; emptyLabel: string }) {
  return (
    <div className="rounded-2xl overflow-hidden mt-1" style={{ border: `1px solid ${accent}33` }}>
      {divs.length === 0 ? (
        <div className="px-4 py-3 text-xs text-center" style={{ background: "#0d1117", color: "#8b949e" }}>{emptyLabel}</div>
      ) : divs.map(div => (
        <div key={div.divisionId}>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: "#0d1117", color: accent, borderBottom: "1px solid #21262d" }}>
            {div.csiCode ? `${div.csiCode.slice(0, 2)} · ` : ""}{div.divisionName}
          </div>
          {div.items.map(item => (
            <button key={item.id} onClick={() => onPick(item.id)} className="w-full flex items-center gap-2 px-4 py-2 text-left transition-colors hover:opacity-80" style={{ background: "#0d1117", borderBottom: "1px solid #21262d22" }}>
              <span className="text-sm shrink-0 font-bold" style={{ color: accent }}>+</span>
              <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "#e6edf3" }}>{item.name}</span>
              {item.salePrice > 0 && <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>${fmt(item.salePrice)}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// Change-order picker grouped BY change order — add all (or one) to the list, or transfer a whole CO to a sub.
function CoScopePicker({ groups, onPick, subs, onTransferAll }: {
  groups: { key: string; label: string; items: EstimateLineItem[] }[];
  onPick: (id: string) => void;
  subs: ClientSub[];
  onTransferAll: (sub: ClientSub, items: EstimateLineItem[]) => void;
}) {
  const accent = "#60a5fa";
  return (
    <div className="rounded-2xl overflow-hidden mt-1" style={{ border: `1px solid ${accent}33` }}>
      {groups.length === 0 ? (
        <div className="px-4 py-3 text-xs text-center" style={{ background: "#0d1117", color: "#8b949e" }}>No more change-order items to add.</div>
      ) : groups.map(g => (
        <div key={g.key}>
          <div className="flex items-center justify-between gap-2 px-4 py-2 flex-wrap" style={{ background: "#0d1117", borderBottom: "1px solid #21262d" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>{g.label}</span>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <button onClick={() => g.items.forEach(i => onPick(i.id))} className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }} title="Add every item in this change order to the list">+ Add all</button>
              {subs.map(sub => (
                <button key={sub.id} onClick={() => onTransferAll(sub, g.items)} className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#C9A84C18", color: "#C9A84C", border: "1px solid #C9A84C33" }} title={`Transfer all of ${g.label} to ${sub.subName}`}>→ {sub.subName}</button>
              ))}
            </div>
          </div>
          {g.items.map(item => (
            <button key={item.id} onClick={() => onPick(item.id)} className="w-full flex items-center gap-2 px-4 py-2 text-left transition-colors hover:opacity-80" style={{ background: "#0d1117", borderBottom: "1px solid #21262d22" }}>
              <span className="text-sm shrink-0 font-bold" style={{ color: accent }}>+</span>
              <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "#e6edf3" }}>{item.name}</span>
              {item.salePrice > 0 && <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>${fmt(item.salePrice)}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = { CHECK: "Check", ZELLE: "Zelle", ACH: "ACH", CASH: "Cash" };

// ─── Calendar date picker ──────────────────────────────────────────────────────
function DatePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => value ? new Date(value + "T12:00:00") : new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  function selectDate(d: Date) {
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  }

  const displayVal = value ? format(new Date(value + "T12:00:00"), "MM/dd/yyyy") : "Select date";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (value) setViewMonth(new Date(value + "T12:00:00")); }}
        className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center gap-2"
        style={{ background: "#0d1117", border: "1px solid #30373f", color: value ? "#e6edf3" : "#8b949e" }}
      >
        <span style={{ fontSize: "13px" }}>📅</span>
        <span>{displayVal}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-xl p-3 shadow-xl" style={{ background: "#161b22", border: "1px solid #30373f", width: "240px" }}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth(m => subMonths(m, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-lg font-bold" style={{ color: "#8b949e" }}>‹</button>
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{format(viewMonth, "MMMM yyyy")}</span>
            <button type="button" onClick={() => setViewMonth(m => addMonths(m, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-lg font-bold" style={{ color: "#8b949e" }}>›</button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-xs py-0.5" style={{ color: "#4d5566" }}>{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {days.map(d => {
              const dateStr = format(d, "yyyy-MM-dd");
              const isSelected = dateStr === value;
              const inMonth = isSameMonth(d, viewMonth);
              const todayBool = isToday(d);
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => selectDate(d)}
                  className="text-center text-xs py-1.5 rounded-lg"
                  style={{
                    color: isSelected ? "#fff" : inMonth ? (todayBool ? "#3b82f6" : "#e6edf3") : "#4d5566",
                    background: isSelected ? "#3b82f6" : "transparent",
                    fontWeight: isSelected || todayBool ? "700" : "400",
                  }}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { onChange(today()); setOpen(false); }}
            className="mt-2 w-full text-xs py-1 rounded-lg"
            style={{ color: "#3b82f6", background: "#3b82f611", border: "1px solid #3b82f633" }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Division Picker (multi-select chip dropdown) ─────────────────────────────
function DivisionPicker({ value, onChange, bg = "#0d1117" }: { value: string; onChange: (v: string) => void; bg?: string }) {
  const selected = value ? value.split(" | ").filter(Boolean) : [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(val: string) {
    const next = selected.includes(val) ? selected.filter(d => d !== val) : [...selected, val];
    onChange(next.join(" | "));
  }

  return (
    <div className="relative" ref={ref}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map(div => (
            <span key={div} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
              <span>{div.split(" · ")[0]?.slice(0, 2)} · {div.split(" · ").slice(1).join(" · ")}</span>
              <button type="button" onClick={() => toggle(div)} className="leading-none" style={{ color: "#C9A84C99" }}>×</button>
            </span>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between" style={{ background: bg, border: "1px solid #30373f", color: "#8b949e" }}>
        <span>{selected.length === 0 ? "— Select Divisions —" : `${selected.length} division${selected.length > 1 ? "s" : ""} selected`}</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-xl overflow-y-auto shadow-xl" style={{ background: "#161b22", border: "1px solid #30373f", maxHeight: 220, width: "100%" }}>
          {STANDARD_TEMPLATE_DIVISIONS.map(d => {
            const val = `${d.csiCode} · ${d.name}`;
            const isSelected = selected.includes(val);
            return (
              <button key={d.csiCode} type="button" onClick={() => toggle(val)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors" style={{ color: isSelected ? "#C9A84C" : "#e6edf3", background: isSelected ? "#C9A84C11" : "transparent" }}>
                <span className="w-4 text-center text-xs">{isSelected ? "✓" : ""}</span>
                <span>{d.csiCode.slice(0, 2)} · {d.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Release Panel ────────────────────────────────────────────────────────────
function ReleasePanel({
  companyId, clientId, subName, subContractorId, initialEmail, defaultAmount, defaultDate, type, onClose,
  releases, onCreated, onDeleted, onSubEmailSaved,
}: {
  companyId: string; clientId: string; subName: string;
  subContractorId: string | null; initialEmail: string;
  defaultAmount: string; defaultDate: string;
  type: "PARTIAL" | "FINAL";
  onClose: () => void;
  releases: LienRelease[];
  onCreated: (r: LienRelease) => void;
  onDeleted: (id: string) => void;
  onSubEmailSaved: (subContractorId: string, email: string) => void;
}) {
  const [rlSubName, setRlSubName] = useState(subName);
  const [rlEmail, setRlEmail] = useState(initialEmail);
  const [rlAmount, setRlAmount] = useState(defaultAmount);
  const [rlDate, setRlDate] = useState(defaultDate);
  const [rlLegal, setRlLegal] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendName, setSendName] = useState("");
  const [sendingReq, setSendingReq] = useState(false);

  const typeColor = type === "PARTIAL" ? "#60a5fa" : "#22c55e";
  const typeBg = type === "PARTIAL" ? "#1e3a5f" : "#0d2318";

  async function create() {
    if (!rlSubName.trim() || !rlLegal.trim()) return;
    setCreating(true);
    try {
      const email = rlEmail.trim() || null;
      const [releaseRes] = await Promise.all([
        fetch(`/api/${companyId}/clients/${clientId}/lien-releases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, subName: rlSubName.trim(), recipientEmail: email, amount: rlAmount.trim() || null, throughDate: rlDate || null, legalDescription: rlLegal.trim() }),
        }),
        subContractorId && email && email !== initialEmail
          ? fetch(`/api/${companyId}/subs/${subContractorId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ emailOnly: true, email }),
            })
          : Promise.resolve(null),
      ]);
      if (releaseRes.ok) {
        const data = await releaseRes.json();
        onCreated({ ...data, emailSentAt: null });
        if (subContractorId && email && email !== initialEmail) onSubEmailSaved(subContractorId, email);
        setRlLegal("");
        setShowForm(false);
      }
    } finally { setCreating(false); }
  }

  async function deleteRelease(id: string) {
    if (!confirm("Delete this lien release?")) return;
    await fetch(`/api/${companyId}/clients/${clientId}/lien-releases`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onDeleted(id);
  }

  async function sendRelease(r: LienRelease) {
    if (!sendEmail.trim()) return;
    setSendingReq(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/lien-releases/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, recipientEmail: sendEmail.trim(), recipientName: sendName.trim() || null }),
      });
      if (res.ok) {
        onCreated({ ...r, emailSentAt: new Date().toISOString(), recipientEmail: sendEmail.trim() });
        setSendingId(null); setSendEmail(""); setSendName("");
      }
    } finally { setSendingReq(false); }
  }

  return (
    <div className="px-3 pb-3 pt-2" style={{ background: "#0d1421", borderTop: "1px solid #21262d44" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: typeBg, color: typeColor }}>
            {type === "PARTIAL" ? "PARTIAL" : "FINAL"} RELEASE
          </span>
          <span className="text-xs font-semibold" style={{ color: "#e6edf3" }}>{subName}</span>
        </div>
        <button onClick={onClose} className="text-xs px-2 py-0.5 rounded" style={{ color: "#8b949e", background: "#30373f22", border: "1px solid #30373f" }}>✕ Close</button>
      </div>

      {showForm ? (
        <div className="rounded-xl p-4 space-y-3 mb-3" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Subcontractor Name *</label>
              <input value={rlSubName} onChange={e => setRlSubName(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Recipient Email</label>
              <input type="email" value={rlEmail} onChange={e => setRlEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-lg px-3 py-2 text-xs" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Amount (consideration)</label>
              <input value={rlAmount} onChange={e => setRlAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg px-3 py-2 text-xs" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Through Date</label>
              <input type="date" value={rlDate} onChange={e => setRlDate(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Legal Description *</label>
            <textarea
              value={rlLegal}
              onChange={e => setRlLegal(e.target.value)}
              rows={3}
              placeholder="Property legal description (e.g. LOT 12 BLK 4 SUBDIVISION PB 44-98)"
              className="w-full rounded-lg px-3 py-2 text-xs"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", resize: "vertical", fontFamily: "monospace" }}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={creating || !rlSubName.trim() || !rlLegal.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              style={{ background: typeColor, color: type === "PARTIAL" ? "#fff" : "#0d1117" }}>
              {creating ? "Creating…" : `Create ${type === "PARTIAL" ? "Partial" : "Final"} Release`}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-xl text-xs" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full mb-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: `${typeColor}11`, color: typeColor, border: `1px solid ${typeColor}33` }}>
          + New {type === "PARTIAL" ? "Partial" : "Final"} Release
        </button>
      )}

      {releases.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Existing Releases — {subName}</div>
          {releases.map(r => (
            <div key={r.id} className="rounded-xl p-3 space-y-2" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: r.type === "PARTIAL" ? "#1e3a5f" : "#0d2318", color: r.type === "PARTIAL" ? "#60a5fa" : "#22c55e" }}>{r.type}</span>
                    {r.signedAt && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#0d2318", color: "#22c55e" }}>✓ Signed {new Date(r.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                    {!r.signedAt && r.emailSentAt && <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "#f59e0b", border: "1px solid #f59e0b44" }}>Awaiting signature</span>}
                  </div>
                  <div className="text-xs" style={{ color: "#8b949e" }}>
                    {r.amount && `$${r.amount}`}{r.amount && r.throughDate && " · "}{r.throughDate && `Through ${new Date(r.throughDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    {(r.amount || r.throughDate) ? " · " : ""}Created {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  {r.signedByName && <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>Signed by: {r.signedByName}</div>}
                  {r.emailSentAt && r.recipientEmail && <div className="text-xs mt-0.5" style={{ color: "#22c55e" }}>✓ Sent to {r.recipientEmail}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={`/api/${companyId}/lien-releases/${r.id}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-0.5 rounded font-semibold"
                    style={{ background: "#C9A84C11", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
                    📄 PDF
                  </a>
                  {!r.signedAt && (
                    <button onClick={() => { setSendingId(sendingId === r.id ? null : r.id); setSendEmail(r.recipientEmail ?? ""); setSendName(r.subName); }}
                      className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #60a5fa44" }}>
                      ✉ Send
                    </button>
                  )}
                  <button onClick={() => deleteRelease(r.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>Del</button>
                </div>
              </div>
              {sendingId === r.id && (
                <div className="rounded-lg p-3 space-y-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Name</label>
                      <input value={sendName} onChange={e => setSendName(e.target.value)} placeholder="Recipient name" className="w-full rounded-lg px-2 py-1.5 text-xs" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Email *</label>
                      <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-lg px-2 py-1.5 text-xs" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => sendRelease(r)} disabled={sendingReq || !sendEmail.trim()}
                      className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ background: "#C9A84C", color: "#0d1117" }}>
                      {sendingReq ? "Sending…" : "Send Email"}
                    </button>
                    <button onClick={() => setSendingId(null)} className="px-3 py-1 rounded-lg text-xs" style={{ color: "#8b949e", border: "1px solid #30373f" }}>Cancel</button>
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

// ─── Sub Card ─────────────────────────────────────────────────────────────────
function PayForm({ subId, companyId, clientId, payment, onSave, onCancel }: {
  subId: string; companyId: string; clientId: string;
  payment?: SubPayment;
  onSave: (p: SubPayment) => void;
  onCancel: () => void;
}) {
  const isEdit = !!payment;
  const [amount, setAmount] = useState(payment ? String(Math.abs(payment.amount)) : "");
  const [method, setMethod] = useState(payment?.method ?? "CHECK");
  const [date, setDate] = useState(payment?.paidAt ?? today());
  const [check, setCheck] = useState(payment?.checkNumber ?? "");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [isCredit, setIsCredit] = useState(payment ? payment.amount < 0 : false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount || isNaN(Number(amount))) return;
    setSaving(true);
    try {
      const raw = Number(amount);
      const final = isCredit ? -Math.abs(raw) : Math.abs(raw);
      if (isEdit) {
        const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${subId}/payments`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: payment!.id, amount: final, method, paidAt: date, checkNumber: check || null, notes: notes || null }),
        });
        if (res.ok) onSave(await res.json());
      } else {
        const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${subId}/payments`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: final, method, paidAt: date, checkNumber: check || null, notes: notes || null }),
        });
        if (res.ok) onSave(await res.json());
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#0d1421", border: "1px solid #C9A84C33" }}>
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <div onClick={() => setIsCredit(c => !c)} className="w-9 h-5 rounded-full transition-colors relative" style={{ background: isCredit ? "#f85149" : "#30373f" }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: isCredit ? "18px" : "2px" }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: isCredit ? "#f85149" : "#8b949e" }}>{isCredit ? "Credit from sub" : "Payment to sub"}</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Amount</label>
          <FormulaInput value={amount} onChange={n => setAmount(String(n))} placeholder="0.00 or =100+50" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
            companyId={companyId} scope={payment?.id ? `subPayment:${payment.id}:amount` : `subPayment:new:${subId}:amount`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
            <option value="CHECK">Check</option><option value="ZELLE">Zelle</option><option value="ACH">ACH</option><option value="CASH">Cash</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Date</label>
          <DatePickerInput value={date} onChange={setDate} />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Check # (optional)</label>
          <input value={check} onChange={e => setCheck(e.target.value)} placeholder="Check number" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
        </div>
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !amount} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: isCredit ? "#f85149" : "#22c55e", color: "#fff" }}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : isCredit ? "Log Credit" : "Add Payment"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
      </div>
    </div>
  );
}

function SubCard({
  sub, companyId, clientId, clientName, estimateDivisions, coGroups,
  onUpdate, onDelete, lienReleases, onReleaseCreated, onReleaseDeleted, subEmail, onSubEmailSaved,
}: {
  sub: ClientSub; companyId: string; clientId: string; clientName: string;
  estimateDivisions: EstimateDivision[];
  coGroups: { key: string; label: string; items: EstimateLineItem[] }[];
  onUpdate: (updated: ClientSub) => void;
  onDelete: (id: string) => void;
  lienReleases: LienRelease[];
  onReleaseCreated: (r: LienRelease) => void;
  onReleaseDeleted: (id: string) => void;
  subEmail: string;
  onSubEmailSaved: (subContractorId: string, email: string) => void;
}) {
  const contractTotal = sub.scopeItems.length > 0
    ? sub.scopeItems.reduce((s, i) => s + i.amount, 0)
    : sub.contractAmount;
  const totalPaid = sub.payments.reduce((s, p) => s + p.amount, 0);
  const balance = contractTotal - totalPaid;
  const pct = contractTotal > 0 ? Math.min(totalPaid / contractTotal * 100, 100) : 0;

  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editDivision, setEditDivision] = useState(sub.division ?? "");
  const [editScope, setEditScope] = useState(sub.scope ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  const [showScopePicker, setShowScopePicker] = useState(false);
  const [openPickerDivs, setOpenPickerDivs] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemAmt, setEditingItemAmt] = useState("");

  const [showPayForm, setShowPayForm] = useState(false);
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [releasePanel, setReleasePanel] = useState<{ payId: string; type: "PARTIAL" | "FINAL" } | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  // Each sub card starts collapsed; user picks which to expand
  const [cardOpen, setCardOpen] = useState(false);

  function printSub() {
    const win = window.open("", "_blank");
    if (!win) return;
    const scopeRows = sub.scopeItems.length > 0
      ? sub.scopeItems.map(i => `<tr><td style="padding:8px 12px;color:#1e293b">${i.name}</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(i.amount)}</td></tr>`).join("")
      : `<tr><td colspan="2" style="padding:12px;color:#64748b;font-style:italic">No itemized scope. Contract amount: $${fmt(sub.contractAmount)}</td></tr>`;
    const payRows = sub.payments.length > 0
      ? sub.payments.map(p => {
          const isCr = p.amount < 0;
          return `<tr><td style="padding:8px 12px;color:#475569">${new Date(p.paidAt + "T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td style="padding:8px 12px;color:#475569">${METHOD_LABELS[p.method] ?? p.method}${p.checkNumber ? ` #${p.checkNumber}` : ""}${isCr ? " (Credit)" : ""}</td><td style="padding:8px 12px;color:#475569">${p.notes ?? ""}</td><td style="padding:8px 12px;text-align:right;color:${isCr ? "#ef4444" : "#22c55e"};font-weight:600">${isCr ? "-" : ""}$${fmt(Math.abs(p.amount))}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4" style="padding:12px;color:#64748b;font-style:italic">No payments yet</td></tr>`;
    win.document.write(`<!DOCTYPE html><html><head><title>Sub Statement — ${sub.subName} — ${clientName}</title><style>body{font-family:Helvetica,sans-serif;max-width:800px;margin:40px auto;color:#1e293b}h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-top:32px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#1e293b;color:#fff;padding:10px 12px;text-align:left;font-size:13px}td{border-bottom:1px solid #e2e8f0;font-size:14px}.total{background:#f8fafc;font-weight:700}.bal{background:#0d2318;color:#22c55e;font-weight:700;font-size:16px}.due{background:#2d1010;color:#ef4444;font-weight:700;font-size:16px}@media print{body{margin:20px}}</style></head><body>
<h1>${sub.subName}</h1>
<p style="color:#64748b;font-size:14px">${clientName} &nbsp;·&nbsp; ${[sub.division, sub.scope].filter(Boolean).join(" — ")} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>

<h2>Scope of Work</h2>
<table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${scopeRows}
<tr class="total"><td style="padding:10px 12px">Contract Total</td><td style="padding:10px 12px;text-align:right">$${fmt(contractTotal)}</td></tr>
</tbody></table>

<h2>Payment History</h2>
<table><thead><tr><th>Date</th><th>Method</th><th>Notes</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${payRows}
<tr class="total"><td colspan="3" style="padding:10px 12px">Total Paid</td><td style="padding:10px 12px;text-align:right">$${fmt(totalPaid)}</td></tr>
<tr class="${balance > 0 ? "due" : "bal"}"><td colspan="3" style="padding:12px">${balance > 0 ? "BALANCE DUE" : balance < 0 ? "OVERPAID" : "PAID IN FULL"}</td><td style="padding:12px;text-align:right">$${fmt(Math.abs(balance))}</td></tr>
</tbody></table>

<script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  async function saveInfo() {
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: editScope.trim() || null, division: editDivision || null }),
      });
      if (res.ok) { onUpdate({ ...sub, scope: editScope.trim() || null, division: editDivision || null }); setShowEditInfo(false); }
    } finally { setSavingInfo(false); }
  }

  async function deleteSub() {
    if (!confirm(`Remove ${sub.subName}?`)) return;
    await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}`, { method: "DELETE" });
    onDelete(sub.id);
  }

  async function addScopeItems(items: { csiCode?: string | null; name: string; amount?: number; salePrice?: number | null }[]) {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/scope`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...sub, contractAmount: data.contractAmount, scopeItems: [...sub.scopeItems, ...data.items] });
    }
  }

  async function saveScopeItemAmount(itemId: string, rawAmt: string) {
    const amount = Number(rawAmt);
    if (isNaN(amount)) return;
    const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/scope`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, amount }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...sub, contractAmount: data.contractAmount, scopeItems: sub.scopeItems.map(i => i.id === itemId ? { ...i, amount: data.amount } : i) });
      setEditingItemId(null);
    }
  }

  async function deleteScopeItem(itemId: string) {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/scope?itemId=${itemId}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      onUpdate({ ...sub, contractAmount: data.contractAmount, scopeItems: sub.scopeItems.filter(i => i.id !== itemId) });
    }
  }

  async function deletePayment(paymentId: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/payments?paymentId=${paymentId}`, { method: "DELETE" });
    onUpdate({ ...sub, payments: sub.payments.filter(p => p.id !== paymentId) });
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#161b22", border: "1px solid #30373f" }}>

      {/* Header row — click name area to expand */}
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setCardOpen(v => !v)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#C9A84C" }}>{cardOpen ? "▼" : "▶"}</span>
            <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{sub.subName}</span>
            {totalPaid > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "#0d2318", color: "#22c55e", border: "1px solid #22c55e44" }}>Paid ${fmt(totalPaid)}</span>
            )}
            {balance > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "#2a1010", color: "#f87171", border: "1px solid #ef444466" }}>Owed ${fmt(balance)}</span>
            )}
          </div>
          {cardOpen && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs" style={{ color: "#8b949e" }}>
                {[sub.division?.split(" | ").map(d => d.slice(0, 2) + " · " + d.split(" · ").slice(1).join(" · ")).join(", "), sub.scope].filter(Boolean).join(" — ") || "Subcontractor"}
              </span>
              <span onClick={e => { e.stopPropagation(); setEditDivision(sub.division ?? ""); setEditScope(sub.scope ?? ""); setShowEditInfo(v => !v); }} className="text-xs px-1.5 py-0.5 rounded shrink-0 cursor-pointer" style={{ color: "#C9A84C", background: "#C9A84C11", border: "1px solid #C9A84C33" }}>Edit</span>
            </div>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
            Contract: ${fmt(contractTotal)}
          </div>
          {cardOpen && (
            <>
              <button onClick={printSub} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C44" }} title="Print scope and payments">
                🖨
              </button>
              <button onClick={deleteSub} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}>
                <TrashIcon size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {cardOpen && (
      <>
      {/* Edit info panel */}
      {showEditInfo && (
        <div className="rounded-xl p-3 space-y-3" style={{ background: "#0d1117", border: "1px solid #C9A84C33" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Division</label>
              <DivisionPicker value={editDivision} onChange={setEditDivision} bg="#161b22" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Trade / Role</label>
              <input value={editScope} onChange={e => setEditScope(e.target.value)} placeholder="e.g. Electrician, Plumber" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#161b22", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveInfo} disabled={savingInfo} className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: "#C9A84C", color: "#0d1117" }}>{savingInfo ? "Saving…" : "Save"}</button>
            <button onClick={() => setShowEditInfo(false)} className="px-4 py-1.5 rounded-lg text-xs" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Scope of work */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>Scope of Work</span>
          <button onClick={() => setShowScopePicker(true)} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
            + Add Items
          </button>
        </div>

        {/* Scope items list with sale price + sub cost + profit — grouped by source (Contract vs each Change Order) */}
        {sub.scopeItems.length > 0 && (() => {
          const GRID = "minmax(0,1fr) 70px 74px 70px 20px";
          // Map each CO item name → its CO label so we can attribute scope items to their source.
          const coNameToLabel = new Map<string, string>();
          coGroups.forEach(g => g.items.forEach(it => { if (!coNameToLabel.has(it.name)) coNameToLabel.set(it.name, g.label); }));
          const buckets = new Map<string, ScopeItem[]>();
          sub.scopeItems.forEach(item => {
            const label = coNameToLabel.get(item.name) ?? "Contract";
            if (!buckets.has(label)) buckets.set(label, []);
            buckets.get(label)!.push(item);
          });
          const order = ["Contract", ...coGroups.map(g => g.label)];
          const groups = order.filter(l => buckets.has(l)).map(l => ({ label: l, items: buckets.get(l)! }));
          const renderItemRow = (item: ScopeItem) => {
            const profit = item.salePrice != null ? item.salePrice - item.amount : null;
            return (
              <div key={item.id} style={{ background: "#0d1117", borderBottom: "1px solid #21262d22" }}>
                {editingItemId === item.id ? (
                  <div className="flex items-center gap-1 px-2 py-2">
                    <span className="text-xs flex-1 truncate" style={{ color: "#8b949e" }}>{item.name}</span>
                    <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>$</span>
                    <FormulaInput
                      autoFocus
                      value={editingItemAmt}
                      onChange={n => setEditingItemAmt(String(n))}
                      onKeyDown={e => { if (e.key === "Enter") saveScopeItemAmount(item.id, editingItemAmt); if (e.key === "Escape") setEditingItemId(null); }}
                      className="w-20 rounded px-1.5 py-0.5 text-xs text-right shrink-0"
                      style={{ background: "#161b22", border: "1px solid #C9A84C", color: "#C9A84C" }}
                      companyId={companyId}
                      scope={`subScopeItem:${item.id}:amount`}
                    />
                    <button onClick={() => saveScopeItemAmount(item.id, editingItemAmt)} className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: "#C9A84C", color: "#0d1117" }}>✓</button>
                    <button onClick={() => setEditingItemId(null)} className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: "#30373f", color: "#8b949e" }}>✕</button>
                  </div>
                ) : (
                  <div className="grid items-center px-2 py-2" style={{ gridTemplateColumns: GRID, columnGap: "6px" }}>
                    <span className="text-xs truncate pr-1" style={{ color: "#e6edf3" }}>{item.name}</span>
                    <span className="text-xs text-right" style={{ color: "#8b949e" }}>{item.salePrice != null ? `$${fmt(item.salePrice)}` : "—"}</span>
                    <button onClick={() => { setEditingItemId(item.id); setEditingItemAmt(String(item.amount)); }} className="text-xs text-right font-semibold px-1 py-0.5 rounded" style={{ color: "#C9A84C", background: "#C9A84C11" }}>${fmt(item.amount)}</button>
                    <span className="text-xs text-right font-semibold" style={{ color: profit == null ? "#4d5566" : profit >= 0 ? "#22c55e" : "#f85149" }}>
                      {profit != null ? `$${fmt(profit)}` : "—"}
                    </span>
                    <button onClick={() => deleteScopeItem(item.id)} className="flex items-center justify-center" style={{ color: "#f85149" }}><TrashIcon size={10} /></button>
                  </div>
                )}
              </div>
            );
          };
          return (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #21262d" }}>
            {/* Header row — compact columns that fit mobile */}
            <div className="grid px-2 py-1.5" style={{ gridTemplateColumns: GRID, columnGap: "6px", background: "#0d1117", borderBottom: "1px solid #21262d" }}>
              <span className="text-xs" style={{ color: "#4d5566" }}>Item</span>
              <span className="text-xs text-right" style={{ color: "#4d5566" }}>Sale</span>
              <span className="text-xs text-right" style={{ color: "#4d5566" }}>Cost</span>
              <span className="text-xs text-right" style={{ color: "#4d5566" }}>Profit</span>
              <span />
            </div>
            {groups.map(grp => {
              const isContract = grp.label === "Contract";
              const accent = isContract ? "#C9A84C" : "#60a5fa";
              const grpCost = grp.items.reduce((s, i) => s + i.amount, 0);
              return (
                <div key={grp.label}>
                  {/* Source title (only when there's more than one source, or it's a change order) */}
                  {(groups.length > 1 || !isContract) && (
                    <div className="flex items-center justify-between px-2 py-1" style={{ background: "#161b2288", borderBottom: `1px solid ${accent}33`, borderLeft: `2px solid ${accent}` }}>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{isContract ? "From Contract" : grp.label}</span>
                      <span className="text-xs font-semibold" style={{ color: "#8b949e" }}>${fmt(grpCost)}</span>
                    </div>
                  )}
                  {grp.items.map(renderItemRow)}
                </div>
              );
            })}
            {/* Totals row */}
            {(() => {
              const totalSale = sub.scopeItems.filter(i => i.salePrice != null).reduce((s, i) => s + (i.salePrice ?? 0), 0);
              const totalCost = sub.scopeItems.reduce((s, i) => s + i.amount, 0);
              const totalProfit = totalSale - totalCost;
              const hasSale = sub.scopeItems.some(i => i.salePrice != null);
              return (
                <div className="grid px-2 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 74px 70px 20px", columnGap: "6px", background: "#161b22", borderTop: "1px solid #30373f" }}>
                  <span className="text-xs font-bold" style={{ color: "#8b949e" }}>TOTAL</span>
                  <span className="text-xs font-bold text-right" style={{ color: "#e6edf3" }}>{hasSale ? `$${fmt(totalSale)}` : "—"}</span>
                  <span className="text-xs font-bold text-right" style={{ color: "#C9A84C" }}>${fmt(totalCost)}</span>
                  <span className="text-xs font-bold text-right" style={{ color: hasSale ? (totalProfit >= 0 ? "#22c55e" : "#f85149") : "#4d5566" }}>{hasSale ? `$${fmt(totalProfit)}` : "—"}</span>
                  <span />
                </div>
              );
            })()}
          </div>
          );
        })()}

        {sub.scopeItems.length === 0 && !showScopePicker && (
          <p className="text-xs py-2 text-center" style={{ color: "#4d5566" }}>No scope items yet — click &ldquo;+ Add Items&rdquo;</p>
        )}

        {/* Add-scope popup — pick from the main contract or from change orders */}
        {showScopePicker && (() => {
          const addedNames = new Set(sub.scopeItems.map(i => i.name));
          const renderItem = (item: EstimateLineItem, accent: string) => {
            const added = addedNames.has(item.name);
            return (
              <div key={item.id} className="flex items-center gap-2 px-4 py-1.5" style={{ background: "#0d1117", borderBottom: "1px solid #21262d22" }}>
                <span className="text-xs flex-1 truncate" style={{ color: added ? "#4d5566" : "#e6edf3" }}>{item.name}</span>
                {item.salePrice > 0 && <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>${fmt(item.salePrice)}</span>}
                {added ? (
                  <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ color: "#22c55e", background: "#22c55e11" }}>Added</span>
                ) : (
                  <button onClick={() => addScopeItems([{ csiCode: item.csiCode ?? undefined, name: item.name, salePrice: item.salePrice, amount: 0 }])} className="text-xs px-2 py-0.5 rounded font-semibold shrink-0" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}33` }}>+ Add</button>
                )}
              </div>
            );
          };
          const renderGroup = (key: string, label: string, items: EstimateLineItem[], accent: string) => {
            const isOpen = openPickerDivs.has(key);
            const allAdded = items.every(i => addedNames.has(i.name));
            return (
              <div key={key}>
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#0d1117", borderBottom: "1px solid #21262d22" }}>
                  <button onClick={() => setOpenPickerDivs(prev => { const n = new Set(prev); if (isOpen) n.delete(key); else n.add(key); return n; })} className="flex items-center gap-2 flex-1 text-left">
                    <span className="text-xs" style={{ color: "#8b949e" }}>{isOpen ? "▼" : "▶"}</span>
                    <span className="text-xs font-semibold" style={{ color: "#e6edf3" }}>{label}</span>
                  </button>
                  {!allAdded && (
                    <button onClick={() => addScopeItems(items.filter(i => !addedNames.has(i.name)).map(i => ({ csiCode: i.csiCode ?? undefined, name: i.name, salePrice: i.salePrice, amount: 0 })))} className="text-xs px-2 py-0.5 rounded font-semibold shrink-0" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}33` }}>+ Add All</button>
                  )}
                </div>
                {isOpen && items.map(item => renderItem(item, accent))}
              </div>
            );
          };
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowScopePicker(false)}>
              <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: "#161b22", border: "1px solid #30373f", maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
                  <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Add scope to {sub.subName}</h3>
                  <button onClick={() => setShowScopePicker(false)} className="text-xl leading-none" style={{ color: "#8b949e" }}>×</button>
                </div>
                <div className="overflow-y-auto" style={{ background: "#0d1117" }}>
                  <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: "#161b22", color: "#C9A84C", borderBottom: "1px solid #21262d" }}>From Main Contract</div>
                  {estimateDivisions.length === 0 ? (
                    <p className="text-xs text-center py-3" style={{ color: "#4d5566" }}>No contract items for this client.</p>
                  ) : estimateDivisions.map(div => renderGroup(div.divisionId, div.divisionName, div.items, "#C9A84C"))}
                  {coGroups.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: "#161b22", color: "#60a5fa", borderBottom: "1px solid #21262d", borderTop: "1px solid #21262d" }}>From Change Orders</div>
                      {coGroups.map(g => renderGroup(g.key, g.label, g.items, "#60a5fa"))}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Balance bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs" style={{ color: "#8b949e" }}>
          <span>Paid: <span style={{ color: "#22c55e", fontWeight: 700 }}>${fmt(totalPaid)}</span></span>
          <span>Balance: <span style={{ color: balance > 0 ? "#f85149" : "#22c55e", fontWeight: 700 }}>${fmt(Math.abs(balance))}{balance < 0 ? " overpaid" : ""}</span></span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#0d1117" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? "#22c55e" : "#C9A84C" }} />
        </div>
      </div>

      {/* Payments */}
      {sub.payments.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => setPaymentsOpen(v => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            <span className="text-xs" style={{ color: "#8b949e" }}>{paymentsOpen ? "▼" : "▶"}</span>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>Payments</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>{sub.payments.length}</span>
          </button>
          {paymentsOpen && sub.payments.map(p => {
            const isCr = p.amount < 0;
            if (editingPayId === p.id) {
              return (
                <PayForm key={p.id} subId={sub.id} companyId={companyId} clientId={clientId} payment={p}
                  onSave={updated => { onUpdate({ ...sub, payments: sub.payments.map(x => x.id === p.id ? updated : x) }); setEditingPayId(null); }}
                  onCancel={() => setEditingPayId(null)} />
              );
            }
            return (
              <div key={p.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid #21262d" }}>
                <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: "#0d1117" }}>
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: isCr ? "#f8514922" : "#22c55e22", color: isCr ? "#f85149" : "#22c55e", border: `1px solid ${isCr ? "#f8514933" : "#22c55e33"}` }}>{METHOD_LABELS[p.method] ?? p.method}</span>
                    <span className="text-xs font-bold" style={{ color: isCr ? "#f85149" : "#22c55e" }}>{isCr ? "-" : ""}${fmt(Math.abs(p.amount))}</span>
                    <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(p.paidAt + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {p.checkNumber && <span className="text-xs" style={{ color: "#8b949e" }}>#{p.checkNumber}</span>}
                    {p.notes && <span className="text-xs truncate" style={{ color: "#8b949e" }}>{p.notes}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditingPayId(p.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: "#C9A84C", background: "#C9A84C11" }}>Edit</button>
                    <button onClick={() => deletePayment(p.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: "#f85149" }}><TrashIcon size={11} /></button>
                  </div>
                </div>
                {!isCr && (
                  <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#080c14", borderTop: "1px solid #21262d44" }}>
                    <span className="text-xs" style={{ color: "#4d5566" }}>Release:</span>
                    <button
                      onClick={() => setReleasePanel(prev => prev?.payId === p.id && prev.type === "PARTIAL" ? null : { payId: p.id, type: "PARTIAL" })}
                      className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{ color: "#60a5fa", background: releasePanel?.payId === p.id && releasePanel.type === "PARTIAL" ? "#1e3a5f" : "#60a5fa11", border: "1px solid #60a5fa33" }}>
                      Partial Release
                    </button>
                    <button
                      onClick={() => setReleasePanel(prev => prev?.payId === p.id && prev.type === "FINAL" ? null : { payId: p.id, type: "FINAL" })}
                      className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{ color: "#22c55e", background: releasePanel?.payId === p.id && releasePanel.type === "FINAL" ? "#0d2318" : "#22c55e11", border: "1px solid #22c55e33" }}>
                      Final Release
                    </button>
                  </div>
                )}
                {releasePanel?.payId === p.id && !isCr && (
                  <ReleasePanel
                    companyId={companyId}
                    clientId={clientId}
                    subName={sub.subName}
                    subContractorId={sub.subContractorId}
                    initialEmail={subEmail}
                    defaultAmount="10.00"
                    defaultDate={p.paidAt}
                    type={releasePanel.type}
                    onClose={() => setReleasePanel(null)}
                    releases={lienReleases.filter(r => r.subName === sub.subName)}
                    onCreated={onReleaseCreated}
                    onDeleted={onReleaseDeleted}
                    onSubEmailSaved={onSubEmailSaved}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add payment */}
      {showPayForm ? (
        <PayForm subId={sub.id} companyId={companyId} clientId={clientId}
          onSave={p => { onUpdate({ ...sub, payments: [...sub.payments, p] }); setShowPayForm(false); }}
          onCancel={() => setShowPayForm(false)} />
      ) : (
        <button onClick={() => setShowPayForm(true)} className="w-full py-2 rounded-xl text-sm font-semibold" style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e33" }}>
          + Add Payment
        </button>
      )}
      </>
      )}
    </div>
  );
}

// ─── Material Card (per supplier) ─────────────────────────────────────────────
function SupplierCard({
  supplierName, purchases,
  onDelete,
}: {
  supplierName: string; purchases: MaterialPurchase[];
  onDelete: (id: string) => void;
}) {
  const total = purchases.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: "#161b22", border: "1px solid #30373f" }}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>{supplierName}</div>
        <div className="text-sm font-bold px-3 py-1 rounded-lg" style={{ background: total < 0 ? "#f8514922" : "#3b82f622", color: total < 0 ? "#f85149" : "#3b82f6", border: `1px solid ${total < 0 ? "#f8514933" : "#3b82f633"}` }}>
          {total < 0 ? "-" : ""}${fmt(Math.abs(total))}
        </div>
      </div>
      <div className="space-y-1">
        {purchases.map(p => {
          const isCredit = p.amount < 0;
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isCredit && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}>CR</span>}
                <span className="text-xs font-bold" style={{ color: isCredit ? "#f85149" : "#3b82f6" }}>{isCredit ? "-" : ""}${fmt(Math.abs(p.amount))}</span>
                <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(p.purchasedAt + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                {p.description && <span className="text-xs truncate" style={{ color: "#e6edf3" }}>{p.description}</span>}
              </div>
              <button onClick={() => onDelete(p.id)} className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ color: "#f85149" }}>
                <TrashIcon size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ClientFinancialsTab({
  companyId, clientId, clientName, contractTotal,
}: {
  companyId: string; clientId: string; clientName: string; contractTotal: number;
}) {
  const router = useRouter();
  const [clientSubs, setClientSubs] = useState<ClientSub[]>([]);
  const [allSubs, setAllSubs] = useState<SubContractor[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<MaterialPurchase[]>([]);
  const [permitFees, setPermitFees] = useState<PermitFee[]>([]);
  const [estimateDivisions, setEstimateDivisions] = useState<EstimateDivision[]>([]);
  const [lienReleases, setLienReleases] = useState<LienRelease[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Collapsible section state — collapsed by default
  const [scopeRemainingOpen, setScopeRemainingOpen] = useState(false);
  // Scope Remaining is empty by default; the user picks which items to work on
  // from the original contract and change orders.
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [pickContractOpen, setPickContractOpen] = useState(false);
  const [pickCoOpen, setPickCoOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [permitFeesOpen, setPermitFeesOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);

  // Add sub form
  const [selectedSubId, setSelectedSubId] = useState("__new__");
  const [newSubName, setNewSubName] = useState("");
  const [subScope, setSubScope] = useState("");
  const [subDivision, setSubDivision] = useState("");
  const [addingSubForm, setAddingSubForm] = useState(false);

  // Custom scope adder state
  const [customScopeName, setCustomScopeName] = useState("");
  const [customScopeOpen, setCustomScopeOpen] = useState(false);

  // Lookup CSI/division from standard data by best-match against an input name
  function lookupCsi(name: string): { csiCode: string | null; divisionName: string } {
    const lower = name.toLowerCase().trim();
    if (!lower) return { csiCode: null, divisionName: "Custom" };
    // Exact item-name match first
    for (const div of STANDARD_TEMPLATE_DIVISIONS) {
      for (const item of div.items) {
        if (item.name.toLowerCase() === lower) return { csiCode: item.csiCode, divisionName: div.name };
      }
    }
    // Partial: item name contains input or vice versa
    for (const div of STANDARD_TEMPLATE_DIVISIONS) {
      for (const item of div.items) {
        const iname = item.name.toLowerCase();
        if (iname.includes(lower) || lower.includes(iname)) return { csiCode: item.csiCode, divisionName: div.name };
      }
    }
    // Division name match
    for (const div of STANDARD_TEMPLATE_DIVISIONS) {
      if (div.name.toLowerCase().includes(lower) || lower.includes(div.name.toLowerCase())) {
        return { csiCode: div.csiCode, divisionName: div.name };
      }
    }
    return { csiCode: null, divisionName: "Custom" };
  }
  const customCsi = useMemo(() => lookupCsi(customScopeName), [customScopeName]);

  async function addCustomScopeToSub(sub: ClientSub) {
    const trimmed = customScopeName.trim();
    if (!trimmed) return;
    const item: EstimateLineItem = { id: `custom_${Date.now()}`, name: trimmed, csiCode: customCsi.csiCode, salePrice: 0 };
    await addItemToSub(sub, item);
    setCustomScopeName("");
    setCustomScopeOpen(false);
  }
  const [savingSub, setSavingSub] = useState(false);

  // Add material form
  const [selectedSupplierId, setSelectedSupplierId] = useState("__new__");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [matAmount, setMatAmount] = useState("");
  const [matDescChoice, setMatDescChoice] = useState("__custom__");
  const [matDescCustom, setMatDescCustom] = useState("");
  const [matDate, setMatDate] = useState(today());
  const [matNotes, setMatNotes] = useState("");
  const [matIsCredit, setMatIsCredit] = useState(false);
  const [addingMatForm, setAddingMatForm] = useState(false);
  const [savingMat, setSavingMat] = useState(false);

  // Add permit/engineering fee form
  const [permitName, setPermitName] = useState("");
  const [permitAmount, setPermitAmount] = useState("");
  const [permitDesc, setPermitDesc] = useState("");
  const [permitDate, setPermitDate] = useState(today());
  const [permitNotes, setPermitNotes] = useState("");
  const [addingPermitForm, setAddingPermitForm] = useState(false);
  const [savingPermit, setSavingPermit] = useState(false);

  const load = useCallback(async () => {
    const [subsRes, allSubsRes, suppliersRes, matsRes, permitsRes, itemsRes, lienRes, invRes, coRes] = await Promise.all([
      fetch(`/api/${companyId}/clients/${clientId}/financials/subs`),
      fetch(`/api/${companyId}/subs`),
      fetch(`/api/${companyId}/suppliers`),
      fetch(`/api/${companyId}/clients/${clientId}/financials/materials`),
      fetch(`/api/${companyId}/clients/${clientId}/financials/permit-fees`),
      fetch(`/api/${companyId}/clients/${clientId}/estimate-items`),
      fetch(`/api/${companyId}/clients/${clientId}/lien-releases`),
      fetch(`/api/${companyId}/clients/${clientId}/invoices`),
      fetch(`/api/${companyId}/clients/${clientId}/change-orders`),
    ]);
    const [subs, allSubsList, suppliersList, matsList, permitsList, itemsList, lienList, invList, coList] = await Promise.all([
      subsRes.json(), allSubsRes.json(), suppliersRes.json(), matsRes.json(), permitsRes.json(), itemsRes.json(), lienRes.json(), invRes.json(), coRes.json(),
    ]);
    setClientSubs(subs);
    setAllSubs(Array.isArray(allSubsList) ? allSubsList.sort((a: SubContractor, b: SubContractor) => a.name.localeCompare(b.name)) : []);
    setSuppliers(Array.isArray(suppliersList) ? suppliersList : []);
    setMaterials(Array.isArray(matsList) ? matsList : []);
    setPermitFees(Array.isArray(permitsList) ? permitsList : []);
    setEstimateDivisions(Array.isArray(itemsList) ? itemsList : []);
    setLienReleases(Array.isArray(lienList) ? lienList : []);
    setInvoices(Array.isArray(invList) ? invList : []);
    setChangeOrders(Array.isArray(coList) ? coList : []);
    setLoading(false);
  }, [companyId, clientId]);

  useEffect(() => { load(); }, [load]);

  async function addSub() {
    setSavingSub(true);
    try {
      let subContractorId: string | null = null;
      let subName = newSubName.trim();
      if (selectedSubId !== "__new__") {
        subContractorId = selectedSubId;
        subName = allSubs.find(s => s.id === selectedSubId)?.name ?? "";
      }
      if (!subName) return;
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subContractorId, subName, scope: subScope || null, division: subDivision || null }),
      });
      if (res.ok) {
        const newSub = await res.json();
        newSub.subName = newSub.subName ?? subName;
        setClientSubs(prev => [...prev, newSub]);
        setNewSubName(""); setSubScope(""); setSubDivision(""); setSelectedSubId("__new__"); setAddingSubForm(false);
      }
    } finally { setSavingSub(false); }
  }

  async function addMaterial() {
    if (!matAmount || isNaN(Number(matAmount))) return;
    setSavingMat(true);
    try {
      let supplierId = selectedSupplierId;
      if (selectedSupplierId === "__new__") {
        if (!newSupplierName.trim()) return;
        const res = await fetch(`/api/${companyId}/suppliers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newSupplierName.trim() }),
        });
        const newSupplier = await res.json();
        supplierId = newSupplier.id;
        setSuppliers(prev => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedSupplierId(newSupplier.id);
      }
      const description = matDescChoice === "__custom__" ? (matDescCustom.trim() || null) : matDescChoice;
      const rawAmount = Number(matAmount);
      const finalAmount = matIsCredit ? -Math.abs(rawAmount) : Math.abs(rawAmount);
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, amount: finalAmount, description, purchasedAt: matDate, notes: matNotes || null }),
      });
      if (res.ok) {
        const purchase = await res.json();
        setMaterials(prev => [purchase, ...prev]);
        setMatAmount(""); setMatDescChoice("__custom__"); setMatDescCustom(""); setMatNotes(""); setMatIsCredit(false); setNewSupplierName(""); setAddingMatForm(false);
      }
    } finally { setSavingMat(false); }
  }

  async function deleteMaterial(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/financials/materials?id=${id}`, { method: "DELETE" });
    setMaterials(prev => prev.filter(p => p.id !== id));
  }

  async function addPermitFee() {
    if (!permitAmount || isNaN(Number(permitAmount))) return;
    setSavingPermit(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/permit-fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: permitName.trim() || null, amount: Math.abs(Number(permitAmount)), description: permitDesc.trim() || null, incurredAt: permitDate, notes: permitNotes || null }),
      });
      if (res.ok) {
        const fee = await res.json();
        setPermitFees(prev => [fee, ...prev]);
        setPermitName(""); setPermitAmount(""); setPermitDesc(""); setPermitDate(today()); setPermitNotes(""); setAddingPermitForm(false);
      }
    } finally { setSavingPermit(false); }
  }

  async function deletePermitFee(id: string) {
    await fetch(`/api/${companyId}/clients/${clientId}/financials/permit-fees?id=${id}`, { method: "DELETE" });
    setPermitFees(prev => prev.filter(f => f.id !== id));
  }

  function handleReleaseCreated(r: LienRelease) {
    setLienReleases(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) return prev.map((x, i) => i === idx ? r : x);
      return [r, ...prev];
    });
  }

  function handleReleaseDeleted(id: string) {
    setLienReleases(prev => prev.filter(r => r.id !== id));
  }

  function handleSubEmailSaved(subContractorId: string, email: string) {
    setAllSubs(prev => prev.map(s => s.id === subContractorId ? { ...s, email } : s));
  }

  // Remaining scope items: estimate + CO line items minus anything already given to a sub or bought as material.
  // Aggressive normalization (strip CSI prefix, lowercase, collapse all non-alphanumerics to single spaces) so
  // "03 30 00 — Concrete Slab", "Concrete-Slab", and "concrete slab" all collapse to the same key.
  const normName = (s: string) =>
    (s ?? "")
      // Strip a leading CSI code in any common form: "03 30 00", "03-30-00", "033000", with or without a separator like —, -, :, |, ·
      .replace(/^\s*\d{2}[\s\-_/]*\d{2}[\s\-_/]*\d{2}[\s—\-:|·.]*/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const normCsi = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "").toLowerCase();

  // Assigned to subs — match on composite (csi + name) AND on name alone, so an item that was renamed
  // slightly when added still drops out of the remaining pool.
  const assignedNameSet = useMemo(
    () => new Set(clientSubs.flatMap(sub => sub.scopeItems.map(i => normName(i.name)))),
    [clientSubs]
  );
  const assignedCsiNameSet = useMemo(
    () => new Set(clientSubs.flatMap(sub => sub.scopeItems.map(i => `${normCsi(i.csiCode)}|${normName(i.name)}`))),
    [clientSubs]
  );
  // Material purchases consume scope too — match by description name.
  const materialNameSet = useMemo(
    () => new Set(materials.map(m => normName(m.description ?? "")).filter(Boolean)),
    [materials]
  );

  // Include items from change orders in the scope pool so they're assignable to subs too.
  const coDivisions = useMemo<EstimateDivision[]>(() => {
    const byCode = new Map<string, EstimateLineItem[]>();
    const nameByCode = new Map<string, string>();
    for (const co of changeOrders) {
      for (const it of co.items) {
        const csi = (it.csiCode ?? "").replace(/\s/g, "");
        const divCode = csi ? `${csi.slice(0, 2)} 00 00` : "CO 00 00";
        const divName = it.divisionName?.trim() || "Change Order Items";
        nameByCode.set(divCode, divName);
        const sale =
          (parseFloat(it.qty ?? "") || 0) *
          (parseFloat(it.unitCost ?? "") || 0) *
          (1 + (parseFloat(it.markupPct ?? "") || 0) / 100);
        if (!byCode.has(divCode)) byCode.set(divCode, []);
        byCode.get(divCode)!.push({ id: `co_${it.id}`, name: it.name, csiCode: it.csiCode ?? null, salePrice: Math.round(sale * 100) / 100 });
      }
    }
    return Array.from(byCode.entries()).map(([code, items]) => ({
      divisionId: `co_${code}`,
      divisionName: `${nameByCode.get(code)} (CO)`,
      csiCode: code,
      items,
    }));
  }, [changeOrders]);

  // An item is "consumed" once it's been given to a sub or bought as material.
  const isConsumed = useCallback((i: EstimateLineItem) => {
    const name = normName(i.name);
    if (!name) return true;
    const key = `${normCsi(i.csiCode)}|${name}`;
    return assignedCsiNameSet.has(key) || assignedNameSet.has(name) || materialNameSet.has(name);
  }, [assignedCsiNameSet, assignedNameSet, materialNameSet]);

  // Displayed scope = ONLY the items the user has picked (empty by default), minus consumed.
  const remainingByDiv = useMemo(() => {
    const combined = [...estimateDivisions, ...coDivisions];
    const seen = new Set<string>();
    return combined
      .map(div => ({ ...div, items: div.items.filter(i => {
        if (!pickedIds.has(i.id) || isConsumed(i)) return false;
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      }) }))
      .filter(div => div.items.length > 0);
  }, [estimateDivisions, coDivisions, pickedIds, isConsumed]);
  const totalRemaining = remainingByDiv.reduce((s, d) => s + d.items.length, 0);

  // Pools for the pickers: items not yet picked and not consumed.
  const availableFrom = useCallback((divs: EstimateDivision[]) => divs
    .map(div => ({ ...div, items: div.items.filter(i => !pickedIds.has(i.id) && !isConsumed(i)) }))
    .filter(div => div.items.length > 0), [pickedIds, isConsumed]);
  const contractAvailable = useMemo(() => availableFrom(estimateDivisions), [availableFrom, estimateDivisions]);
  // Change-order scope grouped BY CHANGE ORDER (CO #1, CO #2 …), not by CSI.
  const coByOrder = useMemo(() => changeOrders.map(co => {
    const items = co.items.map(it => {
      const sale = (parseFloat(it.qty ?? "") || 0) * (parseFloat(it.unitCost ?? "") || 0) * (1 + (parseFloat(it.markupPct ?? "") || 0) / 100);
      return { id: `co_${it.id}`, name: it.name, csiCode: it.csiCode ?? null, salePrice: Math.round(sale * 100) / 100 };
    }).filter(i => !pickedIds.has(i.id) && !isConsumed(i));
    const num = co.orderNumber ? `CO #${co.orderNumber}` : "CO";
    return { key: co.id, label: co.title ? `${num} — ${co.title}` : num, items };
  }).filter(g => g.items.length > 0), [changeOrders, pickedIds, isConsumed]);
  const coAvailableCount = coByOrder.reduce((s, g) => s + g.items.length, 0);
  // All change-order items grouped by CO (unfiltered) — for the SubCard "+ Add Items" popup, which marks Added per its own scope.
  const coGroupsAll = useMemo(() => changeOrders.map(co => {
    const items = co.items.map(it => {
      const sale = (parseFloat(it.qty ?? "") || 0) * (parseFloat(it.unitCost ?? "") || 0) * (1 + (parseFloat(it.markupPct ?? "") || 0) / 100);
      return { id: `co_${it.id}`, name: it.name, csiCode: it.csiCode ?? null, salePrice: Math.round(sale * 100) / 100 };
    });
    const num = co.orderNumber ? `CO #${co.orderNumber}` : "CO";
    return { key: co.id, label: co.title ? `${num} — ${co.title}` : num, items };
  }).filter(g => g.items.length > 0), [changeOrders]);
  function pickItem(id: string) { setPickedIds(prev => new Set(prev).add(id)); }
  function unpickItem(id: string) { setPickedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }

  async function addItemsToSub(sub: ClientSub, items: EstimateLineItem[]) {
    if (items.length === 0) return;
    const res = await fetch(`/api/${companyId}/clients/${clientId}/financials/subs/${sub.id}/scope`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map(item => ({ csiCode: item.csiCode, name: item.name, salePrice: item.salePrice, amount: 0 })) }),
    });
    if (res.ok) {
      const data = await res.json();
      setClientSubs(prev => prev.map(s => s.id === sub.id ? { ...s, contractAmount: data.contractAmount, scopeItems: [...s.scopeItems, ...data.items] } : s));
    }
  }
  const addItemToSub = (sub: ClientSub, item: EstimateLineItem) => addItemsToSub(sub, [item]);

  // Computed totals
  const totalContracted = clientSubs.reduce((s, sub) => s + (sub.scopeItems.length > 0 ? sub.scopeItems.reduce((ss, i) => ss + i.amount, 0) : sub.contractAmount), 0);
  const totalLaborPaid = clientSubs.reduce((s, sub) => s + sub.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalLaborBalance = totalContracted - totalLaborPaid;
  const totalMaterials = materials.reduce((s, p) => s + p.amount, 0);
  const totalPermits = permitFees.reduce((s, f) => s + f.amount, 0);
  const totalExpenses = totalContracted + totalMaterials + totalPermits;
  const netProfit = contractTotal - totalExpenses;
  // Client statement totals
  function coTotal(co: ChangeOrder): number {
    return co.items.reduce((s, i) => {
      const q = parseFloat(i.qty ?? "") || 0;
      const c = parseFloat(i.unitCost ?? "") || 0;
      const m = parseFloat(i.markupPct ?? "") || 0;
      return s + q * c * (1 + m / 100);
    }, 0);
  }
  // Only approved or signed change orders count toward what the client owes
  const approvedChangeOrders = changeOrders.filter(co => co.status === "APPROVED" || !!co.signedAt);
  const totalChangeOrders = approvedChangeOrders.reduce((s, co) => s + coTotal(co), 0);
  // Draft invoices aren't real yet — exclude them from the invoiced total.
  const countedInvoices = invoices.filter(inv => inv.status !== "DRAFT");
  const rawInvoiced = countedInvoices.reduce((s, inv) => s + inv.amount, 0);
  const totalInvoicePct = countedInvoices.reduce((s, inv) => s + (typeof inv.pct === "number" ? inv.pct : Number(inv.pct ?? 0)), 0);
  const fullyInvoiced = totalInvoicePct >= 99.5 || (contractTotal > 0 && Math.abs(contractTotal - rawInvoiced) <= Math.max(200, contractTotal * 0.005));
  const totalInvoiced = fullyInvoiced ? contractTotal : rawInvoiced;
  const invoicePaid = invoices.reduce((s, inv) => s + inv.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const coPaid = approvedChangeOrders.reduce((s, co) => s + (co.payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0), 0);
  const totalClientPaid = invoicePaid + coPaid;
  const totalBilled = totalInvoiced + totalChangeOrders;
  const clientBalance = totalBilled - totalClientPaid;

  // Auto-sync netProfit → internalProfitOverride on the client's estimate
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      fetch(`/api/${companyId}/clients/${clientId}/financials/sync-profit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netProfit, hasExpenses: totalExpenses > 0 }),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [netProfit, totalExpenses, companyId, clientId, loading]);

  // Group materials by supplier
  const matsBySupplier: Record<string, MaterialPurchase[]> = {};
  for (const m of materials) {
    if (!matsBySupplier[m.supplierName]) matsBySupplier[m.supplierName] = [];
    matsBySupplier[m.supplierName].push(m);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function printStatement() {
    const win = window.open("", "_blank");
    if (!win) return;

    const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const invoiceRows = invoices.length === 0
      ? `<tr><td colspan="3" style="padding:12px;color:#64748b;font-style:italic">No invoices issued yet.</td></tr>`
      : invoices.map((inv, idx) => `<tr><td style="padding:8px 12px;color:#1e293b">Invoice #${idx + 1}${inv.status ? ` (${inv.status})` : ""}</td><td style="padding:8px 12px;color:#475569">Invoice</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(inv.amount)}</td></tr>`).join("");

    const coRows = approvedChangeOrders.length === 0
      ? ""
      : approvedChangeOrders.map(co => `<tr><td style="padding:8px 12px;color:#1e293b">${co.orderNumber ? `CO #${co.orderNumber} — ` : ""}${co.title}${co.signedAt ? ` (signed ${fmtDate(co.signedAt)})` : ""}</td><td style="padding:8px 12px;color:#92400e">Change Order</td><td style="padding:8px 12px;text-align:right;color:#1e293b;font-weight:600">$${fmt(coTotal(co))}</td></tr>`).join("");

    const paymentRows = invoices.flatMap((inv, idx) => inv.payments.map(p => `<tr><td style="padding:6px 12px 6px 24px;color:#475569;font-size:13px">Payment toward Invoice #${idx + 1}</td><td style="padding:6px 12px;color:#22c55e;font-size:13px">Payment</td><td style="padding:6px 12px;text-align:right;color:#22c55e;font-size:13px">-$${fmt(p.amount)}</td></tr>`)).join("");

    win.document.write(`<!DOCTYPE html><html><head><title>Client Statement — ${clientName}</title><style>
      body{font-family:Helvetica,sans-serif;max-width:800px;margin:40px auto;color:#1e293b}
      h1{font-size:22px;margin-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e293b;color:#fff;padding:10px 12px;text-align:left;font-size:13px}
      td{border-bottom:1px solid #e2e8f0;font-size:14px}
      .group-header{background:#f1f5f9;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:12px;color:#475569}
      .subtotal{background:#f8fafc;font-weight:700}
      .balance{background:#1e293b;color:#C9A84C;font-weight:700;font-size:16px}
      .paid{background:#0d2318;color:#22c55e;font-weight:700;font-size:14px}
      @media print{body{margin:20px}}
    </style></head><body>
<h1>Client Statement</h1>
<p style="color:#64748b;font-size:14px">${clientName} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>

<div style="display:flex;gap:18px;margin:24px 0;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;flex-wrap:wrap">
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Invoices</div><div style="font-size:22px;font-weight:800;color:#1e293b">$${fmt(totalInvoiced)}</div></div>
  <div style="font-size:24px;color:#94a3b8;align-self:center">+</div>
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Change Orders</div><div style="font-size:22px;font-weight:800;color:#92400e">$${fmt(totalChangeOrders)}</div></div>
  <div style="font-size:24px;color:#94a3b8;align-self:center">−</div>
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Payments</div><div style="font-size:22px;font-weight:800;color:#22c55e">$${fmt(totalClientPaid)}</div></div>
  <div style="font-size:24px;color:#94a3b8;align-self:center">=</div>
  <div style="flex:1;min-width:140px"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Balance Due</div><div style="font-size:22px;font-weight:800;color:${clientBalance > 0 ? "#dc2626" : "#16a34a"}">$${fmt(Math.abs(clientBalance))}${clientBalance < 0 ? " CR" : ""}</div></div>
</div>

<table><thead><tr><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>

<tr class="group-header"><td colspan="3" style="padding:8px 12px">Invoices</td></tr>
${invoiceRows}
<tr class="subtotal"><td colspan="2" style="padding:10px 12px">Total Invoiced</td><td style="padding:10px 12px;text-align:right">$${fmt(totalInvoiced)}</td></tr>

${approvedChangeOrders.length > 0 ? `
<tr class="group-header"><td colspan="3" style="padding:8px 12px">Change Orders</td></tr>
${coRows}
<tr class="subtotal"><td colspan="2" style="padding:10px 12px">Total Change Orders</td><td style="padding:10px 12px;text-align:right">$${fmt(totalChangeOrders)}</td></tr>` : ""}

<tr class="subtotal"><td colspan="2" style="padding:10px 12px">Total Billed (Invoices + Change Orders)</td><td style="padding:10px 12px;text-align:right">$${fmt(totalBilled)}</td></tr>

${paymentRows ? `
<tr class="group-header"><td colspan="3" style="padding:8px 12px">Payments Received</td></tr>
${paymentRows}
<tr class="paid"><td colspan="2" style="padding:10px 12px">Total Paid</td><td style="padding:10px 12px;text-align:right">-$${fmt(totalClientPaid)}</td></tr>` : `
<tr><td colspan="3" style="padding:12px;color:#64748b;font-style:italic">No payments received yet.</td></tr>`}

<tr class="balance"><td colspan="2" style="padding:14px 12px">${clientBalance >= 0 ? "BALANCE DUE" : "CREDIT"}</td><td style="padding:14px 12px;text-align:right">$${fmt(Math.abs(clientBalance))}</td></tr>

</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  if (loading) return <div className="text-center py-12 text-sm" style={{ color: "#8b949e" }}>Loading financials…</div>;

  return (
    <div className="space-y-6">

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Contract Value", value: contractTotal, color: "#C9A84C" },
          { label: "Total Expenses", value: totalExpenses, color: "#f85149" },
          { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "#22c55e" : "#f85149" },
        ].map(card => {
          const text = `$${fmt(card.value)}`;
          // Auto-shrink so long numbers fit. Base = 20px; step down by length.
          const fontSize = text.length >= 14 ? 14 : text.length >= 12 ? 16 : text.length >= 10 ? 18 : 22;
          return (
            <div key={card.label} className="rounded-2xl p-4 min-w-0 overflow-hidden" style={{ background: "#161b22", border: "1px solid #30373f" }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1 truncate" style={{ color: "#8b949e" }}>{card.label}</div>
              <div className="font-bold whitespace-nowrap" style={{ color: card.color, fontSize, lineHeight: 1.1 }}>{text}</div>
            </div>
          );
        })}
      </div>

      {/* Sub breakdown under summary */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: "Sub Contracted", value: totalContracted, color: "#C9A84C" },
          { label: "Labor Paid", value: totalLaborPaid, color: "#22c55e" },
          { label: "Balance Owed to Subs", value: totalLaborBalance, color: "#f85149" },
          { label: "Balance Owed to MIBH", value: clientBalance, color: clientBalance < totalLaborBalance ? "#f85149" : "#22c55e", warn: clientBalance < totalLaborBalance, clickable: true },
          { label: "Permits & Eng.", value: totalPermits, color: "#a371f7" },
          { label: "Materials", value: totalMaterials, color: "#3b82f6" },
        ].map(card => {
          const text = `$${fmt(card.value)}`;
          const fontSize = text.length >= 14 ? 12 : text.length >= 12 ? 13 : text.length >= 10 ? 15 : 16;
          const warn = (card as { warn?: boolean }).warn;
          const clickable = (card as { clickable?: boolean }).clickable;
          const content = (
            <>
              <div className="text-xs uppercase tracking-widest mb-1 truncate" style={{ color: "#8b949e" }}>{card.label}</div>
              <div className="font-bold whitespace-nowrap" style={{ color: card.color, fontSize, lineHeight: 1.1 }}>{text}</div>
            </>
          );
          if (clickable) {
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => router.push(`/${companyId}/clients/${clientId}?tab=invoices-co`)}
                className="rounded-xl px-4 py-3 min-w-0 overflow-hidden text-left transition-colors hover:opacity-90"
                style={{ background: warn ? "#2d1010" : "#0d1117", border: `1px solid ${warn ? "#dc262644" : "#21262d"}`, cursor: "pointer" }}
                title="Open Invoices & CO's"
              >
                {content}
              </button>
            );
          }
          return (
            <div key={card.label} className="rounded-xl px-4 py-3 min-w-0 overflow-hidden" style={{ background: warn ? "#2d1010" : "#0d1117", border: `1px solid ${warn ? "#dc262644" : "#21262d"}` }}>
              {content}
            </div>
          );
        })}
      </div>

      {/* Print Statement moved to the Invoices & CO's tab. */}

      {/* ── Scope of Work Remaining ── */}
      {/* Show whenever there are estimate items, change-order items, OR existing subs (so the custom-scope adder is always reachable). */}
      {(estimateDivisions.length > 0 || coDivisions.length > 0 || clientSubs.length > 0) && (
        <div className="space-y-3">
          <button
            onClick={() => setScopeRemainingOpen(v => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            <span className="text-xs" style={{ color: "#8b949e" }}>{scopeRemainingOpen ? "▼" : "▶"}</span>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#8b949e" }}>Scope Remaining</h2>
            {totalRemaining > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>{totalRemaining}</span>
            )}
          </button>
          {scopeRemainingOpen && (
            <>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #21262d" }}>
              {totalRemaining === 0 && (
                <div className="px-4 py-3 text-xs text-center" style={{ background: "#0d1117", color: "#8b949e" }}>
                  No scope selected. Add items from the original contract or change orders below.
                </div>
              )}
              {remainingByDiv.map((div, di) => (
                <div key={div.divisionId}>
                  {/* Division header */}
                  <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: "#0d1117", color: "#C9A84C", borderBottom: "1px solid #21262d" }}>
                    {div.csiCode ? `${div.csiCode.slice(0, 2)} · ` : ""}{div.divisionName}
                  </div>
                  {div.items.map((item, ii) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5" style={{ background: ii % 2 === 0 ? "#0d1117" : "#111820", borderBottom: di < remainingByDiv.length - 1 || ii < div.items.length - 1 ? "1px solid #21262d22" : undefined }}>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm" style={{ color: "#e6edf3" }}>{item.name}</span>
                        {item.salePrice > 0 && (
                          <span className="ml-2 text-xs" style={{ color: "#8b949e" }}>${fmt(item.salePrice)}</span>
                        )}
                      </div>
                      {clientSubs.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          <span className="text-xs" style={{ color: "#4d5566" }}>Add to:</span>
                          {clientSubs.map(sub => (
                            <button
                              key={sub.id}
                              onClick={() => addItemToSub(sub, item)}
                              className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 transition-colors"
                              style={{ background: "#C9A84C18", color: "#C9A84C", border: "1px solid #C9A84C33" }}
                              title={`Add "${item.name}" to ${sub.subName}`}
                            >
                              {sub.subName}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => unpickItem(item.id)}
                        className="text-xs px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: "#8b949e", border: "1px solid #30373f" }}
                        title="Remove from scope list"
                      >✕</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Pick scope to work on — from the original contract and change orders */}
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={() => setPickContractOpen(v => !v)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "#C9A84C18", color: "#C9A84C", border: "1px solid #C9A84C33" }}>
                {pickContractOpen ? "▼" : "▶"} Add from Original Contract{(() => { const n = contractAvailable.reduce((s, d) => s + d.items.length, 0); return n > 0 ? ` (${n})` : ""; })()}
              </button>
              {changeOrders.length > 0 && (
                <button onClick={() => setPickCoOpen(v => !v)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: "#60a5fa18", color: "#60a5fa", border: "1px solid #60a5fa33" }}>
                  {pickCoOpen ? "▼" : "▶"} Add from Change Orders{coAvailableCount > 0 ? ` (${coAvailableCount})` : ""}
                </button>
              )}
            </div>
            {pickContractOpen && <ScopePicker divs={contractAvailable} onPick={pickItem} accent="#C9A84C" emptyLabel="No more contract items to add." />}
            {pickCoOpen && <CoScopePicker groups={coByOrder} onPick={pickItem} subs={clientSubs} onTransferAll={addItemsToSub} />}

            {/* Custom scope adder — system auto-detects CSI from item name */}
            <div className="rounded-2xl mt-2 p-3" style={{ background: "#161b22", border: "1px dashed #30373f" }}>
              {!customScopeOpen ? (
                <button onClick={() => setCustomScopeOpen(true)} className="text-xs font-semibold" style={{ color: "#C9A84C" }}>
                  + Add custom scope item
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={customScopeName}
                      onChange={e => setCustomScopeName(e.target.value)}
                      placeholder="Scope item name (e.g. Roof Tile Replacement)"
                      className="flex-1 rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }}
                    />
                    <button onClick={() => { setCustomScopeOpen(false); setCustomScopeName(""); }} className="text-xs px-2 py-1.5 rounded" style={{ color: "#8b949e", background: "#1e2736" }}>Cancel</button>
                  </div>
                  {customScopeName.trim() && (
                    <p className="text-xs" style={{ color: "#8b949e" }}>
                      Detected: <span style={{ color: "#C9A84C" }}>{customCsi.csiCode ?? "—"} · {customCsi.divisionName}</span>
                    </p>
                  )}
                  {customScopeName.trim() && clientSubs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs" style={{ color: "#4d5566" }}>Add to:</span>
                      {clientSubs.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => addCustomScopeToSub(sub)}
                          className="text-xs px-2 py-0.5 rounded-full font-semibold transition-colors"
                          style={{ background: "#C9A84C18", color: "#C9A84C", border: "1px solid #C9A84C33" }}
                          title={`Add "${customScopeName.trim()}" to ${sub.subName}`}
                        >
                          {sub.subName}
                        </button>
                      ))}
                    </div>
                  )}
                  {customScopeName.trim() && clientSubs.length === 0 && (
                    <p className="text-xs" style={{ color: "#f59e0b" }}>Add a subcontractor first to assign this scope item.</p>
                  )}
                </div>
              )}
            </div>
            </>
          )}
        </div>
      )}

      {/* ── Section 1: Subcontractors ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setSubsOpen(v => !v)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <span className="text-xs" style={{ color: "#C9A84C" }}>{subsOpen ? "▼" : "▶"}</span>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>Subcontractors</h2>
            {clientSubs.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>{clientSubs.length}</span>
            )}
          </button>
          {subsOpen && !addingSubForm && (
            <button onClick={() => setAddingSubForm(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0" style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}>+ Add Sub</button>
          )}
        </div>

        {subsOpen && addingSubForm && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1421", border: "1px solid #C9A84C44" }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>Add Subcontractor</div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Sub</label>
              <select value={selectedSubId} onChange={e => setSelectedSubId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
                <option value="__new__">+ New sub (type name below)</option>
                {allSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {selectedSubId === "__new__" && (
              <input value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Sub name" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Division</label>
                <DivisionPicker value={subDivision} onChange={setSubDivision} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Trade / Role</label>
                <select value={subScope} onChange={e => setSubScope(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: subScope ? "#e6edf3" : "#8b949e" }}>
                  <option value="">— Select Trade —</option>
                  {STANDARD_TEMPLATE_DIVISIONS.map(d => (
                    <optgroup key={d.csiCode} label={`${d.csiCode.slice(0, 2)} · ${d.name}`}>
                      {d.items.map(item => (
                        <option key={item.csiCode} value={item.name}>{item.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addSub} disabled={savingSub || (selectedSubId === "__new__" && !newSubName.trim())} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: "#C9A84C", color: "#0d1117" }}>{savingSub ? "Saving…" : "Add Sub"}</button>
              <button onClick={() => { setAddingSubForm(false); setSubScope(""); setSubDivision(""); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        )}

        {subsOpen && clientSubs.length === 0 && !addingSubForm && (
          <p className="text-sm text-center py-6" style={{ color: "#8b949e" }}>No subs added yet.</p>
        )}

        {subsOpen && (
          <div className="space-y-4">
            {clientSubs.map(sub => (
              <SubCard
                key={sub.id}
                sub={sub}
                companyId={companyId}
                clientId={clientId}
                clientName={clientName}
                estimateDivisions={estimateDivisions}
                coGroups={coGroupsAll}
                onUpdate={updated => setClientSubs(prev => prev.map(s => s.id === updated.id ? updated : s))}
                onDelete={id => setClientSubs(prev => prev.filter(s => s.id !== id))}
                lienReleases={lienReleases.filter(r => r.subName === sub.subName)}
                onReleaseCreated={handleReleaseCreated}
                onReleaseDeleted={handleReleaseDeleted}
                subEmail={allSubs.find(s => s.id === sub.subContractorId)?.email ?? ""}
                onSubEmailSaved={handleSubEmailSaved}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Permit & Engineering Fees ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setPermitFeesOpen(v => !v)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <span className="text-xs" style={{ color: "#a371f7" }}>{permitFeesOpen ? "▼" : "▶"}</span>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#a371f7" }}>Permit &amp; Engineering Fees</h2>
            {permitFees.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#a371f722", color: "#a371f7", border: "1px solid #a371f744" }}>{permitFees.length}</span>
            )}
          </button>
          {permitFeesOpen && !addingPermitForm && (
            <button onClick={() => setAddingPermitForm(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0" style={{ background: "#a371f722", color: "#a371f7", border: "1px solid #a371f744" }}>+ Add Fee</button>
          )}
        </div>

        {permitFeesOpen && addingPermitForm && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1421", border: "1px solid #a371f744" }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a371f7" }}>Add Permit / Engineering Fee</div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Name</label>
              <input value={permitName} onChange={e => setPermitName(e.target.value)} placeholder="e.g. Miami-Dade Permit Office, ABC Engineering" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Amount</label>
                <FormulaInput value={permitAmount} onChange={n => setPermitAmount(String(n))} placeholder="0.00 or =100+50" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Date</label>
                <DatePickerInput value={permitDate} onChange={setPermitDate} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Description</label>
              <input value={permitDesc} onChange={e => setPermitDesc(e.target.value)} placeholder="e.g. City building permit, structural engineering" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            </div>
            <input value={permitNotes} onChange={e => setPermitNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            <div className="flex gap-2">
              <button
                onClick={addPermitFee}
                disabled={savingPermit || !permitAmount}
                className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "#a371f7", color: "#fff" }}
              >
                {savingPermit ? "Saving…" : "Add Fee"}
              </button>
              <button onClick={() => setAddingPermitForm(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        )}

        {permitFeesOpen && permitFees.length === 0 && !addingPermitForm && (
          <p className="text-sm text-center py-6" style={{ color: "#8b949e" }}>No permit or engineering fees yet.</p>
        )}

        {permitFeesOpen && permitFees.length > 0 && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#161b22", border: "1px solid #30373f" }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>Fees</div>
              <div className="text-sm font-bold px-3 py-1 rounded-lg" style={{ background: "#a371f722", color: "#a371f7", border: "1px solid #a371f733" }}>
                ${fmt(totalPermits)}
              </div>
            </div>
            <div className="space-y-1">
              {permitFees.map(f => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xs font-bold" style={{ color: "#a371f7" }}>${fmt(f.amount)}</span>
                    {f.name && <span className="text-xs font-semibold truncate" style={{ color: "#e6edf3" }}>{f.name}</span>}
                    <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(f.incurredAt + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    {f.description && <span className="text-xs truncate" style={{ color: "#8b949e" }}>{f.description}</span>}
                    {f.notes && <span className="text-xs truncate" style={{ color: "#4d5566" }}>{f.notes}</span>}
                  </div>
                  <button onClick={() => deletePermitFee(f.id)} className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ color: "#f85149" }}>
                    <TrashIcon size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Materials / COGS ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setMaterialsOpen(v => !v)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <span className="text-xs" style={{ color: "#3b82f6" }}>{materialsOpen ? "▼" : "▶"}</span>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>Materials / COGS</h2>
            {Object.keys(matsBySupplier).length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}>{Object.keys(matsBySupplier).length}</span>
            )}
          </button>
          {materialsOpen && !addingMatForm && (
            <button onClick={() => setAddingMatForm(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0" style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644" }}>+ Add Purchase</button>
          )}
        </div>

        {materialsOpen && addingMatForm && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#0d1421", border: "1px solid #3b82f644" }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>
                {matIsCredit ? "Log Supplier Credit" : "Add Material Purchase"}
              </div>
              {/* Credit toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setMatIsCredit(c => !c)}
                  className="w-9 h-5 rounded-full transition-colors relative"
                  style={{ background: matIsCredit ? "#f85149" : "#30373f" }}
                >
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: matIsCredit ? "18px" : "2px" }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: matIsCredit ? "#f85149" : "#8b949e" }}>
                  {matIsCredit ? "Credit from supplier" : "Purchase"}
                </span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Supplier</label>
                <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}>
                  <option value="__new__">+ New supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Amount</label>
                <FormulaInput value={matAmount} onChange={n => setMatAmount(String(n))} placeholder="0.00 or =100+50" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Date</label>
                <DatePickerInput value={matDate} onChange={setMatDate} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "#8b949e" }}>Description</label>
                <select
                  value={matDescChoice}
                  onChange={e => setMatDescChoice(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                >
                  <option value="__custom__">Custom…</option>
                  {estimateDivisions.flatMap(d => d.items).map(item => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedSupplierId === "__new__" && (
              <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Supplier name" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            {matDescChoice === "__custom__" && (
              <input value={matDescCustom} onChange={e => setMatDescCustom(e.target.value)} placeholder="Describe what was purchased" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
            )}
            <div className="flex gap-2">
              <button
                onClick={addMaterial}
                disabled={savingMat || !matAmount}
                className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: matIsCredit ? "#f85149" : "#3b82f6", color: "#fff" }}
              >
                {savingMat ? "Saving…" : matIsCredit ? "Log Credit" : "Add Purchase"}
              </button>
              <button onClick={() => { setAddingMatForm(false); setMatIsCredit(false); }} className="px-4 py-2 rounded-xl text-sm" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        )}

        {materialsOpen && Object.keys(matsBySupplier).length === 0 && !addingMatForm && (
          <p className="text-sm text-center py-6" style={{ color: "#8b949e" }}>No material purchases yet.</p>
        )}

        {materialsOpen && (
          <div className="space-y-4">
            {Object.entries(matsBySupplier).sort(([a], [b]) => a.localeCompare(b)).map(([supplierName, purchases]) => (
              <SupplierCard
                key={supplierName}
                supplierName={supplierName}
                purchases={purchases}
                onDelete={deleteMaterial}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
