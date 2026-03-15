"use client";

import { useState, useTransition } from "react";
import {
  upsertEstimateItem,
  archiveEstimateItem,
  upsertEstimateDivision,
  archiveEstimateDivision,
  upsertEstimateGroup,
  archiveEstimateGroup,
  updateEstimate,
} from "@/app/[companyId]/[projectId]/estimates/actions";
import {
  computeItemTotal,
  computeGroupTotal,
  computeDivisionTotal,
  computeEstimateTotal,
  fmt,
  type ItemLike,
} from "@/lib/estimates/totals";
import { lookupItemCsiCode } from "@/lib/divisions";

type Item = ItemLike & { id: string; name: string; csiCode: string | null; unit: string | null; vendor: string | null; notes: string | null; sortOrder: number };
type Group = { id: string; name: string; items: Item[] };
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };
type Estimate = { id: string; name: string; description: string | null; status: string; projectId: string };

const STATUS_OPTIONS = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];

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
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: item.name,
    csiCode: item.csiCode ?? "",
    unit: item.unit ?? "",
    qty: item.qty,
    unitCost: item.unitCost,
    markupPct: item.markupPct,
    vendor: item.vendor ?? "",
    notes: item.notes ?? "",
  });

  const total = computeItemTotal(item);

  function save() {
    startTransition(async () => {
      await upsertEstimateItem(divisionId, {
        id: item.id,
        groupId: groupId ?? null,
        name: form.name,
        csiCode: form.csiCode || null,
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
                className="text-xs text-red-500 hover:text-red-700 px-2"
              >
                Remove
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
        <input className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono" value={form.csiCode} onChange={(e) => setForm({ ...form, csiCode: e.target.value })} placeholder="CSI" />
      </td>
      <td className="px-2 py-1">
        <input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.name} onChange={(e) => { const n = e.target.value; const auto = lookupItemCsiCode(n); setForm({ ...form, name: n, csiCode: auto ?? form.csiCode }); }} />
      </td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
      </td>
      <td className="px-2 py-1">
        <input className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-center" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unit" />
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
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", csiCode: "", unit: "", qty: "1", unitCost: "0", markupPct: "0" });

  if (!canEdit) return null;

  function save() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await upsertEstimateItem(divisionId, {
        groupId: groupId ?? null,
        name: form.name,
        csiCode: form.csiCode || null,
        unit: form.unit || null,
        qty: Number(form.qty),
        unitCost: Number(form.unitCost),
        laborCost: 0,
        materialCost: 0,
        markupPct: Number(form.markupPct),
      });
      setForm({ name: "", csiCode: "", unit: "", qty: "1", unitCost: "0", markupPct: "0" });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={8} className="px-3 py-1">
          <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:text-blue-800">+ Add Item</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-green-50 border-t border-green-100">
      <td className="px-2 py-1">
        <input className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono" value={form.csiCode} onChange={(e) => setForm({ ...form, csiCode: e.target.value })} placeholder="CSI" />
      </td>
      <td className="px-2 py-1">
        <input autoFocus className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.name} onChange={(e) => { const n = e.target.value; const auto = lookupItemCsiCode(n); setForm({ ...form, name: n, csiCode: auto ?? form.csiCode }); }} placeholder="Item name" />
      </td>
      <td className="px-2 py-1">
        <input type="number" step="any" className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
      </td>
      <td className="px-2 py-1">
        <input className="w-16 border border-slate-300 rounded px-2 py-1 text-xs text-center" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unit" />
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
              onClick={() => { if (confirm("Remove group?")) startTransition(async () => { await archiveEstimateGroup(group.id); }); }}
              disabled={isPending}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
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
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  const total = computeDivisionTotal(division.groups, division.items);

  function saveGroup() {
    if (!groupName.trim()) return;
    startTransition(async () => {
      await upsertEstimateGroup(division.id, { name: groupName });
      setGroupName("");
      setAddingGroup(false);
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs">{open ? "▼" : "▶"}</span>
          {division.csiCode && (
            <span className="font-semibold text-slate-900">{division.csiCode}</span>
          )}
          <span className="font-semibold text-slate-900">{division.name}</span>
        </div>
        <span className="text-sm font-bold text-slate-900">${fmt(total)}</span>
      </button>

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
                onClick={() => { if (confirm("Remove division?")) startTransition(async () => { await archiveEstimateDivision(division.id); }); }}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Remove Division
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
}: {
  estimate: Estimate;
  divisions: Division[];
  canEdit: boolean;
  canArchive: boolean;
  companyId: string;
  projectId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState(estimate.name);
  const [description, setDescription] = useState(estimate.description ?? "");
  const [status, setStatus] = useState(estimate.status);
  const [addingDiv, setAddingDiv] = useState(false);
  const [divName, setDivName] = useState("");
  const [divCsi, setDivCsi] = useState("");

  const grandTotal = computeEstimateTotal(divisions);

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
    <div className="space-y-4">
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
              {/* Prominent TOTAL card */}
              <div className="bg-slate-900 text-white rounded-xl px-8 py-5 text-center min-w-[180px]">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Total</div>
                <div className="text-5xl font-bold leading-none">${fmt(grandTotal)}</div>
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

      {/* Divisions */}
      <div className="space-y-3">
        {divisions.map((div) => (
          <DivisionSection key={div.id} division={div} canEdit={canEdit} canArchive={canArchive} />
        ))}
      </div>

      {/* Add Division */}
      {canEdit && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4">
          {addingDiv ? (
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CSI Code (optional)</label>
                <input value={divCsi} onChange={(e) => setDivCsi(e.target.value)} placeholder="e.g. 03" className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24" />
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

      {/* Summary footer */}
      <div className="bg-slate-900 text-white rounded-xl p-5 flex justify-between items-center">
        <span className="font-semibold text-lg">Estimate Total</span>
        <span className="text-4xl font-bold">${fmt(grandTotal)}</span>
      </div>
    </div>
  );
}
