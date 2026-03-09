"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  upsertTemplateItem,
  archiveTemplateItem,
  upsertTemplateDivision,
  archiveTemplateDivision,
  upsertTemplateGroup,
  archiveTemplateGroup,
  updateTemplate,
  saveAsNewTemplate,
  setTemplateClient,
  upsertClient,
  saveAsClientEstimate,
} from "@/app/[companyId]/estimates/actions";

type Item = {
  id: string;
  name: string;
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
type Division = { id: string; csiCode: string | null; name: string; groups: Group[]; items: Item[] };
type Template = { id: string; name: string; description: string | null; companyId: string };

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

function divisionTotal(div: Division): number {
  return div.groups.reduce((s, g) => s + groupTotal(g.items), 0) + groupTotal(div.items);
}

function grandTotal(divisions: Division[]): number {
  return divisions.reduce((s, d) => s + divisionTotal(d), 0);
}

function ItemRow({ item, divisionId, groupId, canEdit }: { item: Item; divisionId: string; groupId?: string | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: item.name,
    unit: item.unit ?? "",
    defaultQty: item.defaultQty?.toString() ?? "",
    defaultUnitCost: item.defaultUnitCost?.toString() ?? "",
    defaultMarkupPct: item.defaultMarkupPct?.toString() ?? "",
    notes: item.notes ?? "",
    visibleInPdf: item.visibleInPdf,
  });

  function save() {
    startTransition(async () => {
      await upsertTemplateItem(divisionId, {
        id: item.id,
        groupId: groupId ?? null,
        name: form.name,
        unit: form.unit || null,
        defaultQty: form.defaultQty ? Number(form.defaultQty) : null,
        defaultUnitCost: form.defaultUnitCost ? Number(form.defaultUnitCost) : null,
        defaultLaborCost: item.defaultLaborCost,
        defaultMaterialCost: item.defaultMaterialCost,
        defaultMarkupPct: form.defaultMarkupPct ? Number(form.defaultMarkupPct) : null,
        notes: form.notes || null,
        visibleInPdf: form.visibleInPdf,
      });
      setEditing(false);
    });
  }

  const total = itemTotal(item);

  if (!editing) {
    return (
      <tr className="border-t border-slate-100 hover:bg-slate-50 group text-sm">
        <td className="px-3 py-2 text-slate-800">{item.name}</td>
        <td className="px-3 py-2 text-slate-500 text-right">{item.defaultQty ?? "—"}</td>
        <td className="px-3 py-2 text-slate-500 text-center">{item.unit ?? "—"}</td>
        <td className="px-3 py-2 text-slate-500 text-right">{item.defaultUnitCost != null ? `$${fmt(item.defaultUnitCost)}` : "—"}</td>
        <td className="px-3 py-2 text-slate-500 text-right">{item.defaultMarkupPct != null ? `${item.defaultMarkupPct}%` : "—"}</td>
        <td className="px-3 py-2 text-slate-900 font-semibold text-right">{total > 0 ? `$${fmt(total)}` : "—"}</td>
        <td className="px-3 py-2 text-slate-400 text-sm italic truncate max-w-[120px]">{item.notes ?? ""}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <>
                <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 px-2">Edit</button>
                <button onClick={() => { if (confirm("Remove item?")) startTransition(async () => { await archiveTemplateItem(item.id); }); }} disabled={isPending} className="text-xs text-red-500 hover:text-red-700 px-2">Remove</button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  const previewTotal = (form.defaultQty ? Number(form.defaultQty) : 0) * (form.defaultUnitCost ? Number(form.defaultUnitCost) : 0) * (1 + (form.defaultMarkupPct ? Number(form.defaultMarkupPct) : 0) / 100);

  return (
    <tr className="border-t border-blue-100 bg-blue-50">
      <td className="px-2 py-1"><input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className="w-14 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.defaultQty} onChange={(e) => setForm({ ...form, defaultQty: e.target.value })} /></td>
      <td className="px-2 py-1"><input className="w-14 border border-slate-300 rounded px-2 py-1 text-xs" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unit" /></td>
      <td className="px-2 py-1"><input type="number" step="any" className="w-20 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.defaultUnitCost} onChange={(e) => setForm({ ...form, defaultUnitCost: e.target.value })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className="w-14 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.defaultMarkupPct} onChange={(e) => setForm({ ...form, defaultMarkupPct: e.target.value })} /></td>
      <td className="px-2 py-1 text-xs font-semibold text-slate-700 text-right">{previewTotal > 0 ? `$${fmt(previewTotal)}` : "—"}</td>
      <td className="px-2 py-1"><input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="notes" /></td>
      <td className="px-2 py-1">
        <div className="flex gap-1 justify-end">
          <button onClick={save} disabled={isPending} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-500 px-2">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function AddTemplateItemRow({ divisionId, groupId, canEdit }: { divisionId: string; groupId?: string | null; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", unit: "", defaultQty: "", defaultUnitCost: "", defaultMarkupPct: "", notes: "", visibleInPdf: true });

  if (!canEdit) return null;

  function save() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await upsertTemplateItem(divisionId, {
        groupId: groupId ?? null,
        name: form.name,
        unit: form.unit || null,
        defaultQty: form.defaultQty ? Number(form.defaultQty) : null,
        defaultUnitCost: form.defaultUnitCost ? Number(form.defaultUnitCost) : null,
        defaultMarkupPct: form.defaultMarkupPct ? Number(form.defaultMarkupPct) : null,
        notes: form.notes || null,
        visibleInPdf: form.visibleInPdf,
      });
      setForm({ name: "", unit: "", defaultQty: "", defaultUnitCost: "", defaultMarkupPct: "", notes: "", visibleInPdf: true });
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
      <td className="px-2 py-1"><input autoFocus className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" /></td>
      <td className="px-2 py-1"><input type="number" step="any" className="w-14 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.defaultQty} onChange={(e) => setForm({ ...form, defaultQty: e.target.value })} /></td>
      <td className="px-2 py-1"><input className="w-14 border border-slate-300 rounded px-2 py-1 text-xs" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unit" /></td>
      <td className="px-2 py-1"><input type="number" step="any" className="w-20 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.defaultUnitCost} onChange={(e) => setForm({ ...form, defaultUnitCost: e.target.value })} /></td>
      <td className="px-2 py-1"><input type="number" step="any" className="w-14 border border-slate-300 rounded px-2 py-1 text-xs text-right" value={form.defaultMarkupPct} onChange={(e) => setForm({ ...form, defaultMarkupPct: e.target.value })} /></td>
      <td />
      <td className="px-2 py-1"><input className="w-full border border-slate-300 rounded px-2 py-1 text-xs" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="notes" /></td>
      <td className="px-2 py-1">
        <div className="flex gap-1 justify-end">
          <button onClick={save} disabled={isPending} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Add</button>
          <button onClick={() => setOpen(false)} className="text-xs text-slate-500 px-2">Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function TemplateItemTable({ divisionId, groupId, items, canEdit }: { divisionId: string; groupId?: string | null; items: Item[]; canEdit: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 bg-slate-50">
            <th className="px-3 py-1.5 text-left font-medium">Item</th>
            <th className="px-3 py-1.5 text-right font-medium w-16">Qty</th>
            <th className="px-3 py-1.5 text-center font-medium w-16">Unit</th>
            <th className="px-3 py-1.5 text-right font-medium w-24">Cost</th>
            <th className="px-3 py-1.5 text-right font-medium w-16">Markup</th>
            <th className="px-3 py-1.5 text-right font-medium w-28 text-slate-800">TOTAL</th>
            <th className="px-3 py-1.5 text-left font-medium">Notes</th>
            <th className="w-20" />
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
  );
}

function TemplateGroupSection({ group, divisionId, canEdit }: { group: Group; divisionId: string; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const total = groupTotal(group.items);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{group.name}</span>
        <div className="flex items-center gap-3">
          {total > 0 && <span className="text-xs font-semibold text-slate-700">${fmt(total)}</span>}
          {canEdit && (
            <button onClick={() => { if (confirm("Remove group?")) startTransition(async () => { await archiveTemplateGroup(group.id); }); }} disabled={isPending} className="text-xs text-red-400 hover:text-red-600">
              Remove
            </button>
          )}
        </div>
      </div>
      <TemplateItemTable divisionId={divisionId} groupId={group.id} items={group.items} canEdit={canEdit} />
    </div>
  );
}

function TemplateDivisionSection({ division, canEdit }: { division: Division; canEdit: boolean }) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  const total = divisionTotal(division);

  function saveGroup() {
    if (!groupName.trim()) return;
    startTransition(async () => {
      await upsertTemplateGroup(division.id, { name: groupName });
      setGroupName("");
      setAddingGroup(false);
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
        <span className="text-slate-400 text-xs">{open ? "▼" : "▶"}</span>
        {division.csiCode && <span className="text-xs font-mono text-slate-400">{division.csiCode}</span>}
        <span className="font-semibold text-slate-900">{division.name}</span>
        {total > 0 && <span className="ml-auto text-sm font-bold text-slate-900">${fmt(total)}</span>}
      </button>

      {open && (
        <div className="border-t border-slate-100 pb-2">
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
                  <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="border border-slate-300 rounded px-2 py-1 text-xs flex-1" />
                  <button onClick={saveGroup} disabled={isPending} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Add</button>
                  <button onClick={() => setAddingGroup(false)} className="text-xs text-slate-500">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingGroup(true)} className="text-xs text-slate-400 hover:text-blue-600">+ Add Group</button>
              )}
            </div>
          )}
          {canEdit && (
            <div className="px-3 pt-1">
              <button onClick={() => { if (confirm("Remove division?")) startTransition(async () => { await archiveTemplateDivision(division.id); }); }} disabled={isPending} className="text-xs text-red-400 hover:text-red-600">
                Remove Division
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ClientData = { id: string; name: string; address: string | null; email: string | null; phone: string | null };

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
      const client = await upsertClient({ name: newName, address: newAddress, email: newEmail });
      await setTemplateClient(templateId, client.id);
      setDisplayClient({ id: client.id, name: client.name, address: client.address, email: client.email, phone: client.phone });
      setNewName(""); setNewAddress(""); setNewEmail("");
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

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Client</p>
          {displayClient ? (
            <div>
              <p className="text-sm font-semibold text-slate-900">{displayClient.name}</p>
              {displayClient.address && <p className="text-xs text-slate-500">{displayClient.address}</p>}
              {displayClient.email && <p className="text-xs text-slate-400">{displayClient.email}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No client assigned</p>
          )}
        </div>
        {canEdit && mode === "view" && (
          <div className="flex gap-2">
            <button onClick={() => setMode("select")} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-slate-200 rounded">
              {displayClient ? "Change" : "Assign Client"}
            </button>
            {displayClient && (
              <button onClick={handleClear} disabled={isPending} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {canEdit && mode === "select" && (
        <div className="mt-3 flex gap-2 items-end flex-wrap">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Select existing client</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">— choose —</option>
              {allClients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.address ? ` — ${c.address}` : ""}</option>
              ))}
            </select>
          </div>
          <button onClick={handleAssignExisting} disabled={isPending || !selectedId} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">Assign</button>
          <button onClick={() => setMode("new")} className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded">+ New Client</button>
          <button onClick={() => setMode("view")} className="text-xs text-slate-400 px-2">Cancel</button>
        </div>
      )}

      {canEdit && mode === "new" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Client name" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="123 Main St, City, State" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="client@email.com" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleCreateNew} disabled={isPending || !newName.trim()} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded">Create & Assign</button>
            <button onClick={() => setMode("select")} className="text-xs text-slate-400 px-2">Back</button>
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
}: {
  template: Template;
  divisions: Division[];
  canEdit: boolean;
  currentClient: { id: string; name: string; address: string | null; email: string | null; phone: string | null } | null;
  allClients: { id: string; name: string; address: string | null; email: string | null; phone: string | null }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [addingDiv, setAddingDiv] = useState(false);
  const [divName, setDivName] = useState("");
  const [divCsi, setDivCsi] = useState("");
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [newName, setNewName] = useState(`${template.name} (copy)`);
  const [saveError, setSaveError] = useState("");
  const [savingToClient, setSavingToClient] = useState(false);
  const [saveEstimateName, setSaveEstimateName] = useState("");
  const [saveClientError, setSaveClientError] = useState("");

  const total = grandTotal(divisions);

  function saveHeader() {
    startTransition(async () => {
      await updateTemplate(template.id, name, description || null);
      setEditingHeader(false);
    });
  }

  function saveDiv() {
    if (!divName.trim()) return;
    startTransition(async () => {
      await upsertTemplateDivision(template.id, { csiCode: divCsi || undefined, name: divName });
      setDivName(""); setDivCsi(""); setAddingDiv(false);
    });
  }

  function handleSaveToClient() {
    if (!saveEstimateName.trim() || !currentClient) return;
    setSaveClientError("");
    startTransition(async () => {
      try {
        const result = await saveAsClientEstimate(template.id, currentClient.id, saveEstimateName);
        if (result.success) {
          router.push(`/${template.companyId}/clients/${result.clientId}`);
        }
      } catch (e) {
        setSaveClientError(e instanceof Error ? e.message : "Failed");
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {editingHeader ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
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
          <div>
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{template.name}</h1>
                {template.description && <p className="text-sm text-slate-500 mt-1">{template.description}</p>}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {/* Prominent TOTAL card */}
                <div className="bg-slate-900 text-white rounded-xl px-8 py-5 text-center min-w-[180px]">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Total</div>
                  <div className="text-5xl font-bold leading-none">${fmt(total)}</div>
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-2 items-start">
                  <a
                    href={`/api/${template.companyId}/estimates/${template.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 font-medium"
                  >
                    Export PDF
                  </a>
                  {canEdit && (
                    <>
                      <button onClick={() => setSaveAsNew(!saveAsNew)} className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium">
                        Save as New Template
                      </button>
                      {canEdit && currentClient && (
                        <button
                          onClick={() => { setSavingToClient(!savingToClient); setSaveEstimateName(template.name); }}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium"
                        >
                          Save to Client
                        </button>
                      )}
                      <button onClick={() => setEditingHeader(true)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <ClientSelector
              templateId={template.id}
              currentClient={currentClient}
              allClients={allClients}
              canEdit={canEdit}
            />
          </div>
        )}

        {saveAsNew && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <label className="block text-xs font-medium text-slate-700">New Template Name</label>
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Addition v2"
              />
              <button onClick={handleSaveAsNew} disabled={isPending} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {isPending ? "Saving..." : "Save Copy"}
              </button>
              <button onClick={() => setSaveAsNew(false)} className="text-sm text-slate-500 px-2">Cancel</button>
            </div>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          </div>
        )}

        {savingToClient && currentClient && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <label className="block text-xs font-medium text-slate-700">Estimate Name</label>
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={saveEstimateName}
                onChange={(e) => setSaveEstimateName(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Kitchen Remodel 2026"
              />
              <button onClick={handleSaveToClient} disabled={isPending || !saveEstimateName.trim()} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {isPending ? "Saving..." : `Save for ${currentClient.name}`}
              </button>
              <button onClick={() => setSavingToClient(false)} className="text-sm text-slate-500 px-2">Cancel</button>
            </div>
            {saveClientError && <p className="text-xs text-red-600">{saveClientError}</p>}
          </div>
        )}
      </div>

      {/* Divisions */}
      <div className="space-y-3">
        {divisions.map((div) => (
          <TemplateDivisionSection key={div.id} division={div} canEdit={canEdit} />
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
        <span className="text-4xl font-bold">${fmt(total)}</span>
      </div>
    </div>
  );
}
