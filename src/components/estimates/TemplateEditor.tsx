"use client";

import { useState, useTransition, useRef, useCallback, createContext, useContext, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";
import CoverPagePickerModal, { PdfOptions, CoverType } from "@/components/clients/CoverPagePickerModal";
import { lookupItemCsiCode, formatCsiCode, DIVISIONS } from "@/lib/divisions";
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  upsertTemplateItem,
  archiveTemplateItem,
  upsertTemplateDivision,
  seedTemplateDivisionFromHistory,
  archiveTemplateDivision,
  mergeTemplateDivisionInto,
  upsertTemplateGroup,
  archiveTemplateGroup,
  updateTemplate,
  saveAsNewTemplate,
  setTemplateClient,
  upsertClient,
  saveAsClientEstimate,
  updateTemplatePaymentSchedule,
  updateTemplateShowTerms,
  updateTemplateTermsContent,
  updateTemplateGcFee,
  updateTemplateInternalProfit,
  updateTemplateSqFt,
  updateTemplateDurationMonths,
  moveItemBetweenDivisions,
  moveItemToGroup,
  restoreTemplateItem,
  restoreTemplateGroup,
  restoreTemplateDivision,
  reorderTemplateDivisions,
  reorderTemplateItems,
  updateTemplateSummaryGroup,
  updateTemplateHasSkylights,
  updateTemplateHasRoofDrains,
  updateTemplateInsulationType,
  updateTemplateCombinationType,
  type SummaryGroupData,
} from "@/app/[companyId]/estimates/actions";

type Item = {
  id: string;
  name: string;
  csiCode: string | null;
  detail: string | null;
  unit: string | null;
  defaultQty: number | null;
  defaultUnitCost: number | null;
  defaultLaborCost: number | null;
  defaultMaterialCost: number | null;
  defaultMarkupPct: number | null;
  notes: string | null;
  visibleInPdf: boolean;
};
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; manualTotal: number | null; groups: Group[]; items: Item[] };
type PaymentRow = { payment: string; trigger: string; pct: number };
type Template = { id: string; name: string; description: string | null; companyId: string; estimateNumber: string | null; estimateDate: string | null; paymentSchedule: PaymentRow[] | null; showTerms: boolean; termsContent: string | null; type: string; gcFeePercent: number | null; internalProfitOverride: number | null; sqFt: number | null; durationMonths: number | null; hasSkylights: boolean | null; hasRoofDrains: boolean | null; insulationType: string | null; combinationType: string | null };

