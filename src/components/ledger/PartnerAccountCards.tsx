"use client";

import { useState, useEffect } from "react";
import {
  updatePartnerBeginningBalance,
  updateLlcBeginningBalance,
  deletePartnerAccountEntry,
  updatePartnerAccountEntry,
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
  onSave,
  onDelete,
  isAdmin,
  showDragHandle,
  dragHandleProps,
}: {
  title: string;
  subtitle?: string;
  beginningBalance: number;
  entries: Entry[];
  capitalLines?: CapitalLine[];
  onUpdateBeginning: (amount: number) => Promise<void | { success: boolean }>;
  onSave: (id: string, data: { description: string; amount: number; date: string }) => Promise<void | { success: boolean }>;
  onDelete: (id: string) => Promise<void | { success: boolean }>;
  isAdmin: boolean;
  showDragHandle?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(beginningBalance));
  const [savingBalance, setSavingBalance] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(true);

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

return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#8b949e" }}>{subtitle}</div>
          <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>{title}</div>
        </div>
        {showDragHandle && (
          <div
            {...(dragHandleProps ?? {})}
            className="cursor-grab active:cursor-grabbing px-1 py-0.5 rounded text-sm select-none"
            style={{ color: "#8b949e", touchAction: "none" }}
          >
            ⠿
          </div>
        )}
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

    </div>
  );
}

function MasterCard({
  partners,
  partnerEntriesMap,
  capitalLinesByPartner,
  llcEntries,
  showDragHandle,
  dragHandleProps,
}: {
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

  const eddie = partners.find((p) => p.name === "Eddie Yakubov");
  const yosef = partners.find((p) => p.name === "Yosef Yakubov");
  const eddieBalance = eddie ? partnerBalance(eddie) : 0;
  const yosefBalance = yosef ? partnerBalance(yosef) : 0;

  const llcExpenseItems = llcEntries.filter((e) => e.entryType === "DEBIT");
  const llcExpenses = llcExpenseItems.reduce((s, e) => s + e.amount, 0);

  const EDDIE_CONTRIB = 55000;
  const YOSEF_CONTRIB = 25000;
  const CASH_ON_HAND = 25000;
  const BANK_ACCOUNT = 150000;

  const total = eddieBalance + yosefBalance + EDDIE_CONTRIB + YOSEF_CONTRIB - CASH_ON_HAND - llcExpenses - BANK_ACCOUNT;

  const rows: { label: string; value: number; dynamic?: boolean }[] = [
    { label: "Eddie's Balance", value: eddieBalance, dynamic: true },
    { label: "Yosef's Balance", value: yosefBalance, dynamic: true },
    { label: "Contribution to LLC (Eddie)", value: EDDIE_CONTRIB },
    { label: "Contribution to LLC (Yosef)", value: YOSEF_CONTRIB },
    { label: "Cash on Hand", value: -CASH_ON_HAND },
    { label: `Items Paid by LLC (${llcExpenseItems.length})`, value: -llcExpenses, dynamic: true },
    { label: "Bank Account", value: -BANK_ACCOUNT },
  ];

  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#0d1117", border: `1px solid ${GOLD}` }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: GOLD }}>Master Summary</div>
          <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>Mike Master</div>
        </div>
        {showDragHandle && (
          <div {...(dragHandleProps ?? {})} className="cursor-grab active:cursor-grabbing px-1 py-0.5 rounded text-sm select-none" style={{ color: "#8b949e", touchAction: "none" }}>
            ⠿
          </div>
        )}
      </div>

      <div className="rounded-lg p-3" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
        <div className="text-[10px] mb-0.5" style={{ color: "#8b949e" }}>Net Total</div>
        <div className="text-xl font-bold font-mono" style={{ color: total >= 0 ? "#4ade80" : "#f87171" }}>
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
                <span className="text-xs font-mono font-semibold shrink-0"
                  style={{ color: row.value >= 0 ? "#4ade80" : "#f87171" }}>
                  {row.value >= 0 ? "+" : "−"}${fmt(Math.abs(row.value))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
  partners,
  llcBeginningBalance,
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
  partnerEntriesMap: Record<string, Entry[]>;
  llcEntries: Entry[];
  capitalLinesByPartner: Record<string, CapitalLine[]>;
  isAdmin: boolean;
  isPartner?: boolean;
}) {
  const defaultOrder = [...partners.map((p) => p.id), "llc", ...(isAdmin ? ["master"] : [])];

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
    return (id: string, data: { description: string; amount: number; date: string }) =>
      updatePartnerAccountEntry(id, data, companyId, projectId).then(() => {});
  }

  type CardRenderer = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
  const cardMap: Record<string, CardRenderer> = {};
  for (const partner of partners) {
    cardMap[partner.id] = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => (
      <AccountCard
        title={`${partner.name}'s Account`}
        subtitle="Partner's Account"
        beginningBalance={partner.beginningBalance}
        entries={partnerEntriesMap[partner.id] ?? []}
        capitalLines={capitalLinesByPartner[partner.id] ?? []}
        isAdmin={isAdmin}
        onUpdateBeginning={(amount) => updatePartnerBeginningBalance(partner.id, amount)}
        onSave={makeSave()}
        onDelete={(id) => deletePartnerAccountEntry(id, companyId, projectId)}
        showDragHandle={true}
        dragHandleProps={dragHandleProps}
      />
    );
  }
  cardMap["llc"] = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => (
    <AccountCard
      title="13 Million 84 LLC"
      subtitle="Project Account"
      beginningBalance={llcBeginningBalance}
      entries={llcEntries}
      isAdmin={isAdmin}
      onUpdateBeginning={(amount) => updateLlcBeginningBalance(projectId, amount)}
      onSave={makeSave()}
      onDelete={(id) => deletePartnerAccountEntry(id, companyId, projectId)}
      showDragHandle={true}
      dragHandleProps={dragHandleProps}
    />
  );
  cardMap["master"] = (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => (
    <MasterCard
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
