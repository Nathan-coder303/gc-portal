"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const GOLD = "#C9A84C";
const BG = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30373f";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

const $$ = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Line = {
  id?: string;
  sortOrder: number;
  itemNumber: string;
  description: string;
  scheduledValue: number;
  fromPrevious: number;
  thisInvoice: number;
  retainageThis: number;
  retainageTotal: number;
};

type Header = {
  payAppNumber: number;
  invoiceNumber: string;
  projectName: string;
  projectNumber: string;
  invoiceDate: string;
  paymentDue: string;
  periodStart: string;
  periodEnd: string;
  fromName: string;
  fromContact: string;
  fromAddress: string;
  toName: string;
  toContact: string;
  toAddress: string;
  originalContractSum: number;
  lessPreviousInvoices: number;
  coAdditionsPrev: number;
  coDeductionsPrev: number;
  coAdditionsThis: number;
  coDeductionsThis: number;
  gcFeeScheduledValue: number;
  distributeOwner: boolean;
  distributeArchitect: boolean;
  distributeContractor: boolean;
};

const EMPTY_HEADER: Header = {
  payAppNumber: 1, invoiceNumber: "", projectName: "", projectNumber: "",
  invoiceDate: "", paymentDue: "", periodStart: "", periodEnd: "",
  fromName: "MIBH Construction", fromContact: "Mike Baruh", fromAddress: "",
  toName: "", toContact: "", toAddress: "",
  originalContractSum: 0, lessPreviousInvoices: 0,
  coAdditionsPrev: 0, coDeductionsPrev: 0, coAdditionsThis: 0, coDeductionsThis: 0,
  gcFeeScheduledValue: 0,
  distributeOwner: true, distributeArchitect: false, distributeContractor: false,
};