const INPUT = "rounded px-2 py-1 text-xs" as const;
const inputStyle = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" };
const inputStyleSm = { background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", width: "100%" };

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function itemTotal(item: Item): number {
  const qty = item.defaultQty ?? 0;
  const cost = item.defaultUnitCost ?? 0;
  const markup = item.defaultMarkupPct ?? 0;
  return qty * cost * (1 + markup / 100);
}

function groupTotal(items: Item[]): number {
  return items.reduce((s, i) => s + itemTotal(i), 0);
}

const UNITS = ["_", "LS", "EA", "SF", "LF", "SY", "CY", "CF", "SQ", "MO", "HR", "DAY", "TN", "GAL"];
const DETAIL_OPTIONS = ["Included", "Excluded", "TBD", "By Owner", "Allowances"];

// ─── Summary groupings (super-divisions) ──────────────────────────────────────
const SUMMARY_GROUPS_T: { label: string; prefixes: string[] }[] = [
  { label: "SHELL", prefixes: ["03", "04"] },
];
function getGroupLabelT(csiCode: string | null): string | null {
  if (!csiCode) return null;
  const prefix = csiCode.replace(/\s/g, "").substring(0, 2);
  return SUMMARY_GROUPS_T.find(g => g.prefixes.includes(prefix))?.label ?? null;
}
function groupDivisionsT(divisions: Division[]): { groupLabel: string | null; divs: Division[] }[] {
  const result: { groupLabel: string | null; divs: Division[] }[] = [];
  for (const div of divisions) {
    const label = getGroupLabelT(div.csiCode);
    const last = result[result.length - 1];
    if (last && last.groupLabel === label && label !== null) { last.divs.push(div); }
    else { result.push({ groupLabel: label, divs: [div] }); }
  }
  return result;
}

const SF_UNITS_T = new Set(["SF", "SQ"]);
const DURATION_KW_T = ["project management", "laborer", "portable potty", "tool rental", "tools"];
function isSfUnitT(u: string) { return SF_UNITS_T.has(u.toUpperCase().trim()); }
function isDurationUnitT(u: string) { return u.toUpperCase().trim() === "MO"; }
function isDurationNameT(name: string) { const n = name.toLowerCase(); return DURATION_KW_T.some(k => n.includes(k)); }

const TDimensionsCtx = createContext<{ sqFt: number | null; durationMonths: number | null; isRoof: boolean }>({ sqFt: null, durationMonths: null, isRoof: false });
const DivisionEditCtx = createContext<{ editAllSignal: number; saveSignal: number; resetAllSignal: number }>({ editAllSignal: 0, saveSignal: 0, resetAllSignal: 0 });

type UndoEntry = { label: string; undo: () => Promise<void>; redo: () => Promise<void> };
type UndoState = { past: UndoEntry[]; future: UndoEntry[] };
type UndoAction = { type: "push"; entry: UndoEntry } | { type: "undo" } | { type: "redo" };
function undoReducer(state: UndoState, action: UndoAction): UndoState {
  if (action.type === "push") return { past: [...state.past.slice(-29), action.entry], future: [] };
  if (action.type === "undo") {
    const entry = state.past[state.past.length - 1];
    if (!entry) return state;
    return { past: state.past.slice(0, -1), future: [entry, ...state.future] };
  }
  if (action.type === "redo") {
    const entry = state.future[0];
    if (!entry) return state;
    return { past: [...state.past, entry], future: state.future.slice(1) };
  }
  return state;
}
const UndoCtx = createContext<{ pushUndo: (entry: UndoEntry) => void }>({ pushUndo: () => {} });

function DetailSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(!!value && !DETAIL_OPTIONS.includes(value));
  if (custom) {
    return (
      <div className="flex gap-1 items-center">
        <input
          autoFocus
          className={INPUT}
          style={{ ...inputStyle, width: "110px" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Detail…"
        />
        <button onClick={() => { setCustom(false); onChange(""); }} className="text-xs" style={{ color: "#8b949e" }}>×</button>
      </div>
    );
  }
  return (
    <select
      value={DETAIL_OPTIONS.includes(value) ? value : ""}
      onChange={(e) => { if (e.target.value === "__custom__") { setCustom(true); onChange(""); } else { onChange(e.target.value); } }}
      style={{ ...inputStyle, width: "110px", cursor: "pointer" }}
      className={INPUT}
    >
      <option value="">—</option>
      {DETAIL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__custom__">Add detail…</option>
    </select>
  );
}

function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={UNITS.includes(value) ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, width: "72px", cursor: "pointer" }}
      className={INPUT}
    >
      <option value="" disabled>Unit</option>
      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

function divisionTotal(div: Division): number {
  if (div.manualTotal !== null && div.manualTotal !== undefined) return div.manualTotal;
  return div.groups.reduce((s, g) => s + groupTotal(g.items), 0) + groupTotal(div.items);
}

function grandTotal(divisions: Division[]): number {
  return divisions.reduce((s, d) => s + divisionTotal(d), 0);
}

function ItemRow({ item, divisionId, groupId, canEdit }: { item: Item; divisionId: string; groupId?: string | null; canEdit: boolean }) {
  const { sqFt, durationMonths, isRoof } = useContext(TDimensionsCtx);
  const { editAllSignal, saveSignal, resetAllSignal } = useContext(DivisionEditCtx);
  const { pushUndo } = useContext(UndoCtx);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { sourceDivisionId: divisionId, sourceGroupId: groupId ?? null, itemName: item.name },
    disabled: !canEdit,
  });
  function roofSqQty(): string {
    return (isRoof && isSfUnitT(item.unit ?? "") && sqFt && sqFt > 0)
      ? String(Math.ceil(sqFt / 100))
      : (item.defaultQty?.toString() ?? "");
  }

  const [form, setForm] = useState({
    name: item.name,
    csiCode: item.csiCode ?? "",
    detail: item.detail ?? "",
    unit: item.unit ?? "",
    defaultQty: roofSqQty(),
    defaultUnitCost: item.defaultUnitCost?.toString() ?? "",
    defaultMarkupPct: item.defaultMarkupPct?.toString() ?? "",
    notes: item.notes ?? "",
    visibleInPdf: item.visibleInPdf,
  });

  // Sync defaultQty when sqFt changes for roof SQ items
  useEffect(() => {
    if (isRoof && isSfUnitT(form.unit) && sqFt && sqFt > 0) {
      const corrected = String(Math.ceil(sqFt / 100));
      setForm(prev => ({ ...prev, defaultQty: corrected }));
    }
  }, [sqFt, isRoof]); // eslint-disable-line react-hooks/exhaustive-deps

  function autoQtyT(name: string, unit: string, currentQty: string): string {
    if (isSfUnitT(unit) && sqFt && sqFt > 0) {
      return String(isRoof ? Math.ceil(sqFt / 100) : sqFt);
    }
    if ((isDurationUnitT(unit) || isDurationNameT(name)) && durationMonths && durationMonths > 0) return String(durationMonths);
    return currentQty;
  }

  function doSave(closeAfter: boolean) {
    const prevData = {
      id: item.id, groupId: groupId ?? null,
      name: item.name, csiCode: item.csiCode || null, detail: item.detail || null,
      unit: item.unit || null, defaultQty: item.defaultQty, defaultUnitCost: item.defaultUnitCost,
      defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
      defaultMarkupPct: item.defaultMarkupPct, notes: item.notes || null, visibleInPdf: item.visibleInPdf,
    };
    startTransition(async () => {
      const effectiveQty = (isRoof && isSfUnitT(form.unit) && sqFt && sqFt > 0)
        ? Math.ceil(sqFt / 100)
        : (form.defaultQty ? Number(form.defaultQty) : null);
      const newData = {
        id: item.id, groupId: groupId ?? null,
        name: form.name, csiCode: form.csiCode || null, detail: form.detail || null,
        unit: form.unit || null, defaultQty: effectiveQty,
        defaultUnitCost: form.defaultUnitCost ? Number(form.defaultUnitCost) : null,
        defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
        defaultMarkupPct: form.defaultMarkupPct ? Number(form.defaultMarkupPct) : null,
        notes: form.notes || null, visibleInPdf: form.visibleInPdf,
      };
      await upsertTemplateItem(divisionId, newData);
      pushUndo({
        label: `Edit "${item.name}"`,
        undo: async () => { await upsertTemplateItem(divisionId, prevData); },
        redo: async () => { await upsertTemplateItem(divisionId, newData); },
      });
      if (closeAfter) setEditing(false);
    });
  }

  function save() { doSave(true); }

  // Auto-save 1.5s after last change, only if something actually changed
  useEffect(() => {
    if (!editing) return;
    const hasChanges =
      form.name !== item.name ||
      form.csiCode !== (item.csiCode ?? "") ||
      form.detail !== (item.detail ?? "") ||
      form.unit !== (item.unit ?? "") ||
      form.defaultQty !== roofSqQty() ||
      form.defaultUnitCost !== (item.defaultUnitCost?.toString() ?? "") ||
      form.defaultMarkupPct !== (item.defaultMarkupPct?.toString() ?? "") ||
      form.notes !== (item.notes ?? "") ||
      form.visibleInPdf !== item.visibleInPdf;
    if (!hasChanges) return;
    const timer = setTimeout(() => doSave(false), 1500);
    return () => clearTimeout(timer);
  }, [form, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter edit mode when division "Edit All" is triggered
  useEffect(() => {
    if (editAllSignal > 0) setEditing(true);
  }, [editAllSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save when division "Save All" is signaled
  useEffect(() => {
    if (saveSignal > 0) doSave(true);
  }, [saveSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when division "Reset All" is signaled
  useEffect(() => {
    if (resetAllSignal > 0) doReset();
  }, [resetAllSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  function doReset() {
    startTransition(async () => {
      await upsertTemplateItem(divisionId, {
        id: item.id,
        groupId: groupId ?? null,
        name: item.name,
        csiCode: item.csiCode,
        detail: null,
        unit: item.unit,
        defaultQty: null,
        defaultUnitCost: null,
        defaultLaborCost: null,
        defaultMaterialCost: null,
        defaultMarkupPct: null,
        notes: item.notes,
        visibleInPdf: item.visibleInPdf,
      });
    });
  }

  const total = itemTotal(item);

  if (!editing) {
    return (
      <tr ref={setNodeRef} className="group text-sm" style={{ borderTop: "1px solid #30373f", opacity: isDragging ? 0.35 : 1, transform: CSS.Transform.toString(transform), transition }}>
        {canEdit && (
          <td className="px-1 py-2 text-center select-none" style={{ color: "#8b949e", width: "28px" }}>
            <div className="flex flex-col items-center gap-1">
              <span style={{ cursor: "grab", fontSize: "14px" }} {...listeners} {...attributes}>⠿</span>
              {/* Mobile-only action buttons below drag handle */}
              <div className="flex flex-row gap-0.5 sm:hidden">
                <button onClick={() => setEditing(true)}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                  title="Edit">
                  <PencilIcon size={12} />
                </button>
                <button onClick={doReset} disabled={isPending}
                  className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50 text-xs font-bold"
                  style={{ background: "#1e40af22", color: "#60a5fa", border: "1px solid #60a5fa33" }}
                  title="Reset">
                  ↺
                </button>
                <button onClick={() => startTransition(async () => {
                  await archiveTemplateItem(item.id);
                  pushUndo({
                    label: `Delete "${item.name}"`,
                    undo: async () => { await restoreTemplateItem(item.id); },
                    redo: async () => { await archiveTemplateItem(item.id); },
                  });
                })} disabled={isPending}
                  className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                  style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                  title="Remove">
                  <TrashIcon size={12} />
                </button>
              </div>
            </div>
          </td>
        )}
        <td className="px-3 py-2 text-xs font-mono" style={{ color: "#8b949e", whiteSpace: "nowrap" }}>{item.csiCode ?? ""}</td>
        <td className="px-3 py-2" style={{ color: "#e6edf3" }}>{item.name}</td>
        <td className="px-3 py-2 text-xs" style={{ color: item.detail === "Allowances" ? "#C9A84C" : item.detail === "Excluded" ? "#ef4444" : "#8b949e" }}>{item.detail ?? "—"}</td>
        <td className="px-3 py-2 text-right" style={{ color: "#8b949e" }}>{roofSqQty() || "—"}</td>
        <td className="px-3 py-2 text-center" style={{ color: "#8b949e" }}>{item.unit ?? "—"}</td>
        <td className="px-3 py-2 text-right" style={{ color: "#8b949e" }}>{item.defaultUnitCost != null ? `$${fmt(item.defaultUnitCost)}` : "—"}</td>
        <td className="px-3 py-2 text-right" style={{ color: "#8b949e" }}>{item.defaultMarkupPct != null ? `${item.defaultMarkupPct}%` : "—"}</td>
        <td className="px-3 py-2 font-semibold text-right" style={{ color: "#C9A84C" }}>{total > 0 ? `$${fmt(total)}` : "—"}</td>
        <td className="px-3 py-2 text-sm italic truncate max-w-[120px]" style={{ color: "#8b949e" }}>{item.notes ?? ""}</td>
        <td className="px-3 py-2 text-right hidden sm:table-cell">
          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <>
                <button onClick={() => setEditing(true)}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                  title="Edit">
                  <PencilIcon size={12} />
                </button>
                <button onClick={doReset} disabled={isPending}
                  className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50 text-xs font-bold"
                  style={{ background: "#1e40af22", color: "#60a5fa", border: "1px solid #60a5fa33" }}
                  title="Reset values">
                  ↺
                </button>
                <button onClick={() => startTransition(async () => {
                  await archiveTemplateItem(item.id);
                  pushUndo({
                    label: `Delete "${item.name}"`,
                    undo: async () => { await restoreTemplateItem(item.id); },
                    redo: async () => { await archiveTemplateItem(item.id); },
                  });
                })} disabled={isPending}
                  className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                  style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                  title="Remove">
                  <TrashIcon size={12} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  const previewTotal = (form.defaultQty ? Number(form.defaultQty) : 0) * (form.defaultUnitCost ? Number(form.defaultUnitCost) : 0) * (1 + (form.defaultMarkupPct ? Number(form.defaultMarkupPct) : 0) / 100);

  return (
    <tr style={{ borderTop: "1px solid #30373f", background: "#1a2d1a" }}>
      {canEdit && <td style={{ width: "24px" }} />}
      <td className="px-2 py-1"><input className={INPUT} style={{ ...inputStyleSm, width: "80px", fontFamily: "monospace" }} value={form.csiCode} onChange={(e) => setForm({ ...form, csiCode: formatCsiCode(e.target.value) })} placeholder="CSI" /></td>
      <td className="px-2 py-1"><textarea className={INPUT} rows={2} style={{ ...inputStyleSm, resize: "none", lineHeight: "1.3" }} value={form.name} onChange={(e) => { const n = e.target.value; const auto = lookupItemCsiCode(n); setForm({ ...form, name: n, csiCode: auto ?? form.csiCode, defaultQty: autoQtyT(n, form.unit, form.defaultQty) }); }} /></td>
      <td className="px-2 py-1"><DetailSelect value={form.detail} onChange={(v) => setForm({ ...form, detail: v })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className={INPUT} style={{ ...inputStyle, width: "56px" }} value={form.defaultQty} onChange={(e) => setForm({ ...form, defaultQty: e.target.value })} /></td>
      <td className="px-2 py-1"><UnitSelect value={form.unit} onChange={(v) => setForm({ ...form, unit: v, defaultQty: autoQtyT(form.name, v, form.defaultQty) })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className={INPUT} style={{ ...inputStyle, width: "80px" }} value={form.defaultUnitCost} onChange={(e) => setForm({ ...form, defaultUnitCost: e.target.value })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className={INPUT} style={{ ...inputStyle, width: "56px" }} value={form.defaultMarkupPct} onChange={(e) => setForm({ ...form, defaultMarkupPct: e.target.value })} /></td>
      <td className="px-2 py-1 text-xs font-semibold text-right" style={{ color: "#C9A84C" }}>{previewTotal > 0 ? `$${fmt(previewTotal)}` : "—"}</td>
      <td className="px-2 py-1"><input className={INPUT} style={inputStyleSm} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="notes" /></td>
      <td className="px-2 py-1">
        <div className="flex gap-1 justify-end items-center">
          {isPending && <span className="text-xs" style={{ color: "#8b949e" }}>Saving…</span>}
          <button onClick={doReset} disabled={isPending}
            className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50 text-xs font-bold"
            style={{ background: "#1e40af22", color: "#60a5fa", border: "1px solid #60a5fa33" }}
            title="Reset values">↺</button>
          <button onClick={save} disabled={isPending} className="text-xs px-2 py-1 rounded font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>Save</button>
          <button onClick={() => setEditing(false)} className="text-xs px-2" style={{ color: "#8b949e" }}>✕</button>
        </div>
      </td>
    </tr>
  );
}

function AddTemplateItemRow({ divisionId, groupId, canEdit }: { divisionId: string; groupId?: string | null; canEdit: boolean }) {
  const { sqFt, durationMonths, isRoof } = useContext(TDimensionsCtx);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", csiCode: "", detail: "", unit: "", defaultQty: "", defaultUnitCost: "", defaultMarkupPct: "", notes: "", visibleInPdf: true });

  function autoQtyT(name: string, unit: string, currentQty: string): string {
    if (isSfUnitT(unit) && sqFt && sqFt > 0) {
      return String(isRoof ? Math.ceil(sqFt / 100) : sqFt);
    }
    if ((isDurationUnitT(unit) || isDurationNameT(name)) && durationMonths && durationMonths > 0) return String(durationMonths);
    return currentQty;
  }

  if (!canEdit) return null;

  function save() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      const effectiveQty = (isRoof && isSfUnitT(form.unit) && sqFt && sqFt > 0)
        ? Math.ceil(sqFt / 100)
        : (form.defaultQty ? Number(form.defaultQty) : null);
      await upsertTemplateItem(divisionId, {
        groupId: groupId ?? null,
        name: form.name,
        csiCode: form.csiCode || null,
        detail: form.detail || null,
        unit: form.unit || null,
        defaultQty: effectiveQty,
        defaultUnitCost: form.defaultUnitCost ? Number(form.defaultUnitCost) : null,
        defaultMarkupPct: form.defaultMarkupPct ? Number(form.defaultMarkupPct) : null,
        notes: form.notes || null,
        visibleInPdf: form.visibleInPdf,
      });
      setForm({ name: "", csiCode: "", detail: "", unit: "", defaultQty: "", defaultUnitCost: "", defaultMarkupPct: "", notes: "", visibleInPdf: true });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={canEdit ? 11 : 10} className="px-3 py-1">
          <button onClick={() => setOpen(true)} className="text-xs" style={{ color: "#C9A84C" }}>+ Add Item</button>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: "1px solid #30373f", background: "#0d2a1a" }}>
      {canEdit && <td style={{ width: "24px" }} />}
      <td className="px-2 py-1"><input className={INPUT} style={{ ...inputStyleSm, width: "80px", fontFamily: "monospace" }} value={form.csiCode} onChange={(e) => setForm({ ...form, csiCode: formatCsiCode(e.target.value) })} placeholder="CSI" /></td>
      <td className="px-2 py-1"><textarea autoFocus className={INPUT} rows={2} style={{ ...inputStyleSm, resize: "none", lineHeight: "1.3" }} value={form.name} onChange={(e) => { const n = e.target.value; const auto = lookupItemCsiCode(n); setForm({ ...form, name: n, csiCode: auto ?? form.csiCode, defaultQty: autoQtyT(n, form.unit, form.defaultQty) }); }} placeholder="Item name" /></td>
      <td className="px-2 py-1"><DetailSelect value={form.detail} onChange={(v) => setForm({ ...form, detail: v })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className={INPUT} style={{ ...inputStyle, width: "56px" }} value={form.defaultQty} onChange={(e) => setForm({ ...form, defaultQty: e.target.value })} /></td>
      <td className="px-2 py-1"><UnitSelect value={form.unit} onChange={(v) => setForm({ ...form, unit: v, defaultQty: autoQtyT(form.name, v, form.defaultQty) })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className={INPUT} style={{ ...inputStyle, width: "80px" }} value={form.defaultUnitCost} onChange={(e) => setForm({ ...form, defaultUnitCost: e.target.value })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className={INPUT} style={{ ...inputStyle, width: "56px" }} value={form.defaultMarkupPct} onChange={(e) => setForm({ ...form, defaultMarkupPct: e.target.value })} /></td>
      <td />
      <td className="px-2 py-1"><input className={INPUT} style={inputStyleSm} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="notes" /></td>
      <td className="px-2 py-1">
        <div className="flex gap-1 justify-end">
          <button onClick={save} disabled={isPending} className="text-xs px-2 py-1 rounded font-medium" style={{ background: "#22c55e", color: "#fff" }}>Add</button>
          <button onClick={() => setOpen(false)} className="text-xs px-2" style={{ color: "#8b949e" }}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function TemplateItemTable({ divisionId, groupId, items, canEdit }: { divisionId: string; groupId?: string | null; items: Item[]; canEdit: boolean }) {
  const itemIds = items.map(i => i.id);

  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
    <div className="overflow-x-auto">
      <table className="text-sm" style={{ minWidth: "960px" }}>
        <thead>
          <tr style={{ background: "#161b22" }}>
            {canEdit && <th style={{ width: "24px" }} />}
            <th className="px-3 py-1.5 text-left font-medium text-xs w-20" style={{ color: "#8b949e" }}>CSI</th>
            <th className="px-3 py-1.5 text-left font-medium text-xs" style={{ color: "#8b949e", minWidth: "260px" }}>Item</th>
            <th className="px-3 py-1.5 text-left font-medium text-xs w-28" style={{ color: "#8b949e" }}>Detail</th>
            <th className="px-3 py-1.5 text-right font-medium text-xs w-16" style={{ color: "#8b949e" }}>Qty</th>
            <th className="px-3 py-1.5 text-center font-medium text-xs w-16" style={{ color: "#8b949e" }}>Unit</th>
            <th className="px-3 py-1.5 text-right font-medium text-xs w-24" style={{ color: "#8b949e" }}>Cost</th>
            <th className="px-3 py-1.5 text-right font-medium text-xs w-16" style={{ color: "#8b949e" }}>Markup</th>
            <th className="px-3 py-1.5 text-right font-medium text-xs w-28" style={{ color: "#C9A84C" }}>TOTAL</th>
            <th className="px-3 py-1.5 text-left font-medium text-xs" style={{ color: "#8b949e" }}>Notes</th>
            <th className="w-20 hidden sm:table-cell" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} divisionId={divisionId} groupId={groupId} canEdit={canEdit} />
          ))}
          <AddTemplateItemRow divisionId={divisionId} groupId={groupId} canEdit={canEdit} />
        </tbody>
      </table>
    </div>
    </SortableContext>
  );
}

function TemplateGroupSection({ group, divisionId, canEdit }: { group: Group; divisionId: string; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { pushUndo } = useContext(UndoCtx);
  const total = groupTotal(group.items);
  const { setNodeRef: setGroupDropRef, isOver: isGroupOver } = useDroppable({ id: `group:${group.id}:${divisionId}` });
  return (
    <div ref={setGroupDropRef} className="mt-3" style={{ outline: isGroupOver ? "2px solid #C9A84C" : "none", borderRadius: 6 }}>
      <div className="flex items-center justify-between px-3 py-1.5 rounded" style={{ background: isGroupOver ? "#2a2010" : "#0d1117" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8b949e" }}>{group.name}</span>
        <div className="flex items-center gap-3">
          {total > 0 && <span className="text-xs font-semibold" style={{ color: "#C9A84C" }}>${fmt(total)}</span>}
          {canEdit && (
            <button onClick={() => { startTransition(async () => {
              await archiveTemplateGroup(group.id);
              pushUndo({
                label: `Delete group "${group.name}"`,
                undo: async () => { await restoreTemplateGroup(group.id); },
                redo: async () => { await archiveTemplateGroup(group.id); },
              });
            }); }} disabled={isPending}
              className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
              style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
              title="Remove group">
              <TrashIcon size={12} />
            </button>
          )}
        </div>
      </div>
      <TemplateItemTable divisionId={divisionId} groupId={group.id} items={group.items} canEdit={canEdit} />
    </div>
  );
}

function TemplateDivisionSection({ division, otherDivisions, canEdit, globalSaveSignal }: { division: Division; otherDivisions: Division[]; canEdit: boolean; globalSaveSignal?: number }) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [isPending, startTransition] = useTransition();
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [editingHeader, setEditingHeader] = useState(false);
  const [editCsi, setEditCsi] = useState(division.csiCode ?? "");
  const [editName, setEditName] = useState(division.name);
  const [lumpSumInput, setLumpSumInput] = useState(division.manualTotal != null ? String(division.manualTotal) : "");
  const [lumpSumOpen, setLumpSumOpen] = useState(division.manualTotal != null);
  const [movingTo, setMovingTo] = useState(false);
  const [editAllSignal, setEditAllSignal] = useState(0);
  const [saveSignal, setSaveSignal] = useState(0);
  const [resetAllSignal, setResetAllSignal] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const isSwiping = useRef(false);
  const SWIPE_THRESHOLD = 80;

  function handleTouchStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }
  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    if (!isSwiping.current && dy > Math.abs(dx)) return;
    if (!isSwiping.current && Math.abs(dx) > 8) isSwiping.current = true;
    if (isSwiping.current && dx < 0) setSwipeX(Math.max(dx, -SWIPE_THRESHOLD - 20));
  }
  function handleTouchEnd() {
    if (swipeX <= -SWIPE_THRESHOLD && canEdit) {
      startTransition(async () => {
        await archiveTemplateDivision(division.id);
        pushUndo({
          label: `Delete division "${division.name}"`,
          undo: async () => { await restoreTemplateDivision(division.id); },
          redo: async () => { await archiveTemplateDivision(division.id); },
        });
      });
    } else {
      setSwipeX(0);
    }
    isSwiping.current = false;
  }
  // Propagate global save from parent
  useEffect(() => { if (globalSaveSignal && globalSaveSignal > 0) setSaveSignal(s => s + 1); }, [globalSaveSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pushUndo } = useContext(UndoCtx);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: division.id });
  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: "div-" + division.id,
    data: { type: "division", divisionId: division.id },
    disabled: !canEdit,
  });

  const total = divisionTotal(division);

  function saveGroup() {
    if (!groupName.trim()) return;
    startTransition(async () => {
      await upsertTemplateGroup(division.id, { name: groupName });
      setGroupName("");
      setAddingGroup(false);
    });
  }

  function saveHeader() {
    if (!editName.trim()) return;
    startTransition(async () => {
      await upsertTemplateDivision(division.id, { id: division.id, csiCode: editCsi.trim() || undefined, name: editName.trim() });
      setEditingHeader(false);
    });
  }

  function saveLumpSum(value: string) {
    const parsed = value.trim() === "" ? null : parseFloat(value.replace(/,/g, ""));
    if (value.trim() !== "" && isNaN(parsed!)) return;
    startTransition(async () => {
      await upsertTemplateDivision(division.id, { id: division.id, name: division.name, manualTotal: parsed });
    });
  }

  return (
    <div ref={(node) => { setDropRef(node); setDragRef(node); }} className="rounded-xl overflow-x-auto" style={{ background: "#1e2736", border: isOver ? "2px solid #C9A84C" : "1px solid #30373f", transition: "border 0.1s", opacity: isDragging ? 0.4 : 1 }}>
      {/* Mobile header — tap to expand/collapse, swipe left to delete */}
      <div className="md:hidden relative overflow-hidden" style={{ borderRadius: "inherit" }}>
        {/* Red delete zone revealed by swipe */}
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center gap-1"
          style={{ background: "#ef4444", width: 80, opacity: Math.min(1, Math.abs(swipeX) / 50) }}
        >
          <TrashIcon size={18} />
        </div>
        {/* Swipeable header */}
        <div
          className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          style={{ background: "#1e2736", transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? "transform 0.25s ease" : "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => { if (!editingHeader && Math.abs(swipeX) < 5) setOpen(!open); }}
        >
          <span className="text-base shrink-0" style={{ color: "#C9A84C" }}>{open ? "▼" : "▶"}</span>
          <div className="flex flex-col flex-1 min-w-0">
            {division.csiCode && <span className="text-[10px] font-semibold" style={{ color: "#8b949e" }}>{division.csiCode}</span>}
            <span className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{division.name}</span>
          </div>
          {/* Mobile lump-sum toggle */}
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); setLumpSumOpen(v => !v); }}
              className="text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{ background: lumpSumOpen ? "#C9A84C22" : "transparent", border: `1px solid ${lumpSumOpen ? "#C9A84C88" : "#30373f"}`, color: lumpSumOpen ? "#C9A84C" : "#484f58" }}
              title="Set lump-sum total for this division"
            >∑</button>
          )}
          {total > 0 && <span className="text-sm font-bold shrink-0" style={{ color: division.manualTotal != null ? "#C9A84C" : "#C9A84C" }}>{division.manualTotal != null ? "≈ " : ""}${fmt(total)}</span>}
        </div>
        {/* Mobile lump-sum input row */}
        {lumpSumOpen && canEdit && (
          <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#161b22", borderTop: "1px solid #30373f" }} onClick={e => e.stopPropagation()}>
            <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>Lump sum override:</span>
            <input
              type="number"
              className="rounded px-2 py-1 text-sm flex-1"
              style={{ background: "#0d1117", border: "1px solid #C9A84C66", color: "#e6edf3", minWidth: 0 }}
              placeholder="e.g. 45000"
              value={lumpSumInput}
              onChange={e => setLumpSumInput(e.target.value)}
              onBlur={e => saveLumpSum(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { saveLumpSum(lumpSumInput); (e.target as HTMLInputElement).blur(); } }}
            />
            {lumpSumInput && (
              <button onClick={() => { setLumpSumInput(""); saveLumpSum(""); setLumpSumOpen(false); }} className="text-xs shrink-0" style={{ color: "#ef4444" }}>✕ Clear</button>
            )}
          </div>
        )}
      </div>

      {/* Desktop header */}
      <div className="w-full hidden md:flex items-center gap-3 px-4 py-3" style={{ background: "#1e2736" }}>
        {canEdit && (
          <span className="text-xs select-none shrink-0 cursor-grab" style={{ color: "#8b949e", fontSize: "14px" }} {...dragListeners} {...dragAttrs}>⠿</span>
        )}
        <button onClick={() => setOpen(!open)} className="text-xs shrink-0" style={{ color: "#8b949e" }}>{open ? "▼" : "▶"}</button>

        {editingHeader ? (
          <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              value={editCsi}
              onChange={(e) => setEditCsi(formatCsiCode(e.target.value))}
              placeholder="Code"
              className={INPUT}
              style={{ ...inputStyle, width: 52 }}
            />
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveHeader(); if (e.key === "Escape") setEditingHeader(false); }}
              placeholder="Division name"
              className={INPUT}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={saveHeader} disabled={isPending} className="text-xs px-2 py-1 rounded font-medium shrink-0" style={{ background: "#C9A84C", color: "#0d1117" }}>Save</button>
            <button onClick={() => setEditingHeader(false)} className="text-xs shrink-0" style={{ color: "#8b949e" }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 text-left">
            {division.csiCode && <span className="font-semibold" style={{ color: "#e6edf3" }}>{division.csiCode}</span>}
            <span className="font-semibold" style={{ color: "#e6edf3" }}>{division.name}</span>
            {canEdit && (
              <span
                onClick={(e) => { e.stopPropagation(); setEditCsi(division.csiCode ?? ""); setEditName(division.name); setEditingHeader(true); }}
                className="text-xs ml-1 opacity-0 group-hover:opacity-100 cursor-pointer"
                style={{ color: "#8b949e" }}
              >✎</span>
            )}
          </button>
        )}

        {canEdit && !editingHeader && (
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(true); setEditAllSignal(s => s + 1); }}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "#8b949e", border: "1px solid #30373f" }}
              title="Edit all items"
            >Edit All</button>
            <button
              onClick={(e) => { e.stopPropagation(); setSaveSignal(s => s + 1); }}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "#C9A84C", border: "1px solid #C9A84C44" }}
              title="Save all items"
            >Save All</button>
            <button
              onClick={(e) => { e.stopPropagation(); setResetAllSignal(s => s + 1); }}
              className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ color: "#60a5fa", border: "1px solid #60a5fa33" }}
              title="Reset all items"
            >Reset All</button>
            {/* Lump-sum override button */}
            <button
              onClick={(e) => { e.stopPropagation(); setLumpSumOpen(v => !v); }}
              className="text-xs px-2 py-0.5 rounded font-bold"
              style={{ color: lumpSumOpen ? "#C9A84C" : "#484f58", border: `1px solid ${lumpSumOpen ? "#C9A84C66" : "#30373f"}`, background: lumpSumOpen ? "#C9A84C11" : "transparent" }}
              title="Set lump-sum total for this division"
            >∑ Lump Sum</button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditCsi(division.csiCode ?? ""); setEditName(division.name); setEditingHeader(true); }}
              className="text-xs"
              style={{ color: "#8b949e" }}
              title="Edit division"
            >✎</button>
          </div>
        )}
        {total > 0 && !editingHeader && (
          <span className="text-sm font-bold shrink-0" style={{ color: "#C9A84C" }}>
            {division.manualTotal != null && <span className="text-[10px] font-normal mr-1" style={{ color: "#8b949e" }}>override</span>}
            ${fmt(total)}
          </span>
        )}
      </div>
      {/* Desktop lump-sum input row */}
      {lumpSumOpen && canEdit && (
        <div className="hidden md:flex items-center gap-3 px-4 py-2" style={{ background: "#0d1117", borderTop: "1px solid #C9A84C33" }}>
          <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>Lump-sum override (replaces all line items in this division):</span>
          <input
            type="number"
            className="rounded px-2 py-1 text-sm"
            style={{ background: "#161b22", border: "1px solid #C9A84C66", color: "#e6edf3", width: 140 }}
            placeholder="e.g. 45000"
            value={lumpSumInput}
            onChange={e => setLumpSumInput(e.target.value)}
            onBlur={e => saveLumpSum(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { saveLumpSum(lumpSumInput); (e.target as HTMLInputElement).blur(); } }}
          />
          {lumpSumInput && (
            <button onClick={() => { setLumpSumInput(""); saveLumpSum(""); setLumpSumOpen(false); }} className="text-xs px-2 py-1 rounded" style={{ color: "#ef4444", border: "1px solid #ef444433" }}>✕ Clear override</button>
          )}
          <span className="text-[11px]" style={{ color: "#484f58" }}>Leave blank to use line item sum</span>
        </div>
      )}

      {open && (
        <DivisionEditCtx.Provider value={{ editAllSignal, saveSignal, resetAllSignal }}>
        <div style={{ borderTop: "1px solid #30373f" }} className="pb-2">
          {division.groups.map((grp) => (
            <TemplateGroupSection key={grp.id} group={grp} divisionId={division.id} canEdit={canEdit} />
          ))}
          {division.items.length > 0 && (
            <TemplateItemTable divisionId={division.id} groupId={null} items={division.items} canEdit={canEdit} />
          )}
          {canEdit && (
            <div className="px-3 pt-2">
              {addingGroup ? (
                <div className="flex gap-2 items-center">
                  <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className={INPUT} style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={saveGroup} disabled={isPending} className="text-xs px-2 py-1 rounded font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>Add</button>
                  <button onClick={() => setAddingGroup(false)} className="text-xs" style={{ color: "#8b949e" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingGroup(true)} className="text-xs" style={{ color: "#8b949e" }}>+ Add Group</button>
              )}
            </div>
          )}
          {canEdit && otherDivisions.length > 0 && (
            <div className="px-3 pt-1">
              {movingTo ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "#8b949e" }}>Move to:</span>
                  <select
                    autoFocus
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      startTransition(async () => {
                        await mergeTemplateDivisionInto(division.id, e.target.value);
                        setMovingTo(false);
                      });
                    }}
                    style={{ ...inputStyle, fontSize: 12 }}
                    className={INPUT}
                  >
                    <option value="" disabled>Select division…</option>
                    {otherDivisions.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.csiCode ? `${d.csiCode} — ` : ""}{d.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setMovingTo(false)} className="text-xs" style={{ color: "#8b949e" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setMovingTo(true)} className="text-xs" style={{ color: "#8b949e" }}>
                  Move to Division…
                </button>
              )}
            </div>
          )}
          {canEdit && (
            <div className="px-3 pt-1">
              <button onClick={() => { startTransition(async () => {
                await archiveTemplateDivision(division.id);
                pushUndo({
                  label: `Delete division "${division.name}"`,
                  undo: async () => { await restoreTemplateDivision(division.id); },
                  redo: async () => { await archiveTemplateDivision(division.id); },
                });
              }); }} disabled={isPending}
                className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                title="Remove division">
                <TrashIcon size={12} />
              </button>
            </div>
          )}
        </div>
        </DivisionEditCtx.Provider>
      )}
    </div>
  );
}

