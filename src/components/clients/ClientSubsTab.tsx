"use client";
import { useState, useMemo } from "react";

type Sub = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  divisionCode: string;
  divisionName: string;
};

type Assignment = {
  id: string;
  divisionId: string | null;
  itemId: string | null;
  label: string;
  subContractorId: string | null;
  subName: string | null;
  cost: number | null;
  salePrice: number | null;
  notes: string | null;
};

type Item = {
  id: string;
  name: string;
  groupName?: string | null;
};

type Division = {
  id: string;
  name: string;
  csiCode: string | null;
  items: Item[];
};

type Estimate = {
  id: string;
  name: string;
  divisions: Division[];
};

type Props = {
  companyId: string;
  clientId: string;
  estimates: Estimate[];
  initialSubs: Sub[];
  initialAssignments: Assignment[];
};

const $ = (n: number | null | undefined) =>
  n != null
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : "—";

const INPUT = {
  background: "#0d1117",
  border: "1px solid #30373f",
  color: "#e6edf3",
  outline: "none",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 13,
  width: "100%",
};

function NewSubModal({
  companyId,
  onCreated,
  onClose,
}: {
  companyId: string;
  onCreated: (sub: Sub) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", divisionCode: "", divisionName: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    const res = await fetch(`/api/${companyId}/subs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        divisionCode: form.divisionCode.trim() || "00",
        divisionName: form.divisionName.trim() || "General",
      }),
    });
    if (!res.ok) { setError("Failed to save"); setSaving(false); return; }
    const sub = await res.json();
    onCreated(sub);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "#161b22", border: "1px solid #30373f" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm" style={{ color: "#C9A84C" }}>Add New Sub</h3>
          <button onClick={onClose} style={{ color: "#888" }} className="text-xl leading-none">✕</button>
        </div>

        {[
          { label: "Name *", key: "name" as const, placeholder: "Sub / company name" },
          { label: "Email", key: "email" as const, placeholder: "email@example.com" },
          { label: "Phone", key: "phone" as const, placeholder: "305-000-0000" },
          { label: "Division Code", key: "divisionCode" as const, placeholder: "e.g. 03" },
          { label: "Division Name", key: "divisionName" as const, placeholder: "e.g. Concrete" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-semibold block mb-1" style={{ color: "#888" }}>{label}</label>
            <input
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              style={INPUT}
            />
          </div>
        ))}

        {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

        <div className="flex gap-3 justify-end mt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "#1e2736", color: "#888" }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#C9A84C", color: "#0d1117", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Add Sub"}
          </button>
        </div>
      </div>
    </div>
  );
}

type PendingRow = {
  key: string; // divisionId or "item:"+itemId
  label: string;
  divisionId: string | null;
  itemId: string | null;
  subId: string;
  subName: string;
  cost: string;
  salePrice: string;
};

