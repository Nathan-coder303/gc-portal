"use client";

import { useState } from "react";
import { createPayee } from "@/app/[companyId]/[projectId]/ledger/actions";

const GOLD = "#C9A84C";
const STATIC_PAYEES = ["Chase 8536"];

export default function PayeeSelect({
  initialPayees,
  name = "payee",
  required,
  value,
  onChange,
  inputStyle,
}: {
  initialPayees: string[];
  name?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  inputStyle: React.CSSProperties;
}) {
  const [payees, setPayees] = useState<string[]>(
    initialPayees.filter((p) => !STATIC_PAYEES.includes(p))
  );
  const [selected, setSelected] = useState(value ?? "");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  function setVal(v: string) {
    setSelected(v);
    onChange?.(v);
  }

  async function saveNew() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createPayee(newName.trim());
      const n = newName.trim();
      setPayees((prev) => { const all = [...prev, n]; return all.filter((v, i) => all.indexOf(v) === i).sort(); });
      setVal(n);
      setAddingNew(false);
      setNewName("");
    } finally {
      setSaving(false);
    }
  }

  if (addingNew) {
    return (
      <div className="flex gap-2">
        <input type="hidden" name={name} value={newName} />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Type payee name"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveNew(); } }}
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle}
        />
        <button type="button" onClick={saveNew} disabled={saving || !newName.trim()}
          className="px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
          style={{ background: GOLD, color: "#0d1117" }}>
          {saving ? "..." : "Add"}
        </button>
        <button type="button" onClick={() => { setAddingNew(false); setNewName(""); }}
          className="px-3 py-2 text-xs rounded-lg"
          style={{ background: "#30373f", color: "#8b949e" }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <select
      name={name}
      required={required}
      value={selected}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setAddingNew(true);
        } else {
          setVal(e.target.value);
        }
      }}
      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-600"
      style={inputStyle}
    >
      <option value="">— Select —</option>
      {STATIC_PAYEES.map((p) => <option key={p} value={p}>{p}</option>)}
      {payees.map((p) => <option key={p} value={p}>{p}</option>)}
      <option value="__new__">+ Add new payee...</option>
    </select>
  );
}
