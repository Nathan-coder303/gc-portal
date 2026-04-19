"use client";

import { useState, useTransition, createContext, useContext } from "react";
import { TrashIcon } from "@/components/ui/icons";
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCenter } from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  upsertEstimateItem,
  archiveEstimateItem,
  upsertEstimateDivision,
  archiveEstimateDivision,
  upsertEstimateGroup,
  archiveEstimateGroup,
  updateEstimate,
  updateEstimateGcFee,
  updateEstimateSqFt,
  updateEstimateDurationMonths,
  reorderEstimateDivisions,
  updateEstimateSummaryGroup,
  type SummaryGroupData,
} from "@/app/[companyId]/[projectId]/estimates/actions";
import {
  computeItemTotal,
  computeGroupTotal,
  computeDivisionTotal,
  computeEstimateTotal,
  fmt,
  type ItemLike,
} from "@/lib/estimates/totals";
import { lookupItemCsiCode, formatCsiCode } from "@/lib/divisions";

type Item = ItemLike & { id: string; name: string; csiCode: string | null; detail: string | null; unit: string | null; vendor: string | null; notes: string | null; sortOrder: number };
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };
type Estimate = { id: string; name: string; description: string | null; status: string; projectId: string; gcFeePercent: number | null; sqFt: number | null; durationMonths: number | null };

const STATUS_OPTIONS = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];
const DETAIL_OPTIONS = ["Included", "Excluded", "TBD", "By Owner", "Allowances"];

const SF_UNITS = new Set(["SF", "SQ"]);
const DURATION_KW = ["project management", "laborer", "portable potty", "tool rental", "tools"];
function isSfUnit(u: string) { return SF_UNITS.has(u.toUpperCase().trim()); }
function isDurationUnit(u: string) { return u.toUpperCase().trim() === "MO"; }
function isDurationName(name: string) { const n = name.toLowerCase(); return DURATION_KW.some(k => n.includes(k)); }

// ─── Summary groupings (super-divisions) ──────────────────────────────────────
const SUMMARY_GROUPS_E: { label: string; prefixes: string[] }[] = [
  { label: "SHELL", prefixes: ["03", "04"] },
];
function getGroupLabelE(csiCode: string | null): string | null {
  if (!csiCode) return null;
  const prefix = csiCode.replace(/\s/g, "").substring(0, 2);
  return SUMMARY_GROUPS_E.find(g => g.prefixes.includes(prefix))?.label ?? null;
}
function groupDivisionsE(divisions: Division[]): { groupLabel: string | null; divs: Division[] }[] {
  const result: { groupLabel: string | null; divs: Division[] }[] = [];
  for (const div of divisions) {
    const label = getGroupLabelE(div.csiCode);
    const last = result[result.length - 1];
    if (last && last.groupLabel === label && label !== null) { last.divs.push(div); }
    else { result.push({ groupLabel: label, divs: [div] }); }
  }
  return result;
}

const DimensionsCtx = createContext<{ sqFt: number | null; durationMonths: number | null }>({ sqFt: null, durationMonths: null });

function DetailSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(!!value && !DETAIL_OPTIONS.includes(value));
  if (custom) {
    return (
      <div className="flex gap-1 items-center">
        <input autoFocus className="w-24 border border-slate-300 rounded px-2 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Detail…" />
        <button onClick={() => { setCustom(false); onChange(""); }} className="text-xs text-slate-400">×</button>
      </div>
    );
  }
  return (
    <select value={DETAIL_OPTIONS.includes(value) ? value : ""} onChange={(e) => { if (e.target.value === "__custom__") { setCustom(true); onChange(""); } else { onChange(e.target.value); } }} className="border border-slate-300 rounded px-2 py-1 text-xs w-28">
      <option value="">—</option>
      {DETAIL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__custom__">Add detail…</option>
    </select>
  );
}