export default function ClientSubsTab({ companyId, clientId, estimates, initialSubs, initialAssignments }: Props) {
  const [subs, setSubs] = useState<Sub[]>(initialSubs);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Map<string, PendingRow>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ subId: string; subName: string; cost: string; salePrice: string }>({ subId: "", subName: "", cost: "", salePrice: "" });
  const [showNewSub, setShowNewSub] = useState(false);
  const [newSubTarget, setNewSubTarget] = useState<string | null>(null); // pending key to assign new sub to

  const activeEstimate = estimates[0] ?? null;

  // Assigned keys (divisionId or "item:"+itemId) to prevent duplicate rows
  const assignedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const a of assignments) {
      if (a.itemId) s.add(`item:${a.itemId}`);
      else if (a.divisionId) s.add(a.divisionId);
    }
    return s;
  }, [assignments]);

  function toggle(key: string, label: string, divisionId: string | null, itemId: string | null) {
    if (assignedKeys.has(key)) return; // already saved
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setPending(p => { const m = new Map(p); m.delete(key); return m; });
      } else {
        next.add(key);
        setPending(p => {
          const m = new Map(p);
          m.set(key, { key, label, divisionId, itemId, subId: "", subName: "", cost: "", salePrice: "" });
          return m;
        });
      }
      return next;
    });
  }

  function updatePending(key: string, patch: Partial<PendingRow>) {
    setPending(p => {
      const m = new Map(p);
      const row = m.get(key);
      if (row) m.set(key, { ...row, ...patch });
      return m;
    });
  }

  async function saveRow(key: string) {
    const row = pending.get(key);
    if (!row) return;
    setSaving(key);
    const res = await fetch(`/api/${companyId}/clients/${clientId}/sub-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: activeEstimate?.id ?? null,
        divisionId: row.divisionId,
        itemId: row.itemId,
        label: row.label,
        subContractorId: row.subId || null,
        subName: row.subName || null,
        cost: row.cost ? parseFloat(row.cost) : null,
        salePrice: row.salePrice ? parseFloat(row.salePrice) : null,
      }),
    });
    setSaving(null);
    if (!res.ok) return;
    const a = await res.json();
    setAssignments(prev => [...prev, {
      id: a.id,
      divisionId: a.divisionId,
      itemId: a.itemId,
      label: a.label,
      subContractorId: a.subContractorId,
      subName: a.subName,
      cost: a.cost != null ? Number(a.cost) : null,
      salePrice: a.salePrice != null ? Number(a.salePrice) : null,
      notes: a.notes,
    }]);
    setChecked(prev => { const n = new Set(prev); n.delete(key); return n; });
    setPending(prev => { const m = new Map(prev); m.delete(key); return m; });
  }

  async function deleteAssignment(id: string) {
    setDeleting(id);
    await fetch(`/api/${companyId}/clients/${clientId}/sub-assignments/${id}`, { method: "DELETE" });
    setAssignments(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
  }

  function openEdit(a: Assignment) {
    setEditingId(a.id);
    setEditForm({
      subId: a.subContractorId ?? "",
      subName: a.subName ?? "",
      cost: a.cost != null ? String(a.cost) : "",
      salePrice: a.salePrice != null ? String(a.salePrice) : "",
    });
  }

  async function saveEdit(id: string) {
    setSaving(id);
    const res = await fetch(`/api/${companyId}/clients/${clientId}/sub-assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subContractorId: editForm.subId || null,
        subName: editForm.subName || null,
        cost: editForm.cost ? parseFloat(editForm.cost) : null,
        salePrice: editForm.salePrice ? parseFloat(editForm.salePrice) : null,
      }),
    });
    setSaving(null);
    if (!res.ok) return;
    const a = await res.json();
    setAssignments(prev => prev.map(x => x.id === id ? {
      ...x,
      subContractorId: a.subContractorId,
      subName: a.subName,
      cost: a.cost != null ? Number(a.cost) : null,
      salePrice: a.salePrice != null ? Number(a.salePrice) : null,
    } : x));
    setEditingId(null);
  }

  const totalCost = assignments.reduce((s, a) => s + (a.cost ?? 0), 0);
  const totalSale = assignments.reduce((s, a) => s + (a.salePrice ?? 0), 0);
  const totalProfit = totalSale - totalCost;

  function SubSelect({ value, onChange, onAddNew }: { value: string; onChange: (id: string, name: string) => void; onAddNew: () => void }) {
    return (
      <select
        value={value}
        onChange={e => {
          const id = e.target.value;
          if (id === "__new__") { onAddNew(); return; }
          const sub = subs.find(s => s.id === id);
          onChange(id, sub?.name ?? "");
        }}
        style={{ ...INPUT, minWidth: 160 }}
      >
        <option value="">— Pick Sub —</option>
        {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        <option value="__new__">+ Add new sub…</option>
      </select>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Totals bar */}
      {assignments.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          {[
            { label: "Total Sub Cost", value: totalCost, color: "#f87171" },
            { label: "Total Sale", value: totalSale, color: "#22c55e" },
            { label: "Profit", value: totalProfit, color: totalProfit >= 0 ? "#C9A84C" : "#f87171" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl px-4 py-3 flex flex-col gap-0.5"
              style={{ background: "#161b22", border: "1px solid #30373f", minWidth: 140 }}>
              <div className="text-xs" style={{ color: "#666" }}>{label}</div>
              <div className="font-bold text-base" style={{ color }}>{$(value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Saved assignments table */}
      {assignments.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0d1117", color: "#555" }}>
                {["Scope", "Sub", "Cost", "Sale Price", "Profit", ""].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => {
                const profit = (a.salePrice ?? 0) - (a.cost ?? 0);
                return (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? "#161b22" : "#111519", borderTop: "1px solid #21262d" }}>
                    {editingId === a.id ? (
                      <>
                        <td className="px-3 py-2 text-xs" style={{ color: "#e6edf3" }}>{a.label}</td>
                        <td className="px-3 py-2">
                          <SubSelect
                            value={editForm.subId}
                            onChange={(id, name) => setEditForm(f => ({ ...f, subId: id, subName: name }))}
                            onAddNew={() => { setNewSubTarget(null); setShowNewSub(true); }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" placeholder="0" value={editForm.cost}
                            onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))}
                            style={{ ...INPUT, width: 90 }} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" placeholder="0" value={editForm.salePrice}
                            onChange={e => setEditForm(f => ({ ...f, salePrice: e.target.value }))}
                            style={{ ...INPUT, width: 90 }} />
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold" style={{ color: "#888" }}>—</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(a.id)} disabled={saving === a.id}
                              className="px-2 py-1 rounded text-xs font-semibold"
                              style={{ background: "#C9A84C", color: "#0d1117" }}>
                              {saving === a.id ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: "#1e2736", color: "#888" }}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-xs font-medium" style={{ color: "#e6edf3" }}>{a.label}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "#8b949e" }}>{a.subName ?? "—"}</td>
                        <td className="px-3 py-2 text-xs font-medium" style={{ color: "#f87171" }}>{a.cost != null ? $(a.cost) : "—"}</td>
                        <td className="px-3 py-2 text-xs font-medium" style={{ color: "#22c55e" }}>{a.salePrice != null ? $(a.salePrice) : "—"}</td>
                        <td className="px-3 py-2 text-xs font-bold"
                          style={{ color: profit > 0 ? "#C9A84C" : profit < 0 ? "#f87171" : "#555" }}>
                          {a.cost != null || a.salePrice != null ? $(profit) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(a)}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C44" }}>
                              Edit
                            </button>
                            <button onClick={() => deleteAssignment(a.id)} disabled={deleting === a.id}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: "#2d1a1a", color: "#f87171", border: "1px solid #f8717133" }}>
                              {deleting === a.id ? "…" : "✕"}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Estimate tree */}
      {activeEstimate ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#555" }}>
            Assign from: {activeEstimate.name}
          </div>

          {activeEstimate.divisions.map(div => {
            const divKey = div.id;
            const divAssigned = assignedKeys.has(divKey);
            const divChecked = checked.has(divKey);
            const divPending = pending.get(divKey);

            return (
              <div key={div.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
                {/* Division row */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ background: "#161b22" }}
                >
                  <input
                    type="checkbox"
                    checked={divChecked || divAssigned}
                    disabled={divAssigned}
                    onChange={() => toggle(divKey, `${div.csiCode ? div.csiCode + " – " : ""}${div.name}`, div.id, null)}
                    className="w-4 h-4 cursor-pointer accent-[#C9A84C]"
                  />
                  <span className="font-semibold text-sm" style={{ color: "#e6edf3" }}>
                    {div.csiCode && <span style={{ color: "#555", marginRight: 6 }}>{div.csiCode}</span>}
                    {div.name}
                  </span>
                  {divAssigned && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#C9A84C22", color: "#C9A84C" }}>Assigned</span>}
                </div>

                {/* Inline form when division checked */}
                {divChecked && divPending && (
                  <div className="px-4 py-3 flex flex-wrap gap-3 items-end" style={{ background: "#0d1117", borderTop: "1px solid #21262d" }}>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs" style={{ color: "#555" }}>Sub</label>
                      <SubSelect
                        value={divPending.subId}
                        onChange={(id, name) => updatePending(divKey, { subId: id, subName: name })}
                        onAddNew={() => { setNewSubTarget(divKey); setShowNewSub(true); }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs" style={{ color: "#555" }}>Cost ($)</label>
                      <input type="number" placeholder="0" value={divPending.cost}
                        onChange={e => updatePending(divKey, { cost: e.target.value })}
                        style={{ ...INPUT, width: 100 }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs" style={{ color: "#555" }}>Sale Price ($)</label>
                      <input type="number" placeholder="0" value={divPending.salePrice}
                        onChange={e => updatePending(divKey, { salePrice: e.target.value })}
                        style={{ ...INPUT, width: 100 }} />
                    </div>
                    {divPending.cost && divPending.salePrice && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs" style={{ color: "#555" }}>Profit</label>
                        <div className="text-sm font-bold px-3 py-1.5"
                          style={{ color: (parseFloat(divPending.salePrice) - parseFloat(divPending.cost)) >= 0 ? "#C9A84C" : "#f87171" }}>
                          {$(parseFloat(divPending.salePrice) - parseFloat(divPending.cost))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => saveRow(divKey)} disabled={saving === divKey}
                      className="px-4 py-2 rounded-lg text-sm font-semibold self-end"
                      style={{ background: "#C9A84C", color: "#0d1117", opacity: saving === divKey ? 0.6 : 1 }}>
                      {saving === divKey ? "Saving…" : "Assign"}
                    </button>
                    <button onClick={() => toggle(divKey, "", div.id, null)}
                      className="px-3 py-2 rounded-lg text-sm self-end"
                      style={{ background: "#1e2736", color: "#888" }}>
                      Cancel
                    </button>
                  </div>
                )}

                {/* Items */}
                {div.items.length > 0 && (
                  <div style={{ borderTop: "1px solid #21262d" }}>
                    {div.items.map(item => {
                      const itemKey = `item:${item.id}`;
                      const itemAssigned = assignedKeys.has(itemKey);
                      const itemChecked = checked.has(itemKey);
                      const itemPending = pending.get(itemKey);
                      return (
                        <div key={item.id}>
                          <div className="flex items-center gap-3 pl-10 pr-4 py-2"
                            style={{ background: "#111519", borderTop: "1px solid #1c2128" }}>
                            <input
                              type="checkbox"
                              checked={itemChecked || itemAssigned}
                              disabled={itemAssigned}
                              onChange={() => toggle(itemKey, item.name, null, item.id)}
                              className="w-3.5 h-3.5 cursor-pointer accent-[#C9A84C]"
                            />
                            <span className="text-xs" style={{ color: itemAssigned ? "#C9A84C" : "#8b949e" }}>{item.name}</span>
                            {item.groupName && <span className="text-xs" style={{ color: "#444" }}>({item.groupName})</span>}
                            {itemAssigned && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#C9A84C22", color: "#C9A84C" }}>✓</span>}
                          </div>
                          {itemChecked && itemPending && (
                            <div className="pl-10 pr-4 py-3 flex flex-wrap gap-3 items-end"
                              style={{ background: "#0a0e13", borderTop: "1px solid #1c2128" }}>
                              <div className="flex flex-col gap-1">
                                <label className="text-xs" style={{ color: "#555" }}>Sub</label>
                                <SubSelect
                                  value={itemPending.subId}
                                  onChange={(id, name) => updatePending(itemKey, { subId: id, subName: name })}
                                  onAddNew={() => { setNewSubTarget(itemKey); setShowNewSub(true); }}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-xs" style={{ color: "#555" }}>Cost ($)</label>
                                <input type="number" placeholder="0" value={itemPending.cost}
                                  onChange={e => updatePending(itemKey, { cost: e.target.value })}
                                  style={{ ...INPUT, width: 100 }} />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-xs" style={{ color: "#555" }}>Sale Price ($)</label>
                                <input type="number" placeholder="0" value={itemPending.salePrice}
                                  onChange={e => updatePending(itemKey, { salePrice: e.target.value })}
                                  style={{ ...INPUT, width: 100 }} />
                              </div>
                              {itemPending.cost && itemPending.salePrice && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs" style={{ color: "#555" }}>Profit</label>
                                  <div className="text-sm font-bold px-3 py-1.5"
                                    style={{ color: (parseFloat(itemPending.salePrice) - parseFloat(itemPending.cost)) >= 0 ? "#C9A84C" : "#f87171" }}>
                                    {$(parseFloat(itemPending.salePrice) - parseFloat(itemPending.cost))}
                                  </div>
                                </div>
                              )}
                              <button onClick={() => saveRow(itemKey)} disabled={saving === itemKey}
                                className="px-4 py-2 rounded-lg text-xs font-semibold self-end"
                                style={{ background: "#C9A84C", color: "#0d1117", opacity: saving === itemKey ? 0.6 : 1 }}>
                                {saving === itemKey ? "Saving…" : "Assign"}
                              </button>
                              <button onClick={() => toggle(itemKey, "", null, item.id)}
                                className="px-3 py-2 rounded-lg text-xs self-end"
                                style={{ background: "#1e2736", color: "#888" }}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl p-10 text-center" style={{ background: "#161b22", border: "1px solid #30373f" }}>
          <p className="text-sm" style={{ color: "#888" }}>No estimate found for this client. Create an estimate first.</p>
        </div>
      )}

      {showNewSub && (
        <NewSubModal
          companyId={companyId}
          onCreated={sub => {
            setSubs(prev => [...prev, sub]);
            if (newSubTarget) {
              updatePending(newSubTarget, { subId: sub.id, subName: sub.name });
            }
          }}
          onClose={() => { setShowNewSub(false); setNewSubTarget(null); }}
        />
      )}
    </div>
  );
}
