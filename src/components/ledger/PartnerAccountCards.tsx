"use client";

import { useState, useEffect } from "react";
import { EyeIcon, DownloadArrowIcon, PrinterIcon, EnvelopeIcon, XIcon, GripIcon, PencilIcon } from "@/components/ui/icons";
import {
  updatePartnerBeginningBalance,
  updateLlcBeginningBalance,
  updateLlcName,
  deletePartnerAccountEntry,
  updatePartnerAccountEntry,
  addPartnerAccountEntry,
  archivePartner,
} from "@/app/[companyId]/[projectId]/ledger/actions";
import { format } from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const GOLD = "#C9A84C";
const INPUT_STYLE = { background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" };

const PAYMENT_METHODS = ["Check", "ACH", "Wire", "Zelle", "Credit Card", "Cash", "Other"];

type Entry = {
  id: string;
  description: string;
  amount: number;
  entryType: "CREDIT" | "DEBIT";
  method?: string | null;
  date: string;
};

type CapitalLine = {
  entryId: string;
  date: string;
  memo: string;
  debit: number;
  credit: number;
};

type Partner = { id: string; name: string; email: string | null; beginningBalance: number };

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function fmtDate(d: string | Date) {
  const iso = d instanceof Date ? d.toISOString().split("T")[0] : d;
  return format(new Date(iso + "T00:00:00"), "MMM d, yyyy");
}

function EditableEntry({
  entry,
  isAdmin,
  onSave,
  onDelete,
}: {
  entry: Entry;
  isAdmin: boolean;
  onSave: (id: string, data: { description: string; amount: number; date: string; method?: string }) => Promise<void | { success: boolean }>;
  onDelete: (id: string) => Promise<void | { success: boolean }>;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(entry.description);
  const [amount, setAmount] = useState(String(entry.amount));
  const [date, setDate] = useState(entry.date);
  const [method, setMethod] = useState(entry.method ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(entry.id, { description: desc, amount: parseFloat(amount), date, method: method || undefined });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    setDeleting(true);
    try { await onDelete(entry.id); } finally { setDeleting(false); }
  }

  if (editing) {
    return (
      <div className="rounded-lg p-2 space-y-2" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="col-span-2">
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Description" className="w-full rounded px-2 py-1.5 text-xs focus:outline-none"
              style={INPUT_STYLE} />
          </div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount" className="w-full rounded px-2 py-1.5 text-xs focus:outline-none"
            style={INPUT_STYLE} />
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-xs focus:outline-none"
            style={INPUT_STYLE}>
            <option value="">Payment method</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-xs focus:outline-none col-span-2"
            style={INPUT_STYLE} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="px-2 py-1 text-xs font-semibold rounded disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}>{saving ? "..." : "Save"}</button>
          <button onClick={() => setEditing(false)}
            className="px-2 py-1 text-xs rounded"
            style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-2 gap-2" style={{ background: "#161b22" }}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: "#e6edf3" }}>{entry.description}</div>
        <div className="text-[10px] flex items-center gap-1.5" style={{ color: "#8b949e" }}>
          <span>{fmtDate(entry.date)}</span>
          {entry.method && <span className="px-1 rounded" style={{ background: "#1e2736", color: "#8b949e" }}>{entry.method}</span>}
        </div>
      </div>
      <span className="text-xs font-mono font-semibold shrink-0"
        style={{ color: entry.entryType === "CREDIT" ? "#4ade80" : "#f87171" }}>
        {entry.entryType === "CREDIT" ? "+" : "−"}${fmt(entry.amount)}
      </span>
      {isAdmin && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditing(true)}
            className="p-1 rounded"
            style={{ color: GOLD, background: "#C9A84C11" }}><PencilIcon size={12} /></button>
          <button onClick={del} disabled={deleting}
            className="p-1 rounded disabled:opacity-50"
            style={{ color: "#f87171", background: "#2d1b1b" }}>{deleting ? "…" : <XIcon size={12} />}</button>
        </div>
      )}
    </div>
  );
}

function AccountCard({
  title,
  subtitle,
  beginningBalance,
  entries,
  capitalLines,
  onUpdateBeginning,
  onSave,
  onDelete,
  onAdd,
  isAdmin,
  showDragHandle,
  dragHandleProps,
  onArchive,
  onEmailStatement,
}: {
  title: string;
  subtitle?: string;
  beginningBalance: number;
  entries: Entry[];
  capitalLines?: CapitalLine[];
  onUpdateBeginning: (amount: number) => Promise<void | { success: boolean }>;
  onSave: (id: string, data: { description: string; amount: number; date: string }) => Promise<void | { success: boolean }>;
  onDelete: (id: string) => Promise<void | { success: boolean }>;
  onAdd?: (data: { description: string; amount: number; entryType: "CREDIT" | "DEBIT"; method?: string; date: string }) => Promise<Entry>;
  isAdmin: boolean;
  showDragHandle?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onArchive?: () => void;
  onEmailStatement?: (html: string) => void;
})

{
  const [localEntries, setLocalEntries] = useState<Entry[]>(entries);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDesc, setAddDesc] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addType, setAddType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [addMethod, setAddMethod] = useState("");
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addSaving, setAddSaving] = useState(false);

  async function handleAdd() {
    const amt = parseFloat(addAmount);
    if (!addDesc.trim() || !amt || amt <= 0) return;
    setAddSaving(true);
    try {
      const entry = await onAdd!({ description: addDesc.trim(), amount: amt, entryType: addType, method: addMethod || undefined, date: addDate });
      setLocalEntries(prev => [...prev, entry]);
      setAddDesc(""); setAddAmount(""); setAddType("CREDIT"); setAddMethod("");
      setAddDate(new Date().toISOString().slice(0, 10));
      setShowAddForm(false);
      setTxOpen(true);
    } finally { setAddSaving(false); }
  }

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(beginningBalance));
  const [savingBalance, setSavingBalance] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const credits = localEntries.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);
  const debits = localEntries.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
  const journalCredits = (capitalLines ?? []).reduce((s, l) => s + l.credit, 0);
  const journalDebits = (capitalLines ?? []).reduce((s, l) => s + l.debit, 0);
  const balance = beginningBalance + credits - debits + journalCredits - journalDebits;

  function buildStatementHtml() {
    const allLines = [
      ...localEntries.map((e) => ({
        date: e.date,
        memo: e.description,
        method: e.method ?? null,
        debit:  e.entryType === "DEBIT"  ? e.amount : 0,
        credit: e.entryType === "CREDIT" ? e.amount : 0,
      })),
      ...(capitalLines ?? []).map((l) => ({
        date: l.date,
        memo: l.memo,
        method: null as string | null,
        debit:  l.debit,
        credit: l.credit,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const totalDebits  = allLines.reduce((s, l) => s + l.debit,  0);
    const totalCredits = allLines.reduce((s, l) => s + l.credit, 0);
    const netBalance   = beginningBalance + totalCredits - totalDebits;

    const fmtCell = (n: number) => n > 0 ? `$${fmt(n)}` : "";

    const rows = allLines.map((l) => {
      const d = new Date(l.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const desc = l.memo + (l.method ? ` <span style="color:#888;font-size:11px">(${l.method})</span>` : "");
      return `<tr>
        <td style="white-space:nowrap">${d}</td>
        <td>${desc}</td>
        <td style="text-align:right;font-family:monospace;color:#991b1b">${fmtCell(l.debit)}</td>
        <td style="text-align:right;font-family:monospace;color:#166534">${fmtCell(l.credit)}</td>
      </tr>`;
    }).join("");

    const css = `body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:760px;margin:0 auto}h1{font-size:20px;margin:0 0 2px}p{color:#666;font-size:12px;margin:0 0 24px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;border-bottom:2px solid #000;padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}th.num{text-align:right}td{padding:7px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top}.subtotal td{font-weight:600;border-top:1px solid #ccc;border-bottom:none;background:#f9fafb}.net td{font-weight:700;font-size:14px;border-top:2px solid #000;border-bottom:none}.actions{margin-top:24px}button{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;background:#C9A84C;color:#000}@media print{.actions{display:none}}`;

    return `<!DOCTYPE html><html><head><title>${title} Statement</title><style>${css}</style></head><body>
      <h1>${title}</h1>
      <p>Account Statement · Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      <table>
        <thead><tr>
          <th style="width:100px">Date</th>
          <th>Description</th>
          <th class="num" style="width:110px">Debit</th>
          <th class="num" style="width:110px">Credit</th>
        </tr></thead>
        <tbody>
          <tr><td></td><td><strong>Beginning Balance</strong></td><td></td><td style="text-align:right;font-family:monospace;font-weight:600">$${fmt(beginningBalance)}</td></tr>
          ${rows}
          <tr class="subtotal">
            <td colspan="2">Column Totals</td>
            <td style="text-align:right;font-family:monospace;color:#991b1b">$${fmt(totalDebits)}</td>
            <td style="text-align:right;font-family:monospace;color:#166534">$${fmt(totalCredits)}</td>
          </tr>
          <tr class="net">
            <td colspan="3">Net Balance</td>
            <td style="text-align:right;font-family:monospace;color:${netBalance >= 0 ? "#166534" : "#991b1b"}">$${fmt(netBalance)}</td>
          </tr>
        </tbody>
      </table>
      <div class="actions"><button onclick="window.print()">Print / Save PDF</button></div>
    </body></html>`;
  }

  function handlePreview() { setPreviewHtml(buildStatementHtml()); }
  function handlePrint() {
    const html = buildStatementHtml();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }
  function handleDownload() {
    const html = buildStatementHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "-")}-statement.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveBalance() {
    setSavingBalance(true);
    try {
      await onUpdateBeginning(parseFloat(balanceInput) || 0);
      setEditingBalance(false);
    } finally { setSavingBalance(false); }
  }

return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        {/* Drag handle — top left */}
        {showDragHandle && (
          <div {...(dragHandleProps ?? {})} className="cursor-grab active:cursor-grabbing p-1 rounded select-none shrink-0" style={{ color: "#8b949e", touchAction: "none" }}>
            <GripIcon size={14} />
          </div>
        )}
        {/* Title — click to expand/collapse */}
        <button className="flex-1 text-left min-w-0" onClick={() => setExpanded(o => !o)}>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>{subtitle}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{title}</span>
            {!expanded && (
              <span className="text-base font-bold" style={{ color: balance >= 0 ? "#4ade80" : "#f87171" }}>
                ${fmt(balance)}
              </span>
            )}
          </div>
        </button>
        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handlePreview} title="Preview statement" className="p-1.5 rounded" style={{ color: "#8b949e", background: "#30373f" }}><EyeIcon size={13} /></button>
          <button onClick={handleDownload} title="Download statement" className="p-1.5 rounded" style={{ color: "#8b949e", background: "#30373f" }}><DownloadArrowIcon size={13} /></button>
          <button onClick={handlePrint} title="Print statement" className="p-1.5 rounded" style={{ color: GOLD, background: "#C9A84C11", border: `1px solid ${GOLD}44` }}><PrinterIcon size={13} /></button>
          {onEmailStatement && (
            <button onClick={() => onEmailStatement(buildStatementHtml())} title="Email statement to partner" className="p-1.5 rounded" style={{ color: "#58a6ff", background: "#58a6ff11", border: "1px solid #58a6ff33" }}><EnvelopeIcon size={13} /></button>
          )}
          {isAdmin && onArchive && (
            <button onClick={onArchive} title="Remove partner card" className="p-1.5 rounded" style={{ color: "#f85149", background: "#f8514911", border: "1px solid #f8514933" }}><XIcon size={13} /></button>
          )}
        </div>
        {/* Expand/collapse arrow — top right */}
        <button onClick={() => setExpanded(o => !o)} className="shrink-0 px-1 py-0.5 rounded text-xs" style={{ color: "#8b949e" }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && <>

      {/* Balance */}
      <div className="rounded-lg p-3" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
        <div className="text-[10px] mb-1" style={{ color: "#8b949e" }}>Current Balance</div>
        <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.1, color: balance >= 0 ? "#4ade80" : "#f87171" }}>
          ${fmt(balance)}
        </div>
        <div className="flex gap-3 mt-1.5 text-[10px]" style={{ color: "#8b949e" }}>
          <span style={{ color: "#4ade80" }}>+${fmt(credits)} credits</span>
          <span style={{ color: "#f87171" }}>−${fmt(debits)} debits</span>
        </div>
      </div>

      {/* Journal entry recap — collapsible */}
      {capitalLines && capitalLines.length > 0 && (
        <div>
          <button
            onClick={() => setJournalOpen((o) => !o)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
              Journal Entries ({capitalLines.length})
            </span>
            <span className="text-[10px]" style={{ color: "#8b949e" }}>{journalOpen ? "▲" : "▼"}</span>
          </button>
          {journalOpen && (
            <div className="space-y-1 mt-1.5">
              {capitalLines.map((cl) => {
                const isCredit = cl.credit > 0;
                const amt = isCredit ? cl.credit : cl.debit;
                return (
                  <div key={cl.entryId} className="flex items-start justify-between rounded px-2 py-1.5 gap-2" style={{ background: "#161b22" }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate" style={{ color: "#e6edf3" }}>{cl.memo}</div>
                      <div className="text-[10px]" style={{ color: "#8b949e" }}>{fmtDate(cl.date)}</div>
                    </div>
                    <span className="text-xs font-mono font-semibold shrink-0"
                      style={{ color: isCredit ? "#4ade80" : "#f87171" }}>
                      {isCredit ? "+" : "−"}${fmt(amt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Beginning balance */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium" style={{ color: "#8b949e" }}>Beginning Balance <span style={{ color: "#6b7280" }}>as of 01/01/26</span></span>
          {isAdmin && !editingBalance && (
            <button onClick={() => { setEditingBalance(true); setBalanceInput(String(beginningBalance)); }}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ color: GOLD, background: "#C9A84C11", border: `1px solid ${GOLD}44` }}>
              Edit
            </button>
          )}
        </div>
        {editingBalance ? (
          <div className="flex gap-2">
            <input type="number" step="0.01" value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={INPUT_STYLE} />
            <button onClick={saveBalance} disabled={savingBalance}
              className="px-2 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
              style={{ background: GOLD, color: "#0d1117" }}>{savingBalance ? "..." : "Save"}</button>
            <button onClick={() => setEditingBalance(false)}
              className="px-2 py-1.5 text-xs rounded-lg"
              style={{ background: "#30373f", color: "#8b949e" }}>✕</button>
          </div>
        ) : (
          <div className="text-xs font-mono font-semibold" style={{ color: "#e6edf3" }}>${fmt(beginningBalance)}</div>
        )}
      </div>

      {/* Manual transactions — collapsible + add button */}
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setTxOpen((o) => !o)}
            className="flex items-center gap-1 text-left"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
              Transactions ({localEntries.length})
            </span>
            <span className="text-[10px]" style={{ color: "#8b949e" }}>{txOpen ? "▲" : "▼"}</span>
          </button>
          {isAdmin && onAdd && (
            <button
              onClick={() => { setShowAddForm(v => !v); setTxOpen(true); }}
              className="text-[10px] px-2 py-0.5 rounded font-bold"
              style={{ background: showAddForm ? "#C9A84C33" : "#C9A84C22", color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              {showAddForm ? "×" : "+"}
            </button>
          )}
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <div className="mt-2 rounded-lg p-2 space-y-2" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
            <input
              type="text" value={addDesc} onChange={e => setAddDesc(e.target.value)}
              placeholder="Description" autoFocus
              className="w-full rounded px-2 py-1.5 text-xs focus:outline-none" style={INPUT_STYLE}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
            <div className="flex gap-2">
              <input
                type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)}
                placeholder="Amount" min="0" step="0.01"
                className="flex-1 rounded px-2 py-1.5 text-xs focus:outline-none" style={INPUT_STYLE}
              />
              <button
                onClick={() => setAddType(t => t === "CREDIT" ? "DEBIT" : "CREDIT")}
                className="px-2 py-1 text-xs font-bold rounded shrink-0"
                style={{ background: addType === "CREDIT" ? "#14532d" : "#7f1d1d", color: addType === "CREDIT" ? "#4ade80" : "#f87171", border: `1px solid ${addType === "CREDIT" ? "#4ade8044" : "#f8717144"}` }}
              >
                {addType}
              </button>
            </div>
            <select
              value={addMethod} onChange={e => setAddMethod(e.target.value)}
              className="w-full rounded px-2 py-1.5 text-xs focus:outline-none" style={INPUT_STYLE}
            >
              <option value="">Payment method (optional)</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
              className="w-full rounded px-2 py-1.5 text-xs focus:outline-none" style={INPUT_STYLE}
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={addSaving}
                className="px-3 py-1 text-xs font-semibold rounded disabled:opacity-50"
                style={{ background: GOLD, color: "#0d1117" }}>
                {addSaving ? "..." : "Add"}
              </button>
              <button onClick={() => setShowAddForm(false)}
                className="px-2 py-1 text-xs rounded"
                style={{ background: "#30373f", color: "#8b949e" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {txOpen && localEntries.length > 0 && (
          <div className="space-y-1 mt-1.5">
            {localEntries.map((e) => (
              <EditableEntry key={e.id} entry={e} isAdmin={isAdmin} onSave={onSave}
                onDelete={async (id) => { await onDelete(id); setLocalEntries(prev => prev.filter(x => x.id !== id)); }} />
            ))}
          </div>
        )}
      </div>

      </>}

      {/* Preview modal */}
      {previewHtml && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setPreviewHtml(null)}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 780, height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{title} Statement</span>
              <button onClick={() => setPreviewHtml(null)} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}>×</button>
            </div>
            <iframe srcDoc={previewHtml} style={{ flex: 1, border: "none", width: "100%" }} />
          </div>
        </div>
      )}

    </div>
  );
}

function MasterCard({
  projectId,
  partners,
  partnerEntriesMap,
  capitalLinesByPartner,
  llcEntries,
  showDragHandle,
  dragHandleProps,
}: {
  projectId: string;
  partners: Partner[];
  partnerEntriesMap: Record<string, Entry[]>;
  capitalLinesByPartner: Record<string, CapitalLine[]>;
  llcEntries: Entry[];
  showDragHandle?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  function partnerBalance(p: Partner) {
    const entries = partnerEntriesMap[p.id] ?? [];
    const credits = entries.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);
    const debits = entries.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
    const lines = capitalLinesByPartner[p.id] ?? [];
    const jc = lines.reduce((s, l) => s + l.credit, 0);
    const jd = lines.reduce((s, l) => s + l.debit, 0);
    return p.beginningBalance + credits - debits + jc - jd;
  }

  const EDDIE_CONTRIB = 55000;
  const YOSEF_CONTRIB = 25000;
  const CASH_ON_HAND = 25000;

  const [bankAccount, setBankAccount] = useState(150000);
  const [editingBank, setEditingBank] = useState(false);
  const [bankInput, setBankInput] = useState("150000");
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`master-bank-account-${projectId}`);
    if (saved) { const v = parseFloat(saved); if (!isNaN(v)) { setBankAccount(v); setBankInput(String(v)); } }
  }, [projectId]);

  function saveBank() {
    const val = parseFloat(bankInput) || 0;
    setBankAccount(val);
    localStorage.setItem(`master-bank-account-${projectId}`, String(val));
    setEditingBank(false);
  }

  const eddie = partners.find((p) => p.name === "Eddie Yakubov");
  const yosef = partners.find((p) => p.name === "Yosef Yakubov");
  const eddieBalance = eddie ? partnerBalance(eddie) : 0;
  const yosefBalance = yosef ? partnerBalance(yosef) : 0;

  const llcExpenseItems = llcEntries.filter((e) => e.entryType === "DEBIT");
  const llcExpenses = llcExpenseItems.reduce((s, e) => s + e.amount, 0);

  const total = eddieBalance + yosefBalance + EDDIE_CONTRIB + YOSEF_CONTRIB - CASH_ON_HAND - llcExpenses - bankAccount;

  const rows: { label: string; value: number; editable?: boolean }[] = [
    { label: "Eddie's Balance", value: eddieBalance },
    { label: "Yosef's Balance", value: yosefBalance },
    { label: "Contribution to LLC (Eddie)", value: EDDIE_CONTRIB },
    { label: "Contribution to LLC (Yosef)", value: YOSEF_CONTRIB },
    { label: "Cash on Hand", value: -CASH_ON_HAND },
    { label: `Items Paid by LLC (${llcExpenseItems.length})`, value: -llcExpenses },
    { label: "Bank Account", value: -bankAccount, editable: true },
  ];

  const [previewMasterHtml, setPreviewMasterHtml] = useState<string | null>(null);

  function buildMasterHtml() {
    return `<!DOCTYPE html><html><head><title>Mike Master Statement</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:600px;margin:0 auto}h1{font-size:20px;margin:0}p{color:#666;font-size:12px;margin:4px 0 28px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;border-bottom:2px solid #000;padding:8px 6px;font-size:11px;text-transform:uppercase}td{padding:7px 6px;border-bottom:1px solid #e5e7eb}td:last-child{text-align:right;font-family:monospace}.total td{font-weight:700;border-top:2px solid #000;border-bottom:none}.actions{margin-top:24px;display:flex;gap:10px}button{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}.print-btn{background:#C9A84C;color:#000}@media print{.actions{display:none}}</style></head><body><h1>Mike Master Summary</h1><p>Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p><table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td><td style="color:${r.value>=0?"#166534":"#991b1b"}">${r.value>=0?"+":"-"}$${fmt(Math.abs(r.value))}</td></tr>`).join("")}<tr class="total"><td>Net Total</td><td>$${fmt(total)}</td></tr></tbody></table><div class="actions"><button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button></div></body></html>`;
  }
  function handleMasterPreview() { setPreviewMasterHtml(buildMasterHtml()); }
  function handleMasterPrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildMasterHtml());
    win.document.close();
  }
  function handleMasterDownload() {
    const html = buildMasterHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mike-master-statement.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#0d1117", border: `1px solid ${GOLD}` }}>
      <div className="flex items-center gap-2">
        {/* Drag handle — top left */}
        {showDragHandle && (
          <div {...(dragHandleProps ?? {})} className="cursor-grab active:cursor-grabbing p-1 rounded select-none shrink-0" style={{ color: "#8b949e", touchAction: "none" }}>
            <GripIcon size={14} />
          </div>
        )}
        {/* Title — click to expand/collapse */}
        <button className="flex-1 text-left min-w-0" onClick={() => setExpanded(o => !o)}>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: GOLD }}>Master Summary</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>Mike Master</span>
            {!expanded && (
              <span className="text-base font-bold" style={{ color: total >= 0 ? "#4ade80" : "#f87171" }}>
                {total < 0 ? "−" : ""}${fmt(Math.abs(total))}
              </span>
            )}
          </div>
        </button>
        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleMasterPreview} title="Preview statement" className="p-1.5 rounded" style={{ color: "#8b949e", background: "#30373f" }}><EyeIcon size={13} /></button>
          <button onClick={handleMasterDownload} title="Download statement" className="p-1.5 rounded" style={{ color: "#8b949e", background: "#30373f" }}><DownloadArrowIcon size={13} /></button>
          <button onClick={handleMasterPrint} title="Print statement" className="p-1.5 rounded" style={{ color: GOLD, background: "#C9A84C11", border: `1px solid ${GOLD}44` }}><PrinterIcon size={13} /></button>
        </div>
        {/* Expand/collapse arrow — top right */}
        <button onClick={() => setExpanded(o => !o)} className="shrink-0 px-1 py-0.5 rounded text-xs" style={{ color: "#8b949e" }}>
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && <>

      <div className="rounded-lg p-3" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
        <div className="text-[10px] mb-1" style={{ color: "#8b949e" }}>Net Total</div>
        <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.1, color: total >= 0 ? "#4ade80" : "#f87171" }}>
          {total < 0 ? "−" : ""}${fmt(Math.abs(total))}
        </div>
      </div>

      <div>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between w-full text-left">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
            Breakdown ({rows.length})
          </span>
          <span className="text-[10px]" style={{ color: "#8b949e" }}>{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="space-y-2 mt-1.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: "#e6edf3" }}>{row.label}</span>
                {row.editable && editingBank ? (
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.01" value={bankInput} onChange={(e) => setBankInput(e.target.value)}
                      className="w-28 rounded px-2 py-0.5 text-xs focus:outline-none" style={INPUT_STYLE}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBank(); if (e.key === "Escape") setEditingBank(false); }} autoFocus />
                    <button onClick={saveBank} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: GOLD, color: "#0d1117", fontWeight: 700 }}>✓</button>
                    <button onClick={() => setEditingBank(false)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#30373f", color: "#8b949e" }}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono font-semibold shrink-0" style={{ color: row.value >= 0 ? "#4ade80" : "#f87171" }}>
                      {row.value >= 0 ? "+" : "−"}${fmt(Math.abs(row.value))}
                    </span>
                    {row.editable && (
                      <button onClick={() => setEditingBank(true)} className="text-[10px] px-1 py-0.5 rounded" style={{ color: GOLD, background: "#C9A84C11" }}>✎</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      </>}

      {/* Preview modal */}
      {previewMasterHtml && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setPreviewMasterHtml(null)}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 680, height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>Mike Master Statement</span>
              <button onClick={() => setPreviewMasterHtml(null)} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#666", lineHeight: 1 }}>×</button>
            </div>
            <iframe srcDoc={previewMasterHtml} style={{ flex: 1, border: "none", width: "100%" }} />
          </div>
        </div>
      )}

    </div>
  );
}

function SortableCard({ id, fullWidth, children }: { id: string; fullWidth?: boolean; children: (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={fullWidth ? "col-span-1 sm:col-span-2 lg:col-span-3" : undefined}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

export default function PartnerAccountCards({
  projectId,
  companyId,
  partners: initialPartners,
  llcBeginningBalance,
  llcName: initialLlcName,
  partnerEntriesMap,
  llcEntries,
  capitalLinesByPartner,
  isAdmin,
  isPartner,
}: {
  projectId: string;
  companyId: string;
  partners: Partner[];
  llcBeginningBalance: number;
  llcName: string | null;
  partnerEntriesMap: Record<string, Entry[]>;
  llcEntries: Entry[];
  capitalLinesByPartner: Record<string, CapitalLine[]>;
  isAdmin: boolean;
  isPartner?: boolean;
}) {
  const [partners, setPartners] = useState(initialPartners);
  const [emailStatus, setEmailStatus] = useState<Record<string, "sending" | "sent" | "error">>({});
  const [llcEmailStatus, setLlcEmailStatus] = useState<"sending" | "sent" | "error" | null>(null);

  const [llcTitle, setLlcTitle] = useState(initialLlcName ?? "LLC Account");
  const [editingLlcName, setEditingLlcName] = useState(false);
  const [llcNameInput, setLlcNameInput] = useState(llcTitle);
  const [savingLlcName, setSavingLlcName] = useState(false);

  async function saveLlcName() {
    setSavingLlcName(true);
    await updateLlcName(projectId, llcNameInput);
    setLlcTitle(llcNameInput);
    setEditingLlcName(false);
    setSavingLlcName(false);
  }
  async function handleArchivePartner(partnerId: string) {
    await archivePartner(partnerId);
    setPartners((prev) => prev.filter((p) => p.id !== partnerId));
    setOrder((prev) => prev.filter((id) => id !== partnerId));
  }

  async function handleEmailLlcStatement(html: string) {
    const recipient = window.prompt("Send LLC statement to email address:");
    if (!recipient?.trim()) return;
    setLlcEmailStatus("sending");
    try {
      const res = await fetch(`/api/${companyId}/${projectId}/send-partner-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerName: "LLC Account",
          partnerEmail: recipient.trim(),
          htmlContent: html,
          subject: `Account Statement — ${llcTitle}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLlcEmailStatus("sent");
      setTimeout(() => setLlcEmailStatus(null), 3000);
    } catch {
      setLlcEmailStatus("error");
      setTimeout(() => setLlcEmailStatus(null), 4000);
    }
  }

  async function handleEmailStatement(partner: Partner, html: string) {
    if (!partner.email) {
      alert(`No email address on file for ${partner.name}.`);
      return;
    }
    setEmailStatus((s) => ({ ...s, [partner.id]: "sending" }));
    try {
      const res = await fetch(`/api/${companyId}/${projectId}/send-partner-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerName: partner.name,
          partnerEmail: partner.email,
          htmlContent: html,
          subject: `Account Statement — ${partner.name}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEmailStatus((s) => ({ ...s, [partner.id]: "sent" }));
      setTimeout(() => setEmailStatus((s) => { const n = { ...s }; delete n[partner.id]; return n; }), 3000);
    } catch {
      setEmailStatus((s) => ({ ...s, [partner.id]: "error" }));
      setTimeout(() => setEmailStatus((s) => { const n = { ...s }; delete n[partner.id]; return n; }), 4000);
    }
  }

  const defaultOrder = [...partners.map((p) => p.id), "llc", ...(isAdmin && partners.length > 0 ? ["master"] : [])];

  const [order, setOrder] = useState<string[]>(defaultOrder);

  useEffect(() => {
    const saved = localStorage.getItem(`partner-cards-order-${projectId}`);
    if (saved) {
      try {
        const parsed: string[] = JSON.parse(saved);
        // Merge: keep saved order but add any new ids, remove stale ones
        const valid = parsed.filter((id) => defaultOrder.includes(id));
        const missing = defaultOrder.filter((id) => !valid.includes(id));
        setOrder([...valid, ...missing]);
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        const next = arrayMove(prev, oldIndex, newIndex);
        localStorage.setItem(`partner-cards-order-${projectId}`, JSON.stringify(next));
        return next;
      });
    }
  }

  function makeSave() {
    return (id: string, data: { description: string; amount: number; date: string; method?: string }) =>
      updatePartnerAccountEntry(id, data, companyId, projectId).then(() => {});
  }

  type CardRenderer = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
  const cardMap: Record<string, CardRenderer> = {};
  for (const partner of partners) {
    const p = partner;
    cardMap[p.id] = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => (
      <div>
        {emailStatus[p.id] && (
          <div className="mb-1 text-xs px-2 py-1 rounded text-center" style={{
            background: emailStatus[p.id] === "sent" ? "#0d2a1a" : emailStatus[p.id] === "error" ? "#2d1b1b" : "#1e2736",
            color: emailStatus[p.id] === "sent" ? "#4ade80" : emailStatus[p.id] === "error" ? "#f87171" : "#8b949e",
          }}>
            {emailStatus[p.id] === "sending" ? "Sending..." : emailStatus[p.id] === "sent" ? "Statement sent ✓" : "Failed to send"}
          </div>
        )}
        <AccountCard
          title={`${p.name}'s Account`}
          subtitle="Partner's Account"
          beginningBalance={p.beginningBalance}
          entries={partnerEntriesMap[p.id] ?? []}
          capitalLines={capitalLinesByPartner[p.id] ?? []}
          isAdmin={isAdmin}
          onUpdateBeginning={(amount) => updatePartnerBeginningBalance(p.id, amount)}
          onSave={makeSave()}
          onDelete={(id) => deletePartnerAccountEntry(id, companyId, projectId)}
          onAdd={async (data) => {
            const result = await addPartnerAccountEntry({ projectId, companyId, accountType: "PARTNER", partnerId: p.id, ...data });
            return { id: result.id, ...data, method: data.method ?? null };
          }}
          showDragHandle={true}
          dragHandleProps={dragHandleProps}
          onArchive={() => handleArchivePartner(p.id)}
          onEmailStatement={(html) => handleEmailStatement(p, html)}
        />
      </div>
    );
  }
  cardMap["llc"] = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => (
    <div>
      {llcEmailStatus && (
        <div className="mb-1 text-xs px-2 py-1 rounded text-center" style={{
          background: llcEmailStatus === "sent" ? "#0d2a1a" : llcEmailStatus === "error" ? "#2d1b1b" : "#1e2736",
          color: llcEmailStatus === "sent" ? "#4ade80" : llcEmailStatus === "error" ? "#f87171" : "#8b949e",
        }}>
          {llcEmailStatus === "sending" ? "Sending..." : llcEmailStatus === "sent" ? "Statement sent ✓" : "Failed to send"}
        </div>
      )}
      {isAdmin && editingLlcName ? (
        <div className="flex gap-2 mb-2 items-center">
          <input
            value={llcNameInput}
            onChange={e => setLlcNameInput(e.target.value)}
            className="flex-1 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
            style={INPUT_STYLE}
          />
          <button onClick={saveLlcName} disabled={savingLlcName}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}>
            {savingLlcName ? "..." : "Save"}
          </button>
          <button onClick={() => { setEditingLlcName(false); setLlcNameInput(llcTitle); }}
            className="px-3 py-1.5 text-xs rounded-lg"
            style={{ background: "#30373f", color: "#8b949e" }}>
            Cancel
          </button>
        </div>
      ) : (
        isAdmin && (
          <button onClick={() => { setEditingLlcName(true); setLlcNameInput(llcTitle); }}
            className="text-xs mb-1 ml-1 underline"
            style={{ color: "#8b949e" }}>
            Edit LLC name
          </button>
        )
      )}
      <AccountCard
        title={llcTitle}
        subtitle="Project Account"
        beginningBalance={llcBeginningBalance}
        entries={llcEntries}
        isAdmin={isAdmin}
        onUpdateBeginning={(amount) => updateLlcBeginningBalance(projectId, amount)}
        onSave={makeSave()}
        onDelete={(id) => deletePartnerAccountEntry(id, companyId, projectId)}
        onAdd={async (data) => {
          const result = await addPartnerAccountEntry({ projectId, companyId, accountType: "LLC", ...data });
          return { id: result.id, ...data, method: data.method ?? null };
        }}
        showDragHandle={true}
        dragHandleProps={dragHandleProps}
        onEmailStatement={handleEmailLlcStatement}
      />
    </div>
  );
  cardMap["master"] = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => (
    <MasterCard
      projectId={projectId}
      partners={partners}
      partnerEntriesMap={partnerEntriesMap}
      capitalLinesByPartner={capitalLinesByPartner}
      llcEntries={llcEntries}
      showDragHandle={true}
      dragHandleProps={dragHandleProps}
    />
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {order.map((id) =>
            cardMap[id] ? (
              <SortableCard key={id} id={id} fullWidth={id === "llc" || id === "master" || isPartner}>
                {(dragHandleProps) => cardMap[id](dragHandleProps)}
              </SortableCard>
            ) : null
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