const DEFAULT_PAYMENT_SCHEDULE: PaymentRow[] = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

function SortablePaymentRow({
  id,
  row,
  idx,
  canEdit,
  updateRow,
  removeRow,
}: {
  id: string;
  row: PaymentRow;
  idx: number;
  canEdit: boolean;
  updateRow: (idx: number, field: keyof PaymentRow, value: string | number) => void;
  removeRow: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderBottom: "1px solid #30373f22",
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {canEdit && (
        <td className="py-1 pr-1 w-4 cursor-grab" style={{ color: "#4a5568", touchAction: "none" }} {...attributes} {...listeners}>
          ⠿
        </td>
      )}
      <td className="py-1 pr-1">
        {canEdit ? (
          <input
            value={row.payment}
            onChange={e => updateRow(idx, "payment", e.target.value)}
            className="w-full rounded px-1 py-0.5 text-xs"
            style={{ background: "#1e2736", border: "1px solid #30373f44", color: "#e6edf3" }}
          />
        ) : (
          <span style={{ color: "#e6edf3" }}>{row.payment}</span>
        )}
      </td>
      <td className="py-1 px-1">
        {canEdit ? (
          <input
            value={row.trigger}
            onChange={e => updateRow(idx, "trigger", e.target.value)}
            className="w-full rounded px-1 py-0.5 text-xs"
            style={{ background: "#1e2736", border: "1px solid #30373f44", color: "#8b949e" }}
          />
        ) : (
          <span style={{ color: "#8b949e" }}>{row.trigger}</span>
        )}
      </td>
      <td className="py-1 pl-1 text-right">
        {canEdit ? (
          <input
            type="number"
            min={0}
            max={100}
            value={row.pct}
            onChange={e => updateRow(idx, "pct", e.target.value)}
            className="rounded px-1 py-0.5 text-xs text-right"
            style={{ background: "#1e2736", border: "1px solid #30373f44", color: "#C9A84C", width: "44px" }}
          />
        ) : (
          <span style={{ color: "#C9A84C" }}>{row.pct}%</span>
        )}
      </td>
      {canEdit && (
        <td className="py-1 pl-1">
          <button onClick={() => removeRow(idx)} className="text-xs" style={{ color: "#ef4444" }}>✕</button>
        </td>
      )}
    </tr>
  );
}