// ─── Currency input ───────────────────────────────────────────────────────────
function CurrencyField({ value, onChange, bold, readOnly, style }: {
  value: number; onChange?: (v: number) => void; bold?: boolean;
  readOnly?: boolean; style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  function startEdit() {
    if (readOnly) return;
    setEditing(true);
    setRaw(value === 0 ? "" : String(value));
  }
  function commit() {
    setEditing(false);
    onChange?.(parseFloat(raw.replace(/,/g, "")) || 0);
  }

  const base: React.CSSProperties = {
    background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`,
    color: readOnly ? TEXT : TEXT, fontSize: 12, padding: "2px 0", width: "100%",
    outline: "none", fontFamily: "inherit", textAlign: "right",
    fontWeight: bold ? 700 : 400, cursor: readOnly ? "default" : "text",
    ...style,
  };

  if (editing) return (
    <input autoFocus type="number" value={raw} onChange={e => setRaw(e.target.value)}
      onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
      style={{ ...base, textAlign: "right" }} />
  );
  return (
    <span onClick={startEdit} style={{ ...base, display: "block", cursor: readOnly ? "default" : "text" }}>
      {readOnly && <span style={{ color: MUTED, fontSize: 10 }}></span>}
      ${$$(value)}
    </span>
  );
}

// ─── Table cell input ─────────────────────────────────────────────────────────
function CellInput({ value, onChange, type = "text", style }: {
  value: string | number; onChange: (v: string | number) => void;
  type?: "text" | "number"; style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));

  useEffect(() => { if (!editing) setRaw(String(value)); }, [value, editing]);

  function commit() {
    setEditing(false);
    if (type === "number") onChange(parseFloat(String(raw).replace(/,/g, "")) || 0);
    else onChange(raw);
  }

  const baseStyle: React.CSSProperties = {
    background: "transparent", border: "none", outline: "none", width: "100%",
    color: TEXT, fontSize: 11, padding: "0 4px", fontFamily: "inherit", ...style,
  };

  if (editing) return (
    <input autoFocus type={type === "number" ? "number" : "text"} value={raw}
      onChange={e => setRaw(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } if (e.key === "Escape") { setRaw(String(value)); setEditing(false); } }}
      style={{ ...baseStyle, textAlign: type === "number" ? "right" : "left" }} />
  );

  return (
    <div onClick={() => { setEditing(true); setRaw(type === "number" ? String(value) : String(value)); }}
      style={{ ...baseStyle, cursor: "text", textAlign: type === "number" ? "right" : "left",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        color: (type === "number" && Number(value) === 0) ? MUTED : TEXT }}>
      {type === "number" ? `$${$$(Number(value))}` : (String(value) || <span style={{ color: MUTED }}>—</span>)}
    </div>
  );
}

// ─── Row computed ─────────────────────────────────────────────────────────────
function rowComputed(l: Line) {
  const totalComplete = l.fromPrevious + l.thisInvoice;
  const pct = l.scheduledValue > 0 ? (totalComplete / l.scheduledValue) * 100 : 0;
  const balance = l.scheduledValue - totalComplete;
  return { totalComplete, pct, balance };
}

// ─── Main Editor ──────────────────────────────────────────────────────────────
export default function PayAppEditor({
  payAppId, companyId, clientId, clientEmail, estimates, initialTab, onClose,
}: {
  payAppId: string; companyId: string; clientId: string; clientEmail?: string;
  estimates?: { id: string; name: string; estimateNumber: string }[];
  initialTab?: "summary" | "lines" | "send";
  onClose: (refresh?: boolean) => void;
}) {
  const [tab, setTab] = useState<"summary" | "lines" | "send">(initialTab ?? "summary");
  const [header, setHeader] = useState<Header>(EMPTY_HEADER);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestHeader = useRef(header);
  const latestLines = useRef(lines);
  latestHeader.current = header;
  latestLines.current = lines;

  // Sync from estimate
  const [syncEstimateId, setSyncEstimateId] = useState(estimates?.[0]?.id ?? "");
  const [syncing, setSyncing] = useState(false);

  async function syncFromEstimate() {
    if (!syncEstimateId) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/${companyId}/estimates/${syncEstimateId}/division-totals`);
      const divTotals: { name: string; csiCode: string | null; total: number }[] = await res.json();
      if (!Array.isArray(divTotals) || divTotals.length === 0) return;

      // Replace all lines with estimate divisions; preserve existing invoice amounts when names match
      setLines(prev => {
        const byDesc = new Map(prev.map(l => [l.description.toLowerCase(), l]));
        return divTotals.map((d, i) => {
          const existing = byDesc.get(d.name.toLowerCase());
          const rawCode = d.csiCode ? d.csiCode.slice(0, 2).trim() : null;
          const itemNumber = rawCode ? `Div ${rawCode}` : `Div ${i + 1}`;
          return {
            sortOrder: i,
            itemNumber,
            description: d.name,
            scheduledValue: d.total,
            fromPrevious: existing?.fromPrevious ?? 0,
            thisInvoice: existing?.thisInvoice ?? 0,
            retainageThis: existing?.retainageThis ?? 0,
            retainageTotal: existing?.retainageTotal ?? 0,
          };
        });
      });
      scheduleSave();
    } finally { setSyncing(false); }
  }

  // Send state
  const [sendTo, setSendTo] = useState(clientEmail ?? "");
  const [sendCc, setSendCc] = useState("mikebaruh@gmail.com");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Load
  useEffect(() => {
    fetch(`/api/${companyId}/clients/${clientId}/payapps/${payAppId}`)
      .then(r => r.json())
      .then(data => {
        setHeader({
          payAppNumber: data.payAppNumber ?? 1,
          invoiceNumber: data.invoiceNumber ?? "",
          projectName: data.projectName ?? "",
          projectNumber: data.projectNumber ?? "",
          invoiceDate: data.invoiceDate ?? "",
          paymentDue: data.paymentDue ?? "",
          periodStart: data.periodStart ?? "",
          periodEnd: data.periodEnd ?? "",
          fromName: data.fromName ?? "MIBH Construction",
          fromContact: data.fromContact ?? "Mike Baruh",
          fromAddress: data.fromAddress ?? "",
          toName: data.toName ?? "",
          toContact: data.toContact ?? "",
          toAddress: data.toAddress ?? "",
          originalContractSum: data.originalContractSum ?? 0,
          lessPreviousInvoices: data.lessPreviousInvoices ?? 0,
          coAdditionsPrev: data.coAdditionsPrev ?? 0,
          coDeductionsPrev: data.coDeductionsPrev ?? 0,
          coAdditionsThis: data.coAdditionsThis ?? 0,
          coDeductionsThis: data.coDeductionsThis ?? 0,
          gcFeeScheduledValue: data.gcFeeScheduledValue ?? 0,
          distributeOwner: data.distributeOwner ?? true,
          distributeArchitect: data.distributeArchitect ?? false,
          distributeContractor: data.distributeContractor ?? false,
        });
        setLines(data.lines ?? []);
        setSendSubject(`Pay App #${data.payAppNumber}${data.invoiceNumber ? ` - Invoice #${data.invoiceNumber}` : ""} - ${data.fromName ?? "MIBH Construction"}`);
        setSendBody(`Please find attached Pay Application #${data.payAppNumber}${data.periodStart ? ` for the period ${data.periodStart} – ${data.periodEnd ?? ""}` : ""}.\n\nPlease review and advise.\n\nThank you,\n${data.fromContact ?? "Mike Baruh"}\n${data.fromName ?? "MIBH Construction"}`);
        setLoading(false);
      });
  }, [payAppId, companyId, clientId]);

  const doSave = useCallback(async () => {
    setSaveStatus("saving");
    const h = latestHeader.current;
    const ls = latestLines.current;
    await fetch(`/api/${companyId}/clients/${clientId}/payapps/${payAppId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(h),
    });
    await fetch(`/api/${companyId}/clients/${clientId}/payapps/${payAppId}/lines`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: ls.map((l, i) => ({ ...l, sortOrder: i })) }),
    });
    setSaveStatus("saved");
  }, [companyId, clientId, payAppId]);

  function scheduleSave() {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1500);
  }

  function setH<K extends keyof Header>(field: K, value: Header[K]) {
    setHeader(h => ({ ...h, [field]: value }));
    scheduleSave();
  }

  function setLine(idx: number, field: keyof Line, value: string | number) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    scheduleSave();
  }

  function addLine(type: "div" | "co") {
    const count = lines.length;
    const divCount = lines.filter(l => l.itemNumber.startsWith("Div")).length;
    const coCount = lines.filter(l => l.itemNumber.startsWith("CO")).length;
    const newLine: Line = {
      sortOrder: count,
      itemNumber: type === "div" ? `Div ${divCount + 1}` : `CO #${coCount + 1}`,
      description: "",
      scheduledValue: 0, fromPrevious: 0, thisInvoice: 0,
      retainageThis: 0, retainageTotal: 0,
    };
    setLines(prev => [...prev, newLine]);
    scheduleSave();
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
    scheduleSave();
  }

  // ── Computed summary values ────────────────────────────────────────────────
  const totalScheduled = lines.reduce((s, l) => s + l.scheduledValue, 0);
  const totalFromPrevious = lines.reduce((s, l) => s + l.fromPrevious, 0);
  const totalThisInvoice = lines.reduce((s, l) => s + l.thisInvoice, 0);
  const totalCompleted = totalFromPrevious + totalThisInvoice;
  const retainageAllWork = lines.reduce((s, l) => s + l.retainageTotal, 0);
  const retainageThisInv = lines.reduce((s, l) => s + l.retainageThis, 0);
  const coAdditionsTotal = header.coAdditionsPrev + header.coAdditionsThis;
  const coDeductionsTotal = header.coDeductionsPrev + header.coDeductionsThis;
  const netChanges = coAdditionsTotal - coDeductionsTotal;
  const contractSumToDate = header.originalContractSum + netChanges;
  // GC fee: auto-calculates proportionally to % invoiced per pay period
  const pctPrevious = totalScheduled > 0 ? totalFromPrevious / totalScheduled : 0;
  const pctThisInv = totalScheduled > 0 ? totalThisInvoice / totalScheduled : 0;
  const gcFeePrevious = header.gcFeeScheduledValue * pctPrevious;
  const gcFeeThisInvoice = header.gcFeeScheduledValue * pctThisInv;
  const gcFeeBalance = header.gcFeeScheduledValue - gcFeePrevious - gcFeeThisInvoice;
  const grandTotalCompleted = totalCompleted + gcFeePrevious + gcFeeThisInvoice;
  const totalEarnedLessRetainage = grandTotalCompleted - retainageAllWork;
  const currentPaymentDue = totalEarnedLessRetainage - header.lessPreviousInvoices;
  const balanceToFinish = (contractSumToDate + header.gcFeeScheduledValue) - totalEarnedLessRetainage;

  // ── Input style helpers ────────────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = {
    background: "transparent", border: "none", borderBottom: `1px dashed ${BORDER}`,
    color: TEXT, fontSize: 12, outline: "none", padding: "1px 2px",
    width: "100%", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { color: MUTED, fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" };
  const summaryRow = (label: string, value: React.ReactNode, bold = false) => (
    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
      <td style={{ padding: "4px 8px", fontSize: 12, color: bold ? TEXT : MUTED, fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ padding: "4px 8px", fontSize: 12, fontWeight: bold ? 700 : 400, textAlign: "right", color: TEXT }}>{value}</td>
    </tr>
  );

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: MUTED }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>Pay App</span>
          <input value={String(header.payAppNumber)} onChange={e => setH("payAppNumber", parseInt(e.target.value) || 1)}
            style={{ ...fieldStyle, width: 40, textAlign: "center", fontSize: 14, fontWeight: 700, color: GOLD }} />
          <span style={{ color: MUTED, fontSize: 12 }}>·</span>
          <span style={{ color: MUTED, fontSize: 12 }}>Invoice #</span>
          <input value={header.invoiceNumber} onChange={e => setH("invoiceNumber", e.target.value)}
            placeholder="—" style={{ ...fieldStyle, width: 100, fontSize: 12 }} />
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: saveStatus === "saved" ? "#22c55e" : saveStatus === "saving" ? GOLD : MUTED }}>
          {saveStatus === "saved" ? "✓ Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved"}
        </span>
        <button onClick={() => { if (saveTimer.current) clearTimeout(saveTimer.current); doSave().then(() => onClose(true)); }}
          style={{ background: GOLD, color: BG, border: "none", borderRadius: 8, padding: "6px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Save & Close
        </button>
        <button onClick={() => onClose(false)}
          style={{ background: BORDER, color: TEXT, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ background: BG, borderBottom: `1px solid ${BORDER}`, padding: "0 20px", display: "flex", gap: 0, flexShrink: 0 }}>
        {([
          ["summary", "📄 Summary Sheet"],
          ["lines", "📊 Continuation Sheet"],
          ["send", "✉️ Send / Preview"],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "10px 20px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: tab === t ? CARD : "transparent", color: tab === t ? GOLD : MUTED,
              borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20, background: BG }}>
        {tab === "summary" ? (
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Header grid: 4 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: CARD }}>
              {/* Col 1: Submitted To */}
              <div style={{ padding: 12, borderRight: `1px solid ${BORDER}` }}>
                <div style={labelStyle}>Submitted To</div>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  <input value={header.toName} onChange={e => setH("toName", e.target.value)} placeholder="Client name" style={fieldStyle} />
                  <input value={header.toContact} onChange={e => setH("toContact", e.target.value)} placeholder="Contact name" style={fieldStyle} />
                  <input value={header.toAddress} onChange={e => setH("toAddress", e.target.value)} placeholder="Address" style={fieldStyle} />
                </div>
              </div>
              {/* Col 2: From */}
              <div style={{ padding: 12, borderRight: `1px solid ${BORDER}` }}>
                <div style={labelStyle}>From</div>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  <input value={header.fromName} onChange={e => setH("fromName", e.target.value)} placeholder="Company name" style={fieldStyle} />
                  <input value={header.fromContact} onChange={e => setH("fromContact", e.target.value)} placeholder="Contact name" style={fieldStyle} />
                  <input value={header.fromAddress} onChange={e => setH("fromAddress", e.target.value)} placeholder="Address" style={fieldStyle} />
                </div>
              </div>
              {/* Col 3: Project */}
              <div style={{ padding: 12, borderRight: `1px solid ${BORDER}` }}>
                <div style={labelStyle}>Project</div>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  <input value={header.projectName} onChange={e => setH("projectName", e.target.value)} placeholder="Project name" style={fieldStyle} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={labelStyle}>Distribute To</div>
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                    {(["distributeOwner", "distributeArchitect", "distributeContractor"] as const).map(k => (
                      <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: TEXT }}>
                        <input type="checkbox" checked={header[k]} onChange={e => setH(k, e.target.checked)}
                          style={{ accentColor: GOLD }} />
                        {k === "distributeOwner" ? "Owner" : k === "distributeArchitect" ? "Architect" : "Contractor"}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {/* Col 4: Dates */}
              <div style={{ padding: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={labelStyle}>Project #</div>
                    <input value={header.projectNumber} onChange={e => setH("projectNumber", e.target.value)} placeholder="—" style={fieldStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Invoice Date</div>
                    <input type="date" value={header.invoiceDate} onChange={e => setH("invoiceDate", e.target.value)} style={fieldStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Payment Due</div>
                    <input type="date" value={header.paymentDue} onChange={e => setH("paymentDue", e.target.value)} style={fieldStyle} />
                  </div>
                </div>
              </div>
            </div>

            {/* Financial summary — full width, no signatures */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", display: "flex", gap: 8, borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: MUTED }}>Period Start/End:</span>
                <input type="date" value={header.periodStart} onChange={e => setH("periodStart", e.target.value)} style={{ ...fieldStyle, width: 120, fontSize: 11 }} />
                <span style={{ color: MUTED }}>—</span>
                <input type="date" value={header.periodEnd} onChange={e => setH("periodEnd", e.target.value)} style={{ ...fieldStyle, width: 120, fontSize: 11 }} />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {summaryRow("1.  Original Contract Sum", (
                    <CurrencyField value={header.originalContractSum} onChange={v => setH("originalContractSum", v)} />
                  ))}
                  {summaryRow("2.  GC Fee (Scheduled)", (
                    <CurrencyField value={header.gcFeeScheduledValue} onChange={v => setH("gcFeeScheduledValue", v)} />
                  ))}
                  {summaryRow("3.  Net Changes by Change Orders", `$${$$(netChanges)}`)}
                  {summaryRow("4.  Contract Sum To Date", `$${$$(contractSumToDate + header.gcFeeScheduledValue)}`)}
                  {summaryRow("5.  Total Completed (incl. GC Fee)", `$${$$(grandTotalCompleted)}`)}
                  {summaryRow("    GC Fee This Invoice", `$${$$(gcFeeThisInvoice)}`)}
                  {summaryRow("6.  Total Retainage (All Completed Work)", `$${$$(retainageAllWork)}`)}
                  {summaryRow("7.  Total Earned Less Retainage", `$${$$(totalEarnedLessRetainage)}`)}
                  {summaryRow("8.  Less Previous Invoices", (
                    <CurrencyField value={header.lessPreviousInvoices} onChange={v => setH("lessPreviousInvoices", v)} />
                  ))}
                  {summaryRow("9.  Current Payment Due", <strong style={{ color: GOLD }}>${$$(currentPaymentDue)}</strong>, true)}
                  {summaryRow("10. Balance to Finish", `$${$$(balanceToFinish)}`)}
                </tbody>
              </table>
            </div>

            {/* Change Order Summary */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: TEXT }}>Change Order Summary</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: BG }}>
                    <th style={{ padding: "6px 12px", textAlign: "left", fontSize: 11, color: MUTED, fontWeight: 600 }}></th>
                    <th style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, color: MUTED, fontWeight: 600 }}>Additions</th>
                    <th style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, color: MUTED, fontWeight: 600 }}>Deductions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "6px 12px", fontSize: 12, color: MUTED }}>Previous Invoices</td>
                    <td style={{ padding: "6px 12px" }}><CurrencyField value={header.coAdditionsPrev} onChange={v => setH("coAdditionsPrev", v)} /></td>
                    <td style={{ padding: "6px 12px" }}><CurrencyField value={header.coDeductionsPrev} onChange={v => setH("coDeductionsPrev", v)} /></td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "6px 12px", fontSize: 12, color: MUTED }}>This Invoice</td>
                    <td style={{ padding: "6px 12px" }}><CurrencyField value={header.coAdditionsThis} onChange={v => setH("coAdditionsThis", v)} /></td>
                    <td style={{ padding: "6px 12px" }}><CurrencyField value={header.coDeductionsThis} onChange={v => setH("coDeductionsThis", v)} /></td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "6px 12px", fontSize: 12, color: TEXT, fontWeight: 600 }}>Totals</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, color: TEXT }}>${$$(coAdditionsTotal)}</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, color: TEXT }}>-${$$(coDeductionsTotal)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 12px", fontSize: 12, color: TEXT, fontWeight: 700 }}>Net Changes by Change Order</td>
                    <td colSpan={2} style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, color: GOLD, fontWeight: 700 }}>${$$(netChanges)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        ) : tab === "lines" ? (
          /* ── Continuation Sheet ─────────────────────────────────────────────── */
          <div style={{ maxWidth: 1300, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => addLine("div")}
                style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Add Division
              </button>
              <button onClick={() => addLine("co")}
                style={{ background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Add Change Order
              </button>
              {/* Sync from estimate */}
              {estimates && estimates.length > 0 && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: MUTED }}>Sync scheduled values from:</span>
                  <select value={syncEstimateId} onChange={e => setSyncEstimateId(e.target.value)}
                    style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: "4px 8px", fontSize: 11 }}>
                    {estimates.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.estimateNumber ? `#${e.estimateNumber} — ` : ""}{e.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={syncFromEstimate} disabled={syncing || !syncEstimateId}
                    style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e33", borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: syncing ? 0.5 : 1 }}>
                    {syncing ? "Syncing…" : "⟳ Sync"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${BORDER}` }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1050 }}>
                <thead>
                  <tr style={{ background: CARD }}>
                    <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, width: 80 }}>ITEM #</th>
                    <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, width: 200 }}>DESCRIPTION</th>
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, width: 110 }}>SCHEDULED VALUE</th>
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, width: 110 }}>FROM PREVIOUS</th>
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, width: 110 }}>THIS INVOICE</th>
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, width: 110 }}>BALANCE TO FINISH</th>
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, width: 110 }}>RETAINAGE THIS INV</th>
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: MUTED, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, width: 110 }}>RETAINAGE TOTAL</th>
                    <th style={{ width: 32, borderBottom: `1px solid ${BORDER}` }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const { balance } = rowComputed(line);
                    const isCO = line.itemNumber.startsWith("CO");
                    const rowBg = idx % 2 === 0 ? BG : `${CARD}88`;
                    const cellBorder = `1px solid ${BORDER}`;
                    const tdStyle: React.CSSProperties = { borderRight: cellBorder, borderBottom: cellBorder, padding: "2px 0" };
                    return (
                      <tr key={idx} style={{ background: rowBg }}>
                        <td style={{ ...tdStyle }}>
                          <CellInput value={line.itemNumber} onChange={v => setLine(idx, "itemNumber", v)}
                            style={{ color: isCO ? "#3b82f6" : TEXT }} />
                        </td>
                        <td style={{ ...tdStyle }}>
                          <CellInput value={line.description} onChange={v => setLine(idx, "description", v)} />
                        </td>
                        <td style={{ ...tdStyle }}>
                          <CellInput value={line.scheduledValue} onChange={v => setLine(idx, "scheduledValue", v)} type="number" />
                        </td>
                        <td style={{ ...tdStyle }}>
                          <CellInput value={line.fromPrevious} onChange={v => setLine(idx, "fromPrevious", v)} type="number" />
                        </td>
                        <td style={{ ...tdStyle }}>
                          <CellInput value={line.thisInvoice} onChange={v => setLine(idx, "thisInvoice", v)} type="number" />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", padding: "4px 8px", fontSize: 11, color: balance > 0 ? TEXT : MUTED }}>
                          ${$$(balance)}
                        </td>
                        <td style={{ ...tdStyle }}>
                          <CellInput value={line.retainageThis} onChange={v => setLine(idx, "retainageThis", v)} type="number" />
                        </td>
                        <td style={{ borderBottom: cellBorder, padding: "2px 0" }}>
                          <CellInput value={line.retainageTotal} onChange={v => setLine(idx, "retainageTotal", v)} type="number" />
                        </td>
                        <td style={{ borderBottom: cellBorder, textAlign: "center" }}>
                          <button onClick={() => removeLine(idx)}
                            style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1 }}>
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* GC Fee row — auto-computed, not editable */}
                  {header.gcFeeScheduledValue > 0 && (
                    <tr style={{ background: `${CARD}88` }}>
                      <td style={{ borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "2px 8px", fontSize: 11, color: MUTED, fontStyle: "italic" }}>GC Fee</td>
                      <td style={{ borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "2px 8px", fontSize: 11, color: MUTED, fontStyle: "italic" }}>GC Fee (auto)</td>
                      <td style={{ borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "4px 8px", fontSize: 11, textAlign: "right", color: MUTED }}>${$$(header.gcFeeScheduledValue)}</td>
                      <td style={{ borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "4px 8px", fontSize: 11, textAlign: "right", color: MUTED }}>${$$(gcFeePrevious)}</td>
                      <td style={{ borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "4px 8px", fontSize: 11, textAlign: "right", color: GOLD, fontWeight: 700 }}>${$$(gcFeeThisInvoice)}</td>
                      <td style={{ borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "4px 8px", fontSize: 11, textAlign: "right", color: MUTED }}>${$$(gcFeeBalance)}</td>
                      <td style={{ borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}></td>
                      <td style={{ borderBottom: `1px solid ${BORDER}` }}></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr style={{ background: CARD, fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: "6px 8px", fontSize: 11, color: TEXT, borderTop: `2px solid ${BORDER}` }}>TOTALS</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, color: TEXT, borderTop: `2px solid ${BORDER}` }}>
                      ${$$(totalScheduled + header.gcFeeScheduledValue)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, color: TEXT, borderTop: `2px solid ${BORDER}` }}>
                      ${$$(totalFromPrevious + gcFeePrevious)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, color: GOLD, borderTop: `2px solid ${BORDER}` }}>
                      ${$$(totalThisInvoice + gcFeeThisInvoice)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, color: TEXT, borderTop: `2px solid ${BORDER}` }}>
                      ${$$(lines.reduce((s, l) => s + (l.scheduledValue - (l.fromPrevious + l.thisInvoice)), 0) + gcFeeBalance)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, color: TEXT, borderTop: `2px solid ${BORDER}` }}>
                      ${$$(retainageThisInv)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, color: TEXT, borderTop: `2px solid ${BORDER}` }}>
                      ${$$(lines.reduce((s, l) => s + l.retainageTotal, 0))}
                    </td>
                    <td style={{ borderTop: `2px solid ${BORDER}` }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          /* ── Send / Preview Tab ───────────────────────────────────────────── */
          <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Summary preview */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>
                  Pay App #{header.payAppNumber}{header.invoiceNumber ? ` — Invoice #${header.invoiceNumber}` : ""} Preview
                </div>
                <a
                  href={`/api/${companyId}/clients/${clientId}/payapps/${payAppId}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: "#C9A84C22", color: GOLD, border: `1px solid #C9A84C44`, borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}
                >
                  📄 Preview PDF
                </a>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12, color: MUTED }}>
                <div><span>From:</span> <span style={{ color: TEXT }}>{header.fromName} / {header.fromContact}</span></div>
                <div><span>To:</span> <span style={{ color: TEXT }}>{header.toName}</span></div>
                <div><span>Period:</span> <span style={{ color: TEXT }}>{header.periodStart} – {header.periodEnd}</span></div>
                <div><span>Invoice Date:</span> <span style={{ color: TEXT }}>{header.invoiceDate}</span></div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}`, display: "flex", gap: 24 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>CONTRACT SUM TO DATE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>${$$(header.originalContractSum + (header.coAdditionsPrev + header.coAdditionsThis) - (header.coDeductionsPrev + header.coDeductionsThis))}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>THIS INVOICE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>${$$(lines.reduce((s, l) => s + l.thisInvoice, 0))}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>CURRENT PAYMENT DUE</div>
                  {(() => {
                    const tc = lines.reduce((s, l) => s + l.fromPrevious + l.thisInvoice, 0);
                    const ra = lines.reduce((s, l) => s + l.retainageTotal, 0);
                    const tels = tc - ra;
                    const cpd = tels - header.lessPreviousInvoices;
                    return <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>${$$(cpd)}</div>;
                  })()}
                </div>
              </div>
            </div>

            {/* Email form */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: TEXT }}>Send Pay App via Email</div>
              {[
                ["To", sendTo, setSendTo],
                ["CC", sendCc, setSendCc],
                ["Subject", sendSubject, setSendSubject],
              ].map(([label, value, setter]) => (
                <div key={label as string}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 3, fontWeight: 600 }}>{label as string}</div>
                  <input value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
                    style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none" }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 3, fontWeight: 600 }}>Message</div>
                <textarea value={sendBody} onChange={e => setSendBody(e.target.value)} rows={6}
                  style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: "7px 10px", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              </div>
              {sendResult && (
                <div style={{ fontSize: 12, color: sendResult.startsWith("✓") ? "#22c55e" : "#f85149" }}>{sendResult}</div>
              )}
              <button
                disabled={sending || !sendTo}
                onClick={async () => {
                  setSending(true); setSendResult(null);
                  try {
                    const res = await fetch(`/api/${companyId}/send-estimate-email`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        to: sendTo, cc: sendCc, subject: sendSubject, body: sendBody,
                        payAppSummary: {
                          payAppNumber: header.payAppNumber,
                          invoiceNumber: header.invoiceNumber,
                          fromName: header.fromName,
                          toName: header.toName,
                          periodStart: header.periodStart,
                          periodEnd: header.periodEnd,
                          currentPaymentDue: (() => {
                            const tc = lines.reduce((s, l) => s + l.fromPrevious + l.thisInvoice, 0);
                            const ra = lines.reduce((s, l) => s + l.retainageTotal, 0);
                            return tc - ra - header.lessPreviousInvoices;
                          })(),
                        },
                      }),
                    });
                    setSendResult(res.ok ? "✓ Email sent successfully" : "✗ Failed to send email");
                  } catch { setSendResult("✗ Failed to send email"); }
                  finally { setSending(false); }
                }}
                style={{ background: GOLD, color: BG, border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: sending || !sendTo ? 0.5 : 1 }}>
                {sending ? "Sending…" : "Send Email"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
