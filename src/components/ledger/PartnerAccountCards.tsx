"use client";

import { useState } from "react";
import {
  updatePartnerBeginningBalance,
  updateLlcBeginningBalance,
  addPartnerAccountEntry,
  deletePartnerAccountEntry,
  updatePartnerAccountEntry,
} from "@/app/[companyId]/[projectId]/ledger/actions";
import { format } from "date-fns";
import PayeeSelect from "@/components/ledger/PayeeSelect";

const GOLD = "#C9A84C";
const INPUT_STYLE = { background: "#1e2736", border: "1px solid #30373f", color: "#e6edf3" };
const TODAY = new Date().toISOString().split("T")[0];

type Entry = {
  id: string;
  description: string;
  amount: number;
  entryType: "CREDIT" | "DEBIT";
  date: string;
};

type CapitalLine = {
  entryId: string;
  date: string;
  memo: string;
  debit: number;
  credit: number;
};

type Partner = { id: string; name: string; beginningBalance: number };

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
  onSave: (id: string, data: { description: string; amount: number; date: string }) => Promise<void | { success: boolean }>;
  onDelete: (id: string) => Promise<void | { success: boolean }>;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(entry.description);
  const [amount, setAmount] = useState(String(entry.amount));
  const [date, setDate] = useState(entry.date);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(entry.id, { description: desc, amount: parseFloat(amount), date });
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full rounded px-2 py-1.5 text-xs focus:outline-none"
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
        <div className="text-[10px]" style={{ color: "#8b949e" }}>{fmtDate(entry.date)}</div>
      </div>
      <span className="text-xs font-mono font-semibold shrink-0"
        style={{ color: entry.entryType === "CREDIT" ? "#4ade80" : "#f87171" }}>
        {entry.entryType === "CREDIT" ? "+" : "−"}${fmt(entry.amount)}
      </span>
      {isAdmin && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditing(true)}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: GOLD, background: "#C9A84C11" }}>✎</button>
          <button onClick={del} disabled={deleting}
            className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-50"
            style={{ color: "#f87171", background: "#2d1b1b" }}>{deleting ? "..." : "✕"}</button>
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
  onAdd,
  onSave,
  onDelete,
  isAdmin,
  payees,
  partnerNames,
}: {
  title: string;
  subtitle?: string;
  beginningBalance: number;
  entries: Entry[];
  capitalLines?: CapitalLine[];
  onUpdateBeginning: (amount: number) => Promise<void | { success: boolean }>;
  onAdd: (e: { description: string; amount: number; entryType: "CREDIT" | "DEBIT"; date: string }) => Promise<void | { success: boolean }>;
  onSave: (id: string, data: { description: string; amount: number; date: string }) => Promise<void | { success: boolean }>;
  onDelete: (id: string) => Promise<void | { success: boolean }>;
  isAdmin: boolean;
  payees: string[];
  partnerNames: string[];
}) {
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(beginningBalance));
  const [savingBalance, setSavingBalance] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(true);
  const [addingEntry, setAddingEntry] = useState<"CREDIT" | "DEBIT" | null>(null);
  const [source, setSource] = useState("");
  const [payee, setPayee] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY);
  const [saving, setSaving] = useState(false);

  const credits = entries.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);
  const debits = entries.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
  const journalCredits = (capitalLines ?? []).reduce((s, l) => s + l.credit, 0);
  const journalDebits = (capitalLines ?? []).reduce((s, l) => s + l.debit, 0);
  const balance = beginningBalance + credits - debits + journalCredits - journalDebits;

  async function saveBalance() {
    setSavingBalance(true);
    try {
      await onUpdateBeginning(parseFloat(balanceInput) || 0);
      setEditingBalance(false);
    } finally { setSavingBalance(false); }
  }

  async function saveEntry() {
    if (!addingEntry || !amount) return;
    setSaving(true);
    try {
      const fullDesc = [source, payee, desc].filter(Boolean).join(" → ") || "Entry";
      await onAdd({ description: fullDesc, amount: parseFloat(amount), entryType: addingEntry, date });
      setSource(""); setPayee(""); setDesc(""); setAmount(""); setDate(TODAY); setAddingEntry(null);
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
      {/* Header */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#8b949e" }}>{subtitle}</div>
        <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>{title}</div>
      </div>

      {/* Balance */}
      <div className="rounded-lg p-3" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
        <div className="text-[10px] mb-0.5" style={{ color: "#8b949e" }}>Current Balance</div>
        <div className="text-xl font-bold font-mono" style={{ color: balance >= 0 ? "#4ade80" : "#f87171" }}>
          ${fmt(balance)}
        </div>
        <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "#8b949e" }}>
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

      {/* Manual transactions — collapsible */}
      {entries.length > 0 && (
        <div>
          <button
            onClick={() => setTxOpen((o) => !o)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
              Transactions ({entries.length})
            </span>
            <span className="text-[10px]" style={{ color: "#8b949e" }}>{txOpen ? "▲" : "▼"}</span>
          </button>
          {txOpen && (
            <div className="space-y-1 mt-1.5">
              {entries.map((e) => (
                <EditableEntry key={e.id} entry={e} isAdmin={isAdmin} onSave={onSave} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add entry */}
      {addingEntry ? (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "#1e2736", border: `1px solid ${addingEntry === "CREDIT" ? "#166534" : "#6b2a2a"}` }}>
          <div className="text-xs font-semibold" style={{ color: addingEntry === "CREDIT" ? "#4ade80" : "#f87171" }}>
            {addingEntry === "CREDIT" ? "+ Credit / Income" : "− Debit / Expense"}
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] mb-1" style={{ color: "#8b949e" }}>Payment Source / From</label>
                <select value={source} onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  style={INPUT_STYLE}>
                  <option value="">— Select —</option>
                  <option value="Chase 8536">Chase 8536</option>
                  {partnerNames.map((n) => (
                    <option key={n} value={`${n}'s Account`}>{n}&apos;s Account</option>
                  ))}
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="ACH">ACH</option>
                  <option value="Wire Transfer">Wire Transfer</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: "#8b949e" }}>Payee / To</label>
                <PayeeSelect
                  initialPayees={payees}
                  value={payee}
                  onChange={setPayee}
                  inputStyle={{ ...INPUT_STYLE, fontSize: "12px" }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: "#8b949e" }}>Description</label>
              <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Rental income" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                style={INPUT_STYLE} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] mb-1" style={{ color: "#8b949e" }}>Amount ($)</label>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  style={INPUT_STYLE} />
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: "#8b949e" }}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  style={INPUT_STYLE} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveEntry} disabled={saving || !amount}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
              style={{ background: GOLD, color: "#0d1117" }}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => { setAddingEntry(null); setSource(""); setPayee(""); setDesc(""); setAmount(""); }}
              className="px-3 py-1.5 text-xs rounded-lg"
              style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setAddingEntry("CREDIT")}
            className="flex-1 py-2 text-xs font-semibold rounded-lg"
            style={{ background: "#0d2a1a", color: "#4ade80", border: "1px solid #166534" }}>
            + Credit / Income
          </button>
          <button onClick={() => setAddingEntry("DEBIT")}
            className="flex-1 py-2 text-xs font-semibold rounded-lg"
            style={{ background: "#2d1b1b", color: "#f87171", border: "1px solid #6b2a2a" }}>
            − Debit / Expense
          </button>
        </div>
      )}
    </div>
  );
}