function ItemRowEdit({
  item,
  divisionId,
  groupId,
  canEdit,
  canArchive,
}: {
  item: Item;
  divisionId: string;
  groupId?: string | null;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const { sqFt, durationMonths } = useContext(DimensionsCtx);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: item.name,
    csiCode: item.csiCode ?? "",
    detail: item.detail ?? "",
    unit: item.unit ?? "",
    qty: item.qty,
    unitCost: item.unitCost,
    markupPct: item.markupPct,
    vendor: item.vendor ?? "",
    notes: item.notes ?? "",
  });

  function autoQty(name: string, unit: string, currentQty: number): number {
    if (isSfUnit(unit) && sqFt && sqFt > 0) return sqFt;
    if ((isDurationUnit(unit) || isDurationName(name)) && durationMonths && durationMonths > 0) return durationMonths;
    return currentQty;
  }

  const total = computeItemTotal(item);

  function save() {
    startTransition(async () => {
      await upsertEstimateItem(divisionId, {
        id: item.id,
        groupId: groupId ?? null,
        name: form.name,
        csiCode: form.csiCode || null,
        detail: form.detail || null,
        unit: form.unit || null,
        qty: Number(form.qty),
        unitCost: Number(form.unitCost),
        laborCost: 0,
        materialCost: 0,
        markupPct: Number(form.markupPct),
        vendor: form.vendor || null,
        notes: form.notes || null,
      });
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <tr className="border-t border-slate-100 hover:bg-slate-50 group">
        <td className="px-3 py-2 text-xs font-mono text-slate-400" style={{ whiteSpace: "nowrap" }}>{item.csiCode ?? ""}</td>
        <td className="px-3 py-2 text-sm text-slate-800">{item.name}</td>
        <td className="px-3 py-2 text-xs" style={{ color: item.detail === "Allowances" ? "#b45309" : item.detail === "Excluded" ? "#dc2626" : "#64748b" }}>{item.detail ?? "—"}</td>
        <td className="px-3 py-2 text-sm text-slate-700 text-right">{item.qty}</td>
        <td className="px-3 py-2 text-sm text-slate-500 text-center">{item.unit ?? "—"}</td>
        <td className="px-3 py-2 text-sm text-slate-700 text-right">${fmt(item.unitCost)}</td>
        <td className="px-3 py-2 text-sm text-slate-700 text-right">{item.markupPct}%</td>
        <td className="px-3 py-2 text-sm font-semibold text-slate-900 text-right">${fmt(total)}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 px-2">
                Edit
              </button>
            )}
            {canArchive && (
              <button
                onClick={() => startTransition(async () => { await archiveEstimateItem(item.id); })}
                disabled={isPending}
                className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                title="Remove"
              >
                <TrashIcon size={12} />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  const previewTotal = Number(form.qty) * Number(form.unitCost) * (1 + Number(form.markupPct) / 100);

  return (
    <tr className="border-t border-blue-100 bg-blue-50">
      <td className="px-2 py-1">
        <input className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono" value={form.csiCode} onChange={(e) => setForm({ ...form, csiCode: formatCsiCode(e.target.value) })} placeholder="CSI" />
      </td>
      <td className="px-2 py-1">
        <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.name} onChange={(e) => { const n = e.target.value; const auto = lookupItemCsiCode(n); setForm({ ...form, name: n, csiCode: auto ?? form.csiCode, qty: autoQty(n, form.unit, form.qty) }); }} />
      </td>
      <td className="px-2 py-1"><DetailSelect value={form.detail} onChange={(v) => setForm({ ...form, detail: v })} /></td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
      </td>
      <td className="px-2 py-1">
        <input className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-center" value={form.unit} onChange={(e) => { const u = e.target.value; setForm({ ...form, unit: u, qty: autoQty(form.name, u, form.qty) }); }} placeholder="unit" />
      </td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-20 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} />
      </td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.markupPct} onChange={(e) => setForm({ ...form, markupPct: Number(e.target.value) })} />
      </td>
      <td className="px-2 py-1 text-xs font-semibold text-slate-700 text-right">
        ${fmt(previewTotal)}
      </td>
      <td className="px-2 py-1">
        <div className="flex gap-1 justify-end">
          <button onClick={save} disabled={isPending} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-500 px-2 py-1">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function AddItemRow({ divisionId, groupId, canEdit }: { divisionId: string; groupId?: string | null; canEdit: boolean }) {
  const { sqFt, durationMonths } = useContext(DimensionsCtx);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", csiCode: "", detail: "", unit: "", qty: "1", unitCost: "0", markupPct: "0" });

  if (!canEdit) return null;

  function autoQty(name: string, unit: string, currentQty: string): string {
    if (isSfUnit(unit) && sqFt && sqFt > 0) return String(sqFt);
    if ((isDurationUnit(unit) || isDurationName(name)) && durationMonths && durationMonths > 0) return String(durationMonths);
    return currentQty;
  }

  function save() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await upsertEstimateItem(divisionId, {
        groupId: groupId ?? null,
        name: form.name,
        csiCode: form.csiCode || null,
        detail: form.detail || null,
        unit: form.unit || null,
        qty: Number(form.qty),
        unitCost: Number(form.unitCost),
        laborCost: 0,
        materialCost: 0,
        markupPct: Number(form.markupPct),
      });
      setForm({ name: "", csiCode: "", detail: "", unit: "", qty: "1", unitCost: "0", markupPct: "0" });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={9} className="px-3 py-1">
          <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:text-blue-800">+ Add Item</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-green-50 border-t border-green-100">
      <td className="px-2 py-1">
        <input className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono" value={form.csiCode} onChange={(e) => setForm({ ...form, csiCode: formatCsiCode(e.target.value) })} placeholder="CSI" />
      </td>
      <td className="px-2 py-1">
        <input autoFocus className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.name} onChange={(e) => { const n = e.target.value; const auto = lookupItemCsiCode(n); setForm({ ...form, name: n, csiCode: auto ?? form.csiCode, qty: autoQty(n, form.unit, form.qty) }); }} placeholder="Item name" />
      </td>
      <td className="px-2 py-1"><DetailSelect value={form.detail} onChange={(v) => setForm({ ...form, detail: v })} /></td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
      </td>
      <td className="px-2 py-1">
        <input className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-center" value={form.unit} onChange={(e) => { const u = e.target.value; setForm({ ...form, unit: u, qty: autoQty(form.name, u, form.qty) }); }} placeholder="unit" />
      </td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-20 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
      </td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.markupPct} onChange={(e) => setForm({ ...form, markupPct: e.target.value })} />
      </td>
      <td />
      <td className="px-2 py-1">
        <div className="flex gap-1 justify-end">
          <button onClick={save} disabled={isPending} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Add</button>
          <button onClick={() => setOpen(false)} className="text-xs text-slate-500 px-2 py-1">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function ItemTable({
  divisionId,
  groupId,
  items,
  canEdit,
  canArchive,
}: {
  divisionId: string;
  groupId?: string | null;
  items: Item[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 bg-slate-50">
            <th className="px-3 py-1.5 text-left font-medium w-20">CSI</th>
            <th className="px-3 py-1.5 text-left font-medium">Item</th>
            <th className="px-3 py-1.5 text-left font-medium w-28">Detail</th>
            <th className="px-3 py-1.5 text-right font-medium w-16">Qty</th>
            <th className="px-3 py-1.5 text-center font-medium w-16">Unit</th>
            <th className="px-3 py-1.5 text-right font-medium w-24">Cost</th>
            <th className="px-3 py-1.5 text-right font-medium w-16">Markup</th>
            <th className="px-3 py-1.5 text-right font-medium w-28 text-slate-800">TOTAL</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRowEdit
              key={item.id}
              item={item}
              divisionId={divisionId}
              groupId={groupId}
              canEdit={canEdit}
              canArchive={canArchive}
            />
          ))}
          <AddItemRow divisionId={divisionId} groupId={groupId} canEdit={canEdit} />
        </tbody>
      </table>
    </div>
  );
}