function PaymentScheduleCard({
  templateId,
  initialRows,
  canEdit,
}: {
  templateId: string;
  initialRows: PaymentRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<PaymentRow[]>(initialRows);
  const [isPending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const rowIds = rows.map((_, i) => `row-${i}`);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  function updateRow(idx: number, field: keyof PaymentRow, value: string | number) {
    const updated = rows.map((r, i) => i === idx ? { ...r, [field]: field === "pct" ? Number(value) : value } : r);
    setRows(updated);
    setDirty(true);
  }

  function addRow() {
    setRows([...rows, { payment: "", trigger: "", pct: 0 }]);
    setDirty(true);
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = rowIds.indexOf(active.id as string);
    const newIdx = rowIds.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    setRows(arrayMove(rows, oldIdx, newIdx));
    setDirty(true);
  }

  function save() {
    startTransition(async () => {
      await updateTemplatePaymentSchedule(templateId, rows);
      setDirty(false);
    });
  }

  const totalPct = rows.reduce((s, r) => s + (r.pct || 0), 0);

  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ background: "#0d1117", border: "1px solid #C9A84C44", minWidth: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b949e" }}>Payment Schedule</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: totalPct === 100 ? "#22c55e" : "#ef4444" }}>{totalPct}%</span>
          {canEdit && dirty && (
            <button onClick={save} disabled={isPending} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>
              {isPending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #30373f" }}>
                {canEdit && <th className="w-4" />}
                <th className="text-left pb-1 font-medium" style={{ color: "#8b949e" }}>Payment</th>
                <th className="text-left pb-1 font-medium pl-2" style={{ color: "#8b949e" }}>Trigger</th>
                <th className="text-right pb-1 font-medium pl-2 w-12" style={{ color: "#8b949e" }}>%</th>
                {canEdit && <th className="w-6" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <SortablePaymentRow
                  key={rowIds[idx]}
                  id={rowIds[idx]}
                  row={row}
                  idx={idx}
                  canEdit={canEdit}
                  updateRow={updateRow}
                  removeRow={removeRow}
                />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
      {canEdit && (
        <button onClick={addRow} className="mt-2 text-xs self-start" style={{ color: "#C9A84C" }}>+ Add Row</button>
      )}
    </div>
  );
}

type ClientData = { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; email: string | null; phone: string | null };

function ClientSelector({
  templateId,
  currentClient,
  allClients,
  canEdit,
}: {
  templateId: string;
  currentClient: ClientData | null;
  allClients: ClientData[];
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<"view" | "select" | "new">("view");
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(currentClient?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [displayClient, setDisplayClient] = useState<ClientData | null>(currentClient);

  function handleAssignExisting() {
    if (!selectedId) return;
    startTransition(async () => {
      await setTemplateClient(templateId, selectedId);
      const found = allClients.find(c => c.id === selectedId) ?? null;
      setDisplayClient(found);
      setMode("view");
    });
  }

  function handleCreateNew() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const client = await upsertClient({ name: newName, address: newAddress, city: newCity, state: newState, zip: newZip, email: newEmail });
      await setTemplateClient(templateId, client.id);
      setDisplayClient({ id: client.id, name: client.name, address: client.address, city: client.city, state: client.state, zip: client.zip, email: client.email, phone: client.phone });
      setNewName(""); setNewAddress(""); setNewCity(""); setNewState(""); setNewZip(""); setNewEmail("");
      setMode("view");
    });
  }

  function handleClear() {
    startTransition(async () => {
      await setTemplateClient(templateId, null);
      setDisplayClient(null);
      setMode("view");
    });
  }

  const cityLine = displayClient ? [displayClient.city, displayClient.state, displayClient.zip].filter(Boolean).join(", ") : "";

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid #30373f" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Client</p>
          {displayClient ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{displayClient.name}</p>
              {displayClient.address && <p className="text-xs" style={{ color: "#8b949e" }}>{displayClient.address}</p>}
              {cityLine && <p className="text-xs" style={{ color: "#8b949e" }}>{cityLine}</p>}
              {displayClient.email && <p className="text-xs" style={{ color: "#8b949e" }}>{displayClient.email}</p>}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "#8b949e" }}>No client assigned</p>
          )}
        </div>
        {canEdit && mode === "view" && (
          <div className="flex gap-2">
            <button onClick={() => setMode("select")} className="text-xs px-2 py-1 rounded" style={{ border: "1px solid #30373f", color: "#C9A84C" }}>
              {displayClient ? "Change" : "Assign Client"}
            </button>
            {displayClient && (
              <button onClick={handleClear} disabled={isPending}
                className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-50"
                style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                title="Remove client">
                <TrashIcon size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {canEdit && mode === "select" && (
        <div className="mt-3 flex gap-2 items-end flex-wrap">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Select existing client</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded px-2 py-1.5 text-sm"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
            >
              <option value="">— choose —</option>
              {allClients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.address ? ` — ${c.address}` : ""}</option>
              ))}
            </select>
          </div>
          <button onClick={handleAssignExisting} disabled={isPending || !selectedId} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>Assign</button>
          <button onClick={() => setMode("new")} className="text-xs px-3 py-1.5 rounded" style={{ border: "1px solid #30373f", color: "#e6edf3" }}>+ New Client</button>
          <button onClick={() => setMode("view")} className="text-xs px-2" style={{ color: "#8b949e" }}>Cancel</button>
        </div>
      )}

      {canEdit && mode === "new" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Name *</label>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Client name" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyleSm} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Address</label>
            <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="123 Main St" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyleSm} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>City</label>
            <input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Hollywood" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyleSm} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>State</label>
              <input value={newState} onChange={e => setNewState(e.target.value)} placeholder="FL" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyleSm} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Zip</label>
              <input value={newZip} onChange={e => setNewZip(e.target.value)} placeholder="33020" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyleSm} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="client@email.com" className="w-full rounded px-2 py-1.5 text-sm" style={inputStyleSm} />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleCreateNew} disabled={isPending || !newName.trim()} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: "#22c55e", color: "#fff" }}>Create & Assign</button>
            <button onClick={() => setMode("select")} className="text-xs px-2" style={{ color: "#8b949e" }}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplateEditor({
  template,
  divisions,
  canEdit,
  currentClient,
  allClients,
  termsTemplates: initialTermsTemplates,
  initialSummaryGroups,
  hasInsertFile = false,
  clientCoverPhotoType = null,
  clientCoverPhotoUrl = null,
  isCommercial = false,
}: {
  template: Template;
  divisions: Division[];
  canEdit: boolean;
  currentClient: { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; email: string | null; phone: string | null } | null;
  allClients: { id: string; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; email: string | null; phone: string | null }[];
  termsTemplates: { id: string; name: string; content: string }[];
  initialSummaryGroups?: Record<string, SummaryGroupData> | null;
  hasInsertFile?: boolean;
  clientCoverPhotoType?: string | null;
  clientCoverPhotoUrl?: string | null;
  isCommercial?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState(template.name);
  const [showTerms, setShowTerms] = useState(template.showTerms);
  const [termsContent, setTermsContent] = useState(template.termsContent ?? "");
  const [termsDirty, setTermsDirty] = useState(false);
  const termsTemplates = initialTermsTemplates;
  const [selectedTermsTplId, setSelectedTermsTplId] = useState<string>(() => {
    // Pre-select whichever saved T&C matches the current content
    return initialTermsTemplates.find(t => t.content === (template.termsContent ?? ""))?.id ?? "";
  });
  const termsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTermsContent = useCallback((content: string) => {
    if (termsDebounceRef.current) clearTimeout(termsDebounceRef.current);
    termsDebounceRef.current = setTimeout(() => {
      startTransition(async () => { await updateTemplateTermsContent(template.id, content); });
    }, 800);
  }, [template.id]);
  const paymentRows = template.paymentSchedule ?? DEFAULT_PAYMENT_SCHEDULE;
  const [description] = useState(template.description ?? "");
  const [estimateNumber, setEstimateNumber] = useState(template.estimateNumber ?? "");
  const [estimateDate, setEstimateDate] = useState(
    template.estimateDate ?? new Date().toISOString().split("T")[0]
  );
  const [addingDiv, setAddingDiv] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [divName, setDivName] = useState("");
  const [divCsi, setDivCsi] = useState("");
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [newName, setNewName] = useState(`${template.name} (copy)`);
  const [saveError, setSaveError] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [saveClientError, setSaveClientError] = useState("");
  const [savedToClient, setSavedToClient] = useState(false);
  const [globalSaveSignal, setGlobalSaveSignal] = useState(0);
  const [templateSaved, setTemplateSaved] = useState(false);

  const subtotal = grandTotal(divisions);
  const [gcFeePercent, setGcFeePercent] = useState<number | "">(template.gcFeePercent ?? "");
  const gcFeeAmount = typeof gcFeePercent === "number" && gcFeePercent > 0 ? subtotal * gcFeePercent / 100 : 0;
  const total = subtotal + gcFeeAmount;

  // Internal profit: auto-computed from item markups, with optional lump-sum override
  const autoMarkupTotal = divisions.reduce((sum, div) => {
    const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
    return sum + allItems.reduce((s, i) => {
      const qty = i.defaultQty ?? 0;
      const cost = i.defaultUnitCost ?? 0;
      const markup = i.defaultMarkupPct ?? 0;
      return s + qty * cost * (markup / 100);
    }, 0);
  }, 0);
  const [internalProfitOverride, setInternalProfitOverride] = useState<number | "">(template.internalProfitOverride ?? "");
  const internalProfit = typeof internalProfitOverride === "number" ? internalProfitOverride : autoMarkupTotal;
  const [sqFt, setSqFt] = useState<number | "">(template.sqFt ?? "");
  const [durationMonths, setDurationMonths] = useState<number | "">(template.durationMonths ?? "");
  useEffect(() => { setSqFt(template.sqFt ?? ""); }, [template.sqFt]);
  useEffect(() => { setDurationMonths(template.durationMonths ?? ""); }, [template.durationMonths]);
  const isRoofTemplate = template.name.toLowerCase().includes("roof");
  const [hasSkylights, setHasSkylights] = useState<boolean>(template.hasSkylights ?? true);
  const [hasRoofDrains, setHasRoofDrains] = useState<boolean>(template.hasRoofDrains ?? true);
  const [insulationType, setInsulationType] = useState<string>(template.insulationType ?? "ISO");
  const [combinationType, setCombinationType] = useState<string | null>(template.combinationType ?? null);
  const [summaryGroups, setSummaryGroups] = useState<Record<string, SummaryGroupData>>(initialSummaryGroups ?? {});
  const [editingSummaryGroup, setEditingSummaryGroup] = useState<string | null>(null);
  const [sgForm, setSgForm] = useState<SummaryGroupData>({ qty: null, unit: null, unitCost: null, markupPct: null, manualTotal: null });
  const [activeDragItem, setActiveDragItem] = useState<{ id: string; name: string; type: "item" | "division" } | null>(null);
  const [undoState, undoDispatch] = useReducer(undoReducer, { past: [], future: [] });
  const [undoPending, startUndoTransition] = useTransition();

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoDispatch({ type: "push", entry });
  }, []);

  function doUndo() {
    const entry = undoState.past[undoState.past.length - 1];
    if (!entry) return;
    undoDispatch({ type: "undo" });
    startUndoTransition(async () => { await entry.undo(); });
  }

  function doRedo() {
    const entry = undoState.future[0];
    if (!entry) return;
    undoDispatch({ type: "redo" });
    startUndoTransition(async () => { await entry.redo(); });
  }

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z or Ctrl+Y = redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); doRedo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "division") {
      const divId = event.active.data.current.divisionId as string;
      const div = divisions.find(d => d.id === divId);
      setActiveDragItem({ id: divId, name: div?.name ?? "", type: "division" });
    } else {
      const name = event.active.data.current?.itemName as string ?? "";
      setActiveDragItem({ id: event.active.id as string, name, type: "item" });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.type === "division") {
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
        await reorderTemplateDivisions(template.id, newOrder);
      });
    } else {
      const sourceDivisionId = active.data.current?.sourceDivisionId as string;
      const sourceGroupId = active.data.current?.sourceGroupId as string | null;
      const overId = over.id as string;
      if (!sourceDivisionId) return;

      // Dropped onto a group (id format: "group:{groupId}:{divisionId}")
      if (overId.startsWith("group:")) {
        const [, targetGroupId, targetDivisionId] = overId.split(":");
        if (sourceGroupId === targetGroupId) return;
        startTransition(async () => {
          await moveItemToGroup(active.id as string, targetGroupId, targetDivisionId);
        });
        return;
      }

      // Dropped onto another item — reorder within same group/division
      const allItems = divisions.flatMap(d => [
        ...d.items.map(i => ({ ...i, divId: d.id, grpId: null as string | null })),
        ...d.groups.flatMap(g => g.items.map(i => ({ ...i, divId: d.id, grpId: g.id }))),
      ]);
      const overItem = allItems.find(i => i.id === overId);
      if (overItem) {
        const isSameGroup = overItem.grpId === sourceGroupId && overItem.divId === sourceDivisionId;
        if (isSameGroup) {
          // Reorder within same group/division
          const siblings = allItems.filter(i => i.divId === sourceDivisionId && i.grpId === sourceGroupId);
          const oldIdx = siblings.findIndex(i => i.id === active.id);
          const newIdx = siblings.findIndex(i => i.id === overId);
          if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
          const newOrder = arrayMove(siblings.map(i => i.id), oldIdx, newIdx);
          startTransition(async () => {
            await reorderTemplateItems(sourceGroupId ?? sourceDivisionId, sourceGroupId ? "group" : "division", newOrder);
          });
        } else {
          // Move to different group/division based on where the over-item lives
          if (overItem.grpId) {
            startTransition(async () => {
              await moveItemToGroup(active.id as string, overItem.grpId!, overItem.divId);
            });
          } else {
            startTransition(async () => {
              await moveItemBetweenDivisions(active.id as string, overItem.divId);
            });
          }
        }
        return;
      }

      // Dropped onto a division droppable
      const targetDivisionId = overId;
      if (sourceDivisionId === targetDivisionId && !sourceGroupId) return;
      startTransition(async () => {
        await moveItemBetweenDivisions(active.id as string, targetDivisionId);
      });
    }
  }

  function saveHeader() {
    startTransition(async () => {
      await updateTemplate(template.id, name, description || null, estimateNumber || null, estimateDate || null);
      setEditingHeader(false);
    });
  }

  function saveEstimateMeta() {
    startTransition(async () => {
      await updateTemplate(template.id, name, description || null, estimateNumber || null, estimateDate || null);
    });
  }

  function saveDiv() {
    if (!divName.trim()) return;
    startTransition(async () => {
      const result = await upsertTemplateDivision(template.id, { csiCode: divCsi || undefined, name: divName });
      if (divCsi && result.id) {
        await seedTemplateDivisionFromHistory(result.id, divCsi);
      }
      setDivName(""); setDivCsi(""); setAddingDiv(false);
    });
  }

  function handleSaveToClient() {
    if (!currentClient || savedToClient) return;
    setSavedToClient(true);
    setSaveClientError("");
    startTransition(async () => {
      try {
        const result = await saveAsClientEstimate(template.id, currentClient.id, name);
        if (result.success) {
          router.push(`/${template.companyId}/clients/${result.clientId}`);
        }
      } catch (e) {
        setSaveClientError(e instanceof Error ? e.message : "Failed");
        setSavedToClient(false);
      }
    });
  }

  function handleSaveAsNew() {
    if (!newName.trim()) { setSaveError("Name is required"); return; }
    setSaveError("");
    startTransition(async () => {
      try {
        const result = await saveAsNewTemplate(template.id, newName);
        if (result.success) {
          router.push(`/${template.companyId}/estimates/${result.id}`);
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  return (
    <UndoCtx.Provider value={{ pushUndo }}>
    <TDimensionsCtx.Provider value={{ sqFt: typeof sqFt === "number" ? sqFt : null, durationMonths: typeof durationMonths === "number" ? durationMonths : null, isRoof: isRoofTemplate }}>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
            <span className="text-2xl font-bold" style={{ color: "#C9A84C" }}>${fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Undo/Redo bar */}
      {(undoState.past.length > 0 || undoState.future.length > 0) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <button onClick={doUndo} disabled={undoState.past.length === 0 || undoPending}
            className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30 transition-opacity"
            style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44", fontSize: 18 }}
            title="Undo (Ctrl+Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13C5 7 10 4 16 5.5a9 9 0 0 1 5 7.5"/></svg>
          </button>
          <button onClick={doRedo} disabled={undoState.future.length === 0 || undoPending}
            className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30 transition-opacity"
            style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44", fontSize: 18 }}
            title="Redo (Ctrl+Shift+Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13C19 7 14 4 8 5.5a9 9 0 0 0-5 7.5"/></svg>
          </button>
          {undoState.past.length > 0 && (
            <span className="text-xs ml-1" style={{ color: "#484f58" }}>
              {undoState.past[undoState.past.length - 1].label}
            </span>
          )}
          {undoPending && <span className="text-xs ml-auto" style={{ color: "#8b949e" }}>Saving…</span>}
        </div>
      )}
      {/* Header card */}
      <div className="rounded-xl p-5" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
        {editingHeader ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Scope of Work (Name)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyleSm} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Estimate #</label>
                <input value={estimateNumber} onChange={(e) => setEstimateNumber(e.target.value)} placeholder="e.g. 001" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyleSm} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Date</label>
                <input type="date" value={estimateDate} onChange={(e) => setEstimateDate(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyleSm} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveHeader} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#C9A84C", color: "#0d1117" }}>Save</button>
              <button onClick={() => setEditingHeader(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid #30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-col xl:flex-row items-start gap-6">
              <div className="flex-1 min-w-0 w-full xl:w-auto">
                <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Scope of Work: {name}</h1>
                <div className="flex gap-6 mt-2 items-center flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold shrink-0" style={{ color: "#e6edf3" }}>Estimate #</span>
                    <input
                      value={estimateNumber}
                      onChange={(e) => setEstimateNumber(e.target.value)}
                      onBlur={saveEstimateMeta}
                      placeholder="e.g. 001"
                      className="text-sm w-20 px-1 focus:outline-none"
                      style={{ borderBottom: "1px dashed #30373f", background: "transparent", color: "#e6edf3" }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium shrink-0" style={{ color: "#8b949e" }}>Date</span>
                    <input
                      type="date"
                      value={estimateDate}
                      onChange={(e) => setEstimateDate(e.target.value)}
                      onBlur={saveEstimateMeta}
                      className="text-sm px-1 focus:outline-none"
                      style={{ borderBottom: "1px dashed #30373f", background: "transparent", color: "#e6edf3" }}
                    />
                  </div>
                </div>
                {/* T&C toggle */}
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => {
                      const next = !showTerms;
                      setShowTerms(next);
                      startTransition(async () => { await updateTemplateShowTerms(template.id, next); });
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={showTerms
                      ? { background: "#C9A84C22", border: "1px solid #C9A84C55", color: "#C9A84C" }
                      : { border: "1px solid #30373f", color: "#8b949e" }
                    }
                  >
                    {showTerms ? "T&C: On" : "T&C: Off"}
                  </button>
                  {showTerms && canEdit && (
                    <div className="space-y-2">
                      {/* T&C selector */}
                      <div className="flex gap-2 items-center">
                        <select
                          className="flex-1 rounded-lg px-3 py-1.5 text-xs"
                          style={{ background: "#0d1117", border: "1px solid #30373f", color: selectedTermsTplId ? "#e6edf3" : "#8b949e" }}
                          value={selectedTermsTplId}
                          onChange={e => {
                            const id = e.target.value;
                            setSelectedTermsTplId(id);
                            const tpl = termsTemplates.find(t => t.id === id);
                            if (tpl) {
                              setTermsContent(tpl.content);
                              setTermsDirty(false);
                              // Immediately save when a preset is selected
                              startTransition(async () => { await updateTemplateTermsContent(template.id, tpl.content); });
                            }
                          }}
                        >
                          <option value="">— Select T&C template —</option>
                          {termsTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={termsContent}
                        onChange={e => { setTermsContent(e.target.value); setTermsDirty(true); saveTermsContent(e.target.value); }}
                        rows={5}
                        placeholder="Enter Terms & Conditions text, or load a saved preset above..."
                        className="w-full rounded-lg px-3 py-2 text-xs resize-y"
                        style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }}
                      />
                      <p className="text-xs" style={{ color: "#8b949e" }}>
                        {termsDirty ? "Saving…" : "Auto-saved. Prints in PDF automatically."}
                      </p>
                    </div>
                  )}
                  {showTerms && !canEdit && termsContent && (
                    <p className="text-xs leading-relaxed max-w-sm" style={{ color: "#8b949e" }}>{termsContent}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-4 flex-wrap w-full xl:w-auto">
                {/* Total + dimension cards stacked */}
                <div className="flex flex-col gap-2">
                  {/* Total card */}
                  <div className="rounded-xl px-6 py-5 flex flex-col gap-2 min-w-[200px]" style={{ background: "#0d1117", border: "1px solid #C9A84C44" }}>
                    {gcFeeAmount > 0 && (
                      <div className="flex justify-between items-center text-xs" style={{ color: "#8b949e" }}>
                        <span>Subtotal</span>
                        <span>${fmt(subtotal)}</span>
                      </div>
                    )}
                    {/* GC Fee row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>GC O&P %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={gcFeePercent}
                        onChange={e => setGcFeePercent(e.target.value === "" ? "" : Number(e.target.value))}
                        onBlur={() => {
                          const val = gcFeePercent === "" ? null : Number(gcFeePercent);
                          startTransition(async () => { await updateTemplateGcFee(template.id, val); });
                        }}
                        placeholder="0"
                        className="rounded px-2 py-1 text-xs text-right w-16"
                        style={{ background: "#161b22", border: "1px solid #30373f", color: "#C9A84C" }}
                      />
                    </div>
                    {gcFeeAmount > 0 && (
                      <div className="flex justify-between items-center text-xs" style={{ color: "#8b949e" }}>
                        <span>GC O&P</span>
                        <span style={{ color: "#C9A84C" }}>${fmt(gcFeeAmount)}</span>
                      </div>
                    )}
                    {/* Internal Profit row */}
                    <div className="border-t pt-2 mt-1" style={{ borderColor: "#1e3520" }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs shrink-0 font-semibold" style={{ color: "#22c55e88" }}>Internal Profit</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={internalProfitOverride}
                          onChange={e => setInternalProfitOverride(e.target.value === "" ? "" : Number(e.target.value))}
                          onBlur={() => {
                            const val = internalProfitOverride === "" ? null : Number(internalProfitOverride);
                            startTransition(async () => { await updateTemplateInternalProfit(template.id, val); });
                          }}
                          placeholder={fmt(autoMarkupTotal)}
                          className="rounded px-2 py-1 text-xs text-right w-24"
                          style={{ background: "#0a1a0f", border: "1px solid #22c55e44", color: "#22c55e" }}
                        />
                      </div>
                      {typeof internalProfitOverride === "number" && autoMarkupTotal > 0 && (
                        <div className="text-[10px] text-right" style={{ color: "#484f58" }}>
                          auto: ${fmt(autoMarkupTotal)}
                        </div>
                      )}
                      <div className="text-lg font-bold text-right" style={{ color: "#22c55e" }}>
                        ${fmt(internalProfit)}
                      </div>
                    </div>
                    <div className="border-t pt-2" style={{ borderColor: "#30373f" }}>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-1 text-center" style={{ color: "#8b949e" }}>Total</div>
                      <div className="text-4xl font-bold leading-none text-center" style={{ color: "#C9A84C" }}>${fmt(total)}</div>
                    </div>
                  </div>
                  {/* Sq Ft card */}
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                    <div>
                      <div className="text-xs font-medium" style={{ color: "#e6edf3" }}>Sq Ft</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "#484f58" }}>
                        {isRoofTemplate ? "Rounds up to next 100 ÷ 100 = SQ qty" : "Updates SF unit items"}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={sqFt}
                      onChange={e => setSqFt(e.target.value === "" ? "" : Number(e.target.value))}
                      onBlur={() => {
                        const val = sqFt === "" ? null : Number(sqFt);
                        startTransition(async () => { await updateTemplateSqFt(template.id, val); });
                      }}
                      placeholder="0"
                      className="rounded px-2 py-1 text-xs text-right w-20"
                      style={{ background: "#161b22", border: "1px solid #30373f", color: "#C9A84C" }}
                    />
                  </div>
                  {/* Duration card (non-roof) / Roof Options (roof) */}
                  {isRoofTemplate ? (
                    <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                      <div className="text-xs font-medium mb-1" style={{ color: "#e6edf3" }}>Roof Options</div>
                      <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <span className="text-xs" style={{ color: "#8b949e" }}>Skylights</span>
                        <button
                          onClick={() => {
                            const next = !hasSkylights;
                            setHasSkylights(next);
                            startTransition(async () => { await updateTemplateHasSkylights(template.id, next); });
                          }}
                          className="text-xs px-3 py-0.5 rounded-full font-semibold"
                          style={{ background: hasSkylights ? "#0d2318" : "#1e2736", color: hasSkylights ? "#22c55e" : "#8b949e", border: `1px solid ${hasSkylights ? "#22c55e" : "#30373f"}` }}
                        >
                          {hasSkylights ? "Yes" : "No"}
                        </button>
                      </label>
                      <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <span className="text-xs" style={{ color: "#8b949e" }}>Roof Drains</span>
                        <button
                          onClick={() => {
                            const next = !hasRoofDrains;
                            setHasRoofDrains(next);
                            startTransition(async () => { await updateTemplateHasRoofDrains(template.id, next); });
                          }}
                          className="text-xs px-3 py-0.5 rounded-full font-semibold"
                          style={{ background: hasRoofDrains ? "#0d2318" : "#1e2736", color: hasRoofDrains ? "#22c55e" : "#8b949e", border: `1px solid ${hasRoofDrains ? "#22c55e" : "#30373f"}` }}
                        >
                          {hasRoofDrains ? "Yes" : "No"}
                        </button>
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-xs" style={{ color: "#8b949e" }}>Insulation</span>
                        <div className="flex gap-1">
                          {(["ISO", "Tapered", "None"] as const).map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setInsulationType(opt);
                                startTransition(async () => { await updateTemplateInsulationType(template.id, opt); });
                              }}
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                background: insulationType === opt ? "#0d2318" : "#1e2736",
                                color: insulationType === opt ? "#22c55e" : "#8b949e",
                                border: `1px solid ${insulationType === opt ? "#22c55e" : "#30373f"}`,
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </label>
                      <label className="flex items-center justify-between gap-3">
                        <span className="text-xs" style={{ color: "#8b949e" }}>Combination</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {([null, "Shingles + Flat", "Flat + Tiles", "Flat + Metal"] as const).map((opt) => (
                            <button
                              key={opt ?? "none"}
                              onClick={() => {
                                setCombinationType(opt);
                                startTransition(async () => { await updateTemplateCombinationType(template.id, opt); });
                              }}
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                background: combinationType === opt ? "#0d2318" : "#1e2736",
                                color: combinationType === opt ? "#22c55e" : "#8b949e",
                                border: `1px solid ${combinationType === opt ? "#22c55e" : "#30373f"}`,
                              }}
                            >
                              {opt ?? "None"}
                            </button>
                          ))}
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                      <div>
                        <div className="text-xs font-medium" style={{ color: "#e6edf3" }}>Duration (months)</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "#484f58" }}>Updates mgmt, labor, potty, tools</div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={durationMonths}
                        onChange={e => setDurationMonths(e.target.value === "" ? "" : Number(e.target.value))}
                        onBlur={() => {
                          const val = durationMonths === "" ? null : Number(durationMonths);
                          startTransition(async () => { await updateTemplateDurationMonths(template.id, val); });
                        }}
                        placeholder="0"
                        className="rounded px-2 py-1 text-xs text-right w-20"
                        style={{ background: "#161b22", border: "1px solid #30373f", color: "#C9A84C" }}
                      />
                    </div>
                  )}
                </div>
                {/* Payment Schedule card */}
                <div className="min-w-[280px] max-w-[380px]">
                  <PaymentScheduleCard templateId={template.id} initialRows={paymentRows} canEdit={canEdit} />
                </div>
                {canEdit && (
                  <button onClick={() => setEditingHeader(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: "1px solid #30373f", color: "#8b949e" }}>
                    Edit header
                  </button>
                )}
              </div>
            </div>
            {/* Action Cards — full width row */}
            <div className={`grid gap-2 mt-4 ${canEdit ? "grid-cols-4" : "grid-cols-3"}`}>
              {/* Card 0 — Save Template */}
              {canEdit && (
                <button
                  onClick={() => {
                    setGlobalSaveSignal(s => s + 1);
                    setTemplateSaved(true);
                    setTimeout(() => setTemplateSaved(false), 2500);
                  }}
                  className="text-left rounded-2xl p-3 sm:p-5 transition-all"
                  style={{ background: templateSaved ? "#0a1f12" : "#0d1117", border: `2px solid ${templateSaved ? "#22c55e" : "#C9A84C"}` }}
                >
                  <div className="text-2xl mb-1 sm:mb-2">{templateSaved ? "✅" : "💾"}</div>
                  <div className="text-xs sm:text-sm font-bold sm:mb-1" style={{ color: templateSaved ? "#22c55e" : "#C9A84C" }}>
                    {templateSaved ? "Template Saved!" : "Save Template"}
                  </div>
                  <div className="hidden sm:block text-xs leading-relaxed" style={{ color: "#8b949e" }}>
                    {templateSaved ? "All changes saved to this template" : "Save all open edits to this template"}
                  </div>
                </button>
              )}
              {/* Card 1 — Create Client Estimate */}
              <button
                disabled={!canEdit || !currentClient || isPending || savedToClient || template.type !== "TEMPLATE"}
                onClick={canEdit && currentClient && !savedToClient ? handleSaveToClient : undefined}
                className="text-left rounded-2xl p-3 sm:p-5 transition-all disabled:opacity-40 group"
                style={{ background: savedToClient ? "#0a2e1a" : "#0d2318", border: `2px solid ${savedToClient ? "#16a34a" : currentClient ? "#22c55e" : "#1a3320"}` }}
              >
                <div className="text-2xl mb-1 sm:mb-2">📋</div>
                <div className="text-xs sm:text-sm font-bold sm:mb-1" style={{ color: savedToClient ? "#16a34a" : "#22c55e" }}>
                  {savedToClient ? "✓ Estimate Created" : isPending ? "Creating…" : "Create Client Estimate"}
                </div>
                <div className="hidden sm:block text-xs leading-relaxed" style={{ color: "#8b949e" }}>
                  {savedToClient ? `Saved for ${currentClient?.name}` : currentClient ? `Save a copy tied to ${currentClient.name}` : "Assign a client below first"}
                </div>
              </button>

              {/* Card 2 — Save as New Template */}
              <button
                disabled={!canEdit}
                onClick={canEdit ? () => setSaveAsNew(v => !v) : undefined}
                className="text-left rounded-2xl p-3 sm:p-5 transition-all disabled:opacity-40"
                style={{ background: saveAsNew ? "#0d1a2e" : "#0d1117", border: `2px solid ${saveAsNew ? "#60a5fa" : "#30373f"}` }}
              >
                <div className="text-2xl mb-1 sm:mb-2">📄</div>
                <div className="text-xs sm:text-sm font-bold sm:mb-1" style={{ color: "#60a5fa" }}>Save as New Template</div>
                <div className="hidden sm:block text-xs leading-relaxed" style={{ color: "#8b949e" }}>Fork this template with a different name to create a new variant</div>
              </button>

              {/* Card 3 — Export PDF */}
              <a
                href={`/api/${template.companyId}/estimates/${template.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl p-3 sm:p-5 transition-all"
                style={{ background: "#1a1508", border: "2px solid #C9A84C" }}
              >
                <div className="text-2xl mb-1 sm:mb-2">📊</div>
                <div className="text-xs sm:text-sm font-bold sm:mb-1" style={{ color: "#C9A84C" }}>Export PDF</div>
                <div className="hidden sm:block text-xs leading-relaxed" style={{ color: "#8b949e" }}>Download a ready-to-send PDF of the current estimate</div>
              </a>

              {/* Card 4 — Export PDF with Cover (opens options modal) */}
              <button
                onClick={() => setShowPdfModal(true)}
                className="block w-full text-left rounded-2xl p-3 sm:p-5 transition-all cursor-pointer"
                style={{ background: "#0d1a1a", border: "2px solid #C9A84C66" }}
              >
                <div className="text-2xl mb-1 sm:mb-2">📋</div>
                <div className="text-xs sm:text-sm font-bold sm:mb-1" style={{ color: "#C9A84C" }}>Export PDF + Cover</div>
                <div className="hidden sm:block text-xs leading-relaxed" style={{ color: "#8b949e" }}>Choose cover, page 2 &amp; insert options</div>
              </button>
            </div>

            {showPdfModal && (
              <CoverPagePickerModal
                isCommercial={isCommercial}
                initialCoverType={(clientCoverPhotoType as CoverType) ?? undefined}
                customCoverUrl={clientCoverPhotoUrl}
                hasInsertFile={hasInsertFile}
                confirmLabel="Download PDF"
                showPreview
                companyId={template.companyId}
                clientId={currentClient?.id}
                onConfirm={(opts: PdfOptions) => {
                  let url = `/api/${template.companyId}/estimates/${template.id}/pdf?cover=1&coverType=${opts.coverType}&page2=${opts.page2}&includeInsert=${opts.includeInsert ? 1 : 0}&divSummary=${opts.includeDivisionSummary ? 1 : 0}&forcedBreakCsi=${opts.forcedBreakCsiPrefixes.join(",")}&noPresent=${opts.noPresentation ? 1 : 0}`;
                  if (opts.coverType === "CUSTOM" && opts.coverBlobUrl) url += `&coverBlobUrl=${encodeURIComponent(opts.coverBlobUrl)}`;
                  window.open(url, "_blank");
                  setShowPdfModal(false);
                }}
                onPreview={(opts: PdfOptions) => {
                  let url = `/api/${template.companyId}/estimates/${template.id}/pdf?cover=1&coverType=${opts.coverType}&page2=${opts.page2}&includeInsert=${opts.includeInsert ? 1 : 0}&divSummary=${opts.includeDivisionSummary ? 1 : 0}&forcedBreakCsi=${opts.forcedBreakCsiPrefixes.join(",")}&noPresent=${opts.noPresentation ? 1 : 0}&preview=1`;
                  if (opts.coverType === "CUSTOM" && opts.coverBlobUrl) url += `&coverBlobUrl=${encodeURIComponent(opts.coverBlobUrl)}`;
                  window.open(url, "_blank");
                }}
                onClose={() => setShowPdfModal(false)}
              />
            )}

            <ClientSelector
              templateId={template.id}
              currentClient={currentClient}
              allClients={allClients}
              canEdit={canEdit}
            />
          </div>
        )}

        {saveAsNew && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: "#0d1421", border: "2px solid #60a5fa" }}>
            <p className="text-xs font-semibold" style={{ color: "#60a5fa" }}>New Template Name</p>
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsNew()}
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={inputStyleSm}
                placeholder="e.g. Addition v2"
              />
              <button onClick={handleSaveAsNew} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#60a5fa", color: "#0d1117" }}>
                {isPending ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setSaveAsNew(false)} className="text-sm px-2" style={{ color: "#8b949e" }}>✕</button>
            </div>
            {saveError && <p className="text-xs" style={{ color: "#ef4444" }}>{saveError}</p>}
          </div>
        )}

        {saveClientError && (
          <p className="mt-2 text-xs" style={{ color: "#ef4444" }}>{saveClientError}</p>
        )}
      </div>

      {/* Divisions — grouped into super-sections (e.g. SHELL) */}
      <div className="space-y-3">
        {groupDivisionsT(divisions.filter(d => {
          if (!isRoofTemplate) return true;
          const n = d.name.toLowerCase();
          if (n.includes("skylight") && !hasSkylights) return false;
          if ((n.includes("drain") || n.includes("roof drain")) && !hasRoofDrains) return false;
          return true;
        })).map(({ groupLabel, divs }, gi) => {
          const rawTotal = divs.reduce((s, d) => s + divisionTotal(d), 0);
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

          return (
            <div key={gi}>
              {groupLabel && (
                <div>
                  <div className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: "#C9A84C", color: "#0d1117" }}>
                    <span className="text-sm font-bold tracking-widest uppercase">{groupLabel}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">${fmt(displayTotal)}</span>
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
                    <div className="rounded-b-lg p-3 space-y-2" style={{ background: "#1c2128", border: "1px solid #C9A84C", borderTop: "none" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "#C9A84C" }}>Override {groupLabel} Total</p>
                      <div className="flex flex-wrap gap-2">
                        <div>
                          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Qty</label>
                          <input type="number" className="rounded px-2 py-1 text-xs w-20" style={inputStyle}
                            value={sgForm.qty ?? ""} onChange={e => setSgForm(f => ({ ...f, qty: e.target.value ? Number(e.target.value) : null }))} placeholder="Qty" />
                        </div>
                        <div>
                          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Unit</label>
                          <select className="rounded px-2 py-1 text-xs" style={{ ...inputStyle, width: "72px" }}
                            value={sgForm.unit ?? ""} onChange={e => setSgForm(f => ({ ...f, unit: e.target.value || null }))}>
                            <option value="">—</option>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Unit Cost</label>
                          <input type="number" className="rounded px-2 py-1 text-xs w-24" style={inputStyle}
                            value={sgForm.unitCost ?? ""} onChange={e => setSgForm(f => ({ ...f, unitCost: e.target.value ? Number(e.target.value) : null }))} placeholder="0.00" />
                        </div>
                        <div>
                          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Markup %</label>
                          <input type="number" className="rounded px-2 py-1 text-xs w-20" style={inputStyle}
                            value={sgForm.markupPct ?? ""} onChange={e => setSgForm(f => ({ ...f, markupPct: e.target.value ? Number(e.target.value) : null }))} placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs mb-0.5" style={{ color: "#8b949e" }}>Manual Total Override</label>
                          <input type="number" className="rounded px-2 py-1 text-xs w-28" style={inputStyle}
                            value={sgForm.manualTotal ?? ""} onChange={e => setSgForm(f => ({ ...f, manualTotal: e.target.value ? Number(e.target.value) : null }))} placeholder="0.00" />
                        </div>
                      </div>
                      {computedSgTotal !== null && sgForm.manualTotal === null && (
                        <p className="text-xs" style={{ color: "#8b949e" }}>Computed: ${fmt(computedSgTotal)}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          className="text-xs rounded px-3 py-1 font-semibold"
                          style={{ background: "#C9A84C", color: "#0d1117" }}
                          onClick={() => startTransition(async () => {
                            await updateTemplateSummaryGroup(template.id, groupLabel, sgForm);
                            setSummaryGroups(g => ({ ...g, [groupLabel]: sgForm }));
                            setEditingSummaryGroup(null);
                          })}
                        >Save</button>
                        <button
                          className="text-xs rounded px-3 py-1"
                          style={{ background: "#30373f", color: "#e6edf3" }}
                          onClick={() => startTransition(async () => {
                            await updateTemplateSummaryGroup(template.id, groupLabel, null);
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
                  <TemplateDivisionSection key={div.id} division={div} otherDivisions={divisions.filter(d => d.id !== div.id)} canEdit={canEdit} globalSaveSignal={globalSaveSignal} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Division */}
      {canEdit && (
        <div className="rounded-xl p-4" style={{ border: "1px dashed #30373f" }}>
          {addingDiv ? (
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-medium mb-1" style={{ color: "#8b949e" }}>Select Division</label>
                {(() => {
                  const usedCodes = new Set(divisions.map((d: Division) => d.csiCode).filter(Boolean));
                  const available = DIVISIONS.filter(d => !usedCodes.has(d.code));
                  return (
                    <select
                      autoFocus
                      value={divCsi}
                      onChange={e => {
                        const picked = DIVISIONS.find(d => d.code === e.target.value);
                        setDivCsi(picked?.code ?? "");
                        setDivName(picked?.name ?? "");
                      }}
                      className="w-full rounded px-2 py-1.5 text-sm"
                      style={inputStyle}
                    >
                      <option value="">— choose a division —</option>
                      {available.map(d => (
                        <option key={d.code} value={d.code}>{d.code} – {d.name}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <div className="flex gap-2 items-end pt-5">
                <button onClick={saveDiv} disabled={isPending || !divCsi} className="px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40" style={{ background: "#C9A84C", color: "#0d1117" }}>Add</button>
                <button onClick={() => { setAddingDiv(false); setDivCsi(""); setDivName(""); }} className="text-sm px-2" style={{ color: "#8b949e" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingDiv(true)} className="text-sm w-full text-center" style={{ color: "#8b949e" }}>
              + Add Division
            </button>
          )}
        </div>
      )}

      {/* Backfill CSI codes */}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            disabled={backfilling}
            onClick={async () => {
              setBackfilling(true);
              setBackfillResult(null);
              try {
                const res = await fetch(`/api/${template.companyId}/backfill-csi-codes`, { method: "POST" });
                const data = await res.json();
                setBackfillResult(`Done — ${data.updated} division${data.updated !== 1 ? "s" : ""} updated`);
                if (data.updated > 0) router.refresh();
              } catch {
                setBackfillResult("Failed");
              } finally {
                setBackfilling(false);
              }
            }}
            className="text-xs px-3 py-1.5 rounded"
            style={{ background: "#1e2736", border: "1px solid #30373f", color: backfilling ? "#8b949e" : "#e6edf3" }}
          >
            {backfilling ? "Applying CSI codes…" : "Auto-fill CSI Codes"}
          </button>
          {backfillResult && <span className="text-xs" style={{ color: "#8b949e" }}>{backfillResult}</span>}
        </div>
      )}

      {/* Allowances card */}
      {(() => {
        const allowanceItems = divisions.flatMap(d => [
          ...d.items.filter(i => i.detail === "Allowances"),
          ...d.groups.flatMap(g => g.items.filter(i => i.detail === "Allowances")),
        ]);
        const allowanceTotal = allowanceItems.reduce((s, i) => s + itemTotal(i), 0);
        if (allowanceItems.length === 0) return null;
        return (
          <div className="rounded-xl p-5" style={{ background: "#1e2736", border: "1px solid #C9A84C" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm uppercase tracking-wide" style={{ color: "#C9A84C" }}>Allowances</span>
              <span className="font-bold text-xl" style={{ color: "#C9A84C" }}>${fmt(allowanceTotal)}</span>
            </div>
            <div className="space-y-1">
              {allowanceItems.map(i => (
                <div key={i.id} className="flex justify-between text-xs" style={{ color: "#8b949e" }}>
                  <span>{i.csiCode ? <span className="font-mono mr-2">{i.csiCode}</span> : null}{i.name}</span>
                  <span>{itemTotal(i) > 0 ? `$${fmt(itemTotal(i))}` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Summary footer */}
      <div className="rounded-xl p-5 flex justify-between items-center" style={{ background: "#0d1117", border: "1px solid #C9A84C44" }}>
        <span className="font-semibold text-lg" style={{ color: "#e6edf3" }}>Estimate Total</span>
        <span className="text-4xl font-bold" style={{ color: "#C9A84C" }}>${fmt(total)}</span>
      </div>
    </div>
    <DragOverlay>
      {activeDragItem && (
        <div className="rounded px-3 py-1.5 text-sm font-medium shadow-xl pointer-events-none"
          style={{ background: activeDragItem.type === "division" ? "#1e2736" : "#C9A84C", color: activeDragItem.type === "division" ? "#e6edf3" : "#0d1117", border: activeDragItem.type === "division" ? "1px solid #C9A84C" : "none", opacity: 0.95 }}>
          ⠿ {activeDragItem.name}
        </div>
      )}
    </DragOverlay>
    </DndContext>
    </TDimensionsCtx.Provider>
    </UndoCtx.Provider>
  );
}