export default function PartnerAccountCards({
  projectId,
  companyId,
  partners,
  llcBeginningBalance,
  partnerEntriesMap,
  llcEntries,
  capitalLinesByPartner,
  isAdmin,
  payees,
}: {
  projectId: string;
  companyId: string;
  partners: Partner[];
  llcBeginningBalance: number;
  partnerEntriesMap: Record<string, Entry[]>;
  llcEntries: Entry[];
  capitalLinesByPartner: Record<string, CapitalLine[]>;
  isAdmin: boolean;
  payees: string[];
}) {
  const partnerNames = partners.map((p) => p.name);
  function makeSave() {
    return (id: string, data: { description: string; amount: number; date: string }) =>
      updatePartnerAccountEntry(id, data, companyId, projectId).then(() => {});
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {partners.map((partner) => (
        <AccountCard
          key={partner.id}
          title={`${partner.name}'s Account`}
          subtitle="Partner's Account"
          beginningBalance={partner.beginningBalance}
          entries={partnerEntriesMap[partner.id] ?? []}
          capitalLines={capitalLinesByPartner[partner.id] ?? []}
          isAdmin={isAdmin}
          onUpdateBeginning={(amount) => updatePartnerBeginningBalance(partner.id, amount)}
          onAdd={(e) => addPartnerAccountEntry({ ...e, projectId, companyId, accountType: "PARTNER", partnerId: partner.id })}
          onSave={makeSave()}
          onDelete={(id) => deletePartnerAccountEntry(id, companyId, projectId)}
          payees={payees}
          partnerNames={partnerNames}
        />
      ))}
      <AccountCard
        title="LLC Account"
        subtitle="Project Account"
        beginningBalance={llcBeginningBalance}
        entries={llcEntries}
        isAdmin={isAdmin}
        onUpdateBeginning={(amount) => updateLlcBeginningBalance(projectId, amount)}
        onAdd={(e) => addPartnerAccountEntry({ ...e, projectId, companyId, accountType: "LLC" })}
        onSave={makeSave()}
        onDelete={(id) => deletePartnerAccountEntry(id, companyId, projectId)}
        payees={payees}
        partnerNames={partnerNames}
      />
    </div>
  );
}