function GroupSection({
  group,
  divisionId,
  canEdit,
  canArchive,
}: {
  group: Group;
  divisionId: string;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const total = computeGroupTotal(group.items);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{group.name}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700">${fmt(total)}</span>
          {canArchive && (
            <button
              onClick={() => { startTransition(async () => { await archiveEstimateGroup(group.id); }); }}
              disabled={isPending}
              className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
              style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
              title="Remove group"
            >
              <TrashIcon size={12} />
            </button>
          )}
        </div>
      </div>
      <ItemTable divisionId={divisionId} groupId={group.id} items={group.items} canEdit={canEdit} canArchive={canArchive} />
    </div>
  );
}

function DivisionSection({
  division,
  canEdit,
  canArchive,
}: {
  division: Division;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [isPending, startTransition] = useTransition();
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  const total = computeDivisionTotal(division.groups, division.items);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: division.id });
  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: "div-" + division.id,
    data: { type: "division", divisionId: division.id },
    disabled: !canEdit,
  });

  function saveGroup() {
    if (!groupName.trim()) return;
    startTransition(async () => {
      await upsertEstimateGroup(division.id, { name: groupName });
      setGroupName("");
      setAddingGroup(false);
    });
  }

  return (
    <div ref={(node) => { setDropRef(node); setDragRef(node); }} className="bg-white rounded-xl overflow-hidden" style={{ border: isOver ? "2px solid #3b82f6" : "1px solid #e2e8f0", opacity: isDragging ? 0.4 : 1, transition: "border 0.1s" }}>
      {/* Mobile header */}
      <div
        className="w-full flex items-center gap-3 px-4 py-3 md:hidden cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <span className="text-base shrink-0 text-slate-500">{open ? "▼" : "▶"}</span>
        <div className="flex flex-col flex-1 min-w-0">
          {division.csiCode && <span className="text-[10px] font-semibold text-slate-400">{division.csiCode}</span>}
          <span className="text-sm font-bold text-slate-900 truncate">{division.name}</span>
        </div>
        <span className="text-sm font-bold text-slate-900 shrink-0">${fmt(total)}</span>
      </div>
      {/* Desktop header */}
      <div className="w-full hidden md:flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {canEdit && (
            <span className="text-slate-400 select-none cursor-grab text-sm" {...dragListeners} {...dragAttrs}>⠿</span>
          )}
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{open ? "▼" : "▶"}</span>
            {division.csiCode && (
              <span className="font-semibold text-slate-900">{division.csiCode}</span>
            )}
            <span className="font-semibold text-slate-900">{division.name}</span>
          </button>
        </div>
        <span className="text-sm font-bold text-slate-900">${fmt(total)}</span>
      </div>

      {open && (
        <div className="border-t border-slate-100 pb-2">
          {division.groups.map((grp) => (
            <GroupSection key={grp.id} group={grp} divisionId={division.id} canEdit={canEdit} canArchive={canArchive} />
          ))}

          {division.items.length > 0 && (
            <ItemTable divisionId={division.id} groupId={null} items={division.items} canEdit={canEdit} canArchive={canArchive} />
          )}

          {canEdit && (
            <div className="px-3 pt-2">
              {addingGroup ? (
                <div className="flex gap-2 items-center">
                  <input
                    autoFocus
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                    className="border border-slate-300 rounded px-2 py-1 text-xs flex-1"
                  />
                  <button onClick={saveGroup} disabled={isPending} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Add</button>
                  <button onClick={() => setAddingGroup(false)} className="text-xs text-slate-500">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingGroup(true)} className="text-xs text-slate-400 hover:text-blue-600">
                  + Add Group
                </button>
              )}
            </div>
          )}

          {canArchive && (
            <div className="px-3 pt-1">
              <button
                onClick={() => { startTransition(async () => { await archiveEstimateDivision(division.id); }); }}
                disabled={isPending}
                className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                title="Remove division"
              >
                <TrashIcon size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectEstimateEditor({
  estimate,
  divisions,
  canEdit,
  canArchive,
  companyId,
  projectId,
  initialSummaryGroups,
}: {
  estimate: Estimate;
  divisions: Division[];
  canEdit: boolean;
  canArchive: boolean;
  companyId: string;
  projectId: string;
  initialSummaryGroups?: Record<string, SummaryGroupData> | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState(estimate.name);
  const [description, setDescription] = useState(estimate.description ?? "");
  const [status, setStatus] = useState(estimate.status);
  const [addingDiv, setAddingDiv] = useState(false);
  const [divName, setDivName] = useState("");
  const [divCsi, setDivCsi] = useState("");

  const subtotal = computeEstimateTotal(divisions);
  const [gcFeePercent, setGcFeePercent] = useState<number | "">(estimate.gcFeePercent ?? "");
  const gcFeeAmount = typeof gcFeePercent === "number" && gcFeePercent > 0 ? subtotal * gcFeePercent / 100 : 0;
  const grandTotal = subtotal + gcFeeAmount;
  const [sqFt, setSqFt] = useState<number | "">(estimate.sqFt ?? "");
  const [durationMonths, setDurationMonths] = useState<number | "">(estimate.durationMonths ?? "");
  const [summaryGroups, setSummaryGroups] = useState<Record<string, SummaryGroupData>>(initialSummaryGroups ?? {});
  const [editingSummaryGroup, setEditingSummaryGroup] = useState<string | null>(null);
  const [sgForm, setSgForm] = useState<SummaryGroupData>({ qty: null, unit: null, unitCost: null, markupPct: null, manualTotal: null });
  const [activeDivName, setActiveDivName] = useState<string | null>(null);

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "division") {
      const divId = event.active.data.current.divisionId as string;
      setActiveDivName(divisions.find(d => d.id === divId)?.name ?? "");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDivName(null);
    const { active, over } = event;
    if (!over || active.data.current?.type !== "division") return;
    const activeDivId = active.data.current.divisionId as string;
    const overDivId = over.id as string;
    if (activeDivId === overDivId) return;
    const oldIdx = divisions.findIndex(d => d.id === activeDivId);
    const newIdx = divisions.findIndex(d => d.id === overDivId);
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = divisions.map(d => d.id);
    newOrder.splice(oldIdx, 1);
    newOrder.splice(newIdx, 0, activeDivId);
    startTransition(async () => {
      await reorderEstimateDivisions(estimate.id, newOrder);
    });
  }

  function saveHeader() {
    startTransition(async () => {
      await updateEstimate(estimate.id, name, description || null, status);
      setEditingHeader(false);
    });
  }

  function saveDiv() {
    if (!divName.trim()) return;
    startTransition(async () => {
      await upsertEstimateDivision(estimate.id, { csiCode: divCsi || undefined, name: divName });
      setDivName("");
      setDivCsi("");
      setAddingDiv(false);
    });
  }

  return (
    <DimensionsCtx.Provider value={{ sqFt: typeof sqFt === "number" ? sqFt : null, durationMonths: typeof durationMonths === "number" ? durationMonths : null }}>
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="space-y-4">

      {/* Sticky total bar */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between gap-4 px-5 py-3 shadow-xl"
        style={{ background: "#161b22", borderTop: "3px solid #C9A84C", borderBottom: "1px solid #30373f" }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>💰 Live Total</span>
        <div className="flex items-center gap-6">
          {gcFeeAmount > 0 && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: "#555" }}>Subtotal</span>
                <span className="text-sm font-semibold" style={{ color: "#8b949e" }}>${fmt(subtotal)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: "#555" }}>GC O&amp;P {gcFeePercent}%</span>
                <span className="text-sm font-semibold" style={{ color: "#C9A84C" }}>${fmt(gcFeeAmount)}</span>
              </div>
            </>
          )}
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: "#8b949e" }}>Total w/ GC Fee</span>
            <span className="text-2xl font-bold" style={{ color: "#C9A84C" }}>${fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {editingHeader ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveHeader} disabled={isPending} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Save</button>
              <button onClick={() => setEditingHeader(false)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{estimate.name}</h1>
              {estimate.description && <p className="text-sm text-slate-500 mt-1">{estimate.description}</p>}
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{estimate.status}</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {/* Total + dimension cards stacked */}
              <div className="flex flex-col gap-2">
                {/* Prominent TOTAL card */}
                <div className="bg-slate-900 text-white rounded-xl px-6 py-5 flex flex-col gap-2 min-w-[200px]">
                  {gcFeeAmount > 0 && (
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Subtotal</span>
                      <span>${fmt(subtotal)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400 shrink-0">GC O&P %</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={gcFeePercent}
                      onChange={e => setGcFeePercent(e.target.value === "" ? "" : Number(e.target.value))}
                      onBlur={() => {
                        const val = gcFeePercent === "" ? null : Number(gcFeePercent);
                        startTransition(async () => { await updateEstimateGcFee(estimate.id, val); });
                      }}
                      placeholder="0"
                      className="rounded px-2 py-1 text-xs text-right w-16 bg-slate-800 border border-slate-600 text-yellow-400"
                    />
                  </div>
                  {gcFeeAmount > 0 && (
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>GC O&P</span>
                      <span className="text-yellow-400">${fmt(gcFeeAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-700 pt-2 text-center">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Total</div>
                    <div className="text-5xl font-bold leading-none">${fmt(grandTotal)}</div>
                  </div>
                </div>
                {/* Sq Ft card */}
                <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-slate-900">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Sq Ft</div>
                    <div className="text-[10px] mt-0.5 text-slate-500">Updates SF unit items</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={sqFt}
                    onChange={e => setSqFt(e.target.value === "" ? "" : Number(e.target.value))}
                    onBlur={() => {
                      const val = sqFt === "" ? null : Number(sqFt);
                      startTransition(async () => { await updateEstimateSqFt(estimate.id, val); });
                    }}
                    placeholder="0"
                    className="rounded px-2 py-1 text-xs text-right w-20 bg-slate-800 border border-slate-600 text-yellow-400"
                  />
                </div>
                {/* Duration card */}
                <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-slate-900">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Duration (months)</div>
                    <div className="text-[10px] mt-0.5 text-slate-500">Updates mgmt, labor, potty, tools</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={durationMonths}
                    onChange={e => setDurationMonths(e.target.value === "" ? "" : Number(e.target.value))}
                    onBlur={() => {
                      const val = durationMonths === "" ? null : Number(durationMonths);
                      startTransition(async () => { await updateEstimateDurationMonths(estimate.id, val); });
                    }}
                    placeholder="0"
                    className="rounded px-2 py-1 text-xs text-right w-20 bg-slate-800 border border-slate-600 text-yellow-400"
                  />
                </div>
              </div>
              {/* Actions */}
              <div className="flex flex-col gap-2 items-start">
                <a
                  href={`/api/${companyId}/${projectId}/estimates/${estimate.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 font-medium"
                >
                  Export PDF
                </a>
                {canEdit && (
                  <button onClick={() => setEditingHeader(true)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divisions — grouped into super-sections (e.g. SHELL) */}
      <div className="space-y-3">
        {groupDivisionsE(divisions).map(({ groupLabel, divs }, gi) => {
          const rawTotal = divs.reduce((s, d) => s + computeDivisionTotal(d.groups, d.items), 0);
          const sg = groupLabel ? summaryGroups[groupLabel] : undefined;
          let overrideTotal: number | null = null;
          if (sg) {
            if (sg.manualTotal !== null && sg.manualTotal !== undefined) overrideTotal = sg.manualTotal;
            else if (sg.qty !== null || sg.unitCost !== null) overrideTotal = (sg.qty ?? 0) * (sg.unitCost ?? 0) * (1 + (sg.markupPct ?? 0) / 100);
          }
          const displayTotal = overrideTotal !== null ? overrideTotal : rawTotal;
          const isEditing = editingSummaryGroup === groupLabel;
          const computedSgTotal = sgForm.qty !== null || sgForm.unitCost !== null
            ? (sgForm.qty ?? 0) * (sgForm.unitCost ?? 0) * (1 + (sgForm.markupPct ?? 0) / 100)
            : null;
          const UNITS_E = ["_", "LS", "EA", "SF", "LF", "SY", "CY", "CF", "SQ", "MO", "HR", "DAY", "TN", "GAL"];

          return (
            <div key={gi}>
              {groupLabel && (
                <div>
                  <div className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: "#C9A84C", color: "#0d1117" }}>
                    <span className="text-sm font-bold tracking-widest uppercase">{groupLabel}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">${displayTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {canEdit && (
                        <button
                          onClick={() => {
                            if (isEditing) { setEditingSummaryGroup(null); }
                            else {
                              setSgForm(sg ?? { qty: null, unit: null, unitCost: null, markupPct: null, manualTotal: null });
                              setEditingSummaryGroup(groupLabel);
                            }
                          }}
                          className="text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ background: "rgba(0,0,0,0.25)", color: "#0d1117" }}
                        >
                          {isEditing ? "×" : "Edit"}
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditing && (
                    <div className="rounded-b-lg p-3 space-y-2 bg-amber-50 border border-amber-300 border-t-0">
                      <p className="text-xs font-semibold text-amber-700">Override {groupLabel} Total</p>
                      <div className="flex flex-wrap gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Qty</label>
                          <input type="number" className="border border-slate-300 rounded px-2 py-1 text-xs w-20"
                            value={sgForm.qty ?? ""} onChange={e => setSgForm(f => ({ ...f, qty: e.target.value ? Number(e.target.value) : null }))} placeholder="Qty" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Unit</label>
                          <select className="border border-slate-300 rounded px-2 py-1 text-xs w-20"
                            value={sgForm.unit ?? ""} onChange={e => setSgForm(f => ({ ...f, unit: e.target.value || null }))}>
                            <option value="">—</option>
                            {UNITS_E.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Unit Cost</label>
                          <input type="number" className="border border-slate-300 rounded px-2 py-1 text-xs w-24"
                            value={sgForm.unitCost ?? ""} onChange={e => setSgForm(f => ({ ...f, unitCost: e.target.value ? Number(e.target.value) : null }))} placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Markup %</label>
                          <input type="number" className="border border-slate-300 rounded px-2 py-1 text-xs w-20"
                            value={sgForm.markupPct ?? ""} onChange={e => setSgForm(f => ({ ...f, markupPct: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Manual Total Override</label>
                          <input type="number" className="border border-slate-300 rounded px-2 py-1 text-xs w-28"
                            value={sgForm.manualTotal ?? ""} onChange={e => setSgForm(f => ({ ...f, manualTotal: e.target.value ? Number(e.target.value) : null }))} placeholder="0.00" />
                        </div>
                      </div>
                      {computedSgTotal !== null && sgForm.manualTotal === null && (
                        <p className="text-xs text-slate-500">Computed: ${fmt(computedSgTotal)}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          className="text-xs rounded px-3 py-1 font-semibold text-white bg-amber-600 hover:bg-amber-700"
                          onClick={() => startTransition(async () => {
                            await updateEstimateSummaryGroup(estimate.id, groupLabel, sgForm);
                            setSummaryGroups(g => ({ ...g, [groupLabel]: sgForm }));
                            setEditingSummaryGroup(null);
                          })}
                        >Save</button>
                        <button
                          className="text-xs rounded px-3 py-1 text-slate-600 bg-slate-200 hover:bg-slate-300"
                          onClick={() => startTransition(async () => {
                            await updateEstimateSummaryGroup(estimate.id, groupLabel, null);
                            setSummaryGroups(g => { const n = { ...g }; delete n[groupLabel]; return n; });
                            setEditingSummaryGroup(null);
                          })}
                        >Reset to auto</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className={groupLabel ? "space-y-2 pl-2" : "space-y-3"}>
                {divs.map((div) => (
                  <DivisionSection key={div.id} division={div} canEdit={canEdit} canArchive={canArchive} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Division */}
      {canEdit && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4">
          {addingDiv ? (
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CSI Code (optional)</label>
                <input value={divCsi} onChange={(e) => setDivCsi(formatCsiCode(e.target.value))} placeholder="e.g. 03" className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Division Name</label>
                <input autoFocus value={divName} onChange={(e) => setDivName(e.target.value)} placeholder="e.g. Concrete" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <button onClick={saveDiv} disabled={isPending} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Add</button>
              <button onClick={() => setAddingDiv(false)} className="text-slate-500 text-sm px-2">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingDiv(true)} className="text-sm text-slate-400 hover:text-blue-600 w-full text-center">
              + Add Division
            </button>
          )}
        </div>
      )}

      {/* Allowances card */}
      {(() => {
        const allowanceItems = divisions.flatMap(d => [
          ...d.items.filter(i => i.detail === "Allowances"),
          ...d.groups.flatMap(g => g.items.filter(i => i.detail === "Allowances")),
        ]);
        const allowanceTotal = allowanceItems.reduce((s, i) => s + computeItemTotal(i), 0);
        if (allowanceItems.length === 0) return null;
        return (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm uppercase tracking-wide text-amber-700">Allowances</span>
              <span className="font-bold text-xl text-amber-700">${fmt(allowanceTotal)}</span>
            </div>
            <div className="space-y-1">
              {allowanceItems.map(i => (
                <div key={i.id} className="flex justify-between text-xs text-slate-600">
                  <span>{i.csiCode ? <span className="font-mono mr-2">{i.csiCode}</span> : null}{i.name}</span>
                  <span>{computeItemTotal(i) > 0 ? `$${fmt(computeItemTotal(i))}` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Summary footer */}
      <div className="bg-slate-900 text-white rounded-xl p-5 flex justify-between items-center">
        <span className="font-semibold text-lg">Estimate Total</span>
        <span className="text-4xl font-bold">${fmt(grandTotal)}</span>
      </div>
    </div>
    <DragOverlay>
      {activeDivName && (
        <div className="rounded-xl px-4 py-3 text-sm font-semibold shadow-xl pointer-events-none bg-white border border-blue-400 text-slate-900" style={{ opacity: 0.95 }}>
          ⠿ {activeDivName}
        </div>
      )}
    </DragOverlay>
    </DndContext>
    </DimensionsCtx.Provider>
  );
}
