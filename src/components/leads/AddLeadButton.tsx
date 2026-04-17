"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddLeadButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "", state: "", zip: "", projectType: "", message: "",
  });
  const router = useRouter();

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function formatPhoneInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ name: "", phone: "", email: "", address: "", city: "", state: "", zip: "", projectType: "", message: "" });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    background: "#0d1117",
    border: "1px solid #30373f",
    color: "#e6edf3",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    width: "100%",
    outline: "none",
  } as React.CSSProperties;

  const labelStyle = { fontSize: 11, color: "#8b949e", fontWeight: 600, display: "block", marginBottom: 4 } as React.CSSProperties;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
        style={{ border: "1px solid #C9A84C66", color: "#C9A84C", background: "transparent" }}
      >
        +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "#161b22", border: "1px solid #30373f" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: "#e6edf3" }}>Add New Lead</h2>
              <button onClick={() => setOpen(false)} style={{ color: "#8b949e", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} placeholder="Full name" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} placeholder="305-000-0000" value={form.phone}
                  onChange={e => set("phone", formatPhoneInput(e.target.value))}
                  type="tel" inputMode="numeric" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} placeholder="email@example.com" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} placeholder="Property address" value={form.address} onChange={e => set("address", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} placeholder="City" value={form.city} onChange={e => set("city", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} placeholder="FL" value={form.state} onChange={e => set("state", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Zip</label>
                  <input style={inputStyle} placeholder="00000" value={form.zip} onChange={e => set("zip", e.target.value)} />
                </div>
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Project Type</label>
                <input style={inputStyle} placeholder="e.g. Flat Roof, Addition, HVAC..." value={form.projectType} onChange={e => set("projectType", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Notes</label>
                <textarea
                  rows={3}
                  style={{ ...inputStyle, resize: "none" }}
                  placeholder="Any additional details..."
                  value={form.message}
                  onChange={e => set("message", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSubmit}
                disabled={!form.name.trim() || saving}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold"
                style={{ background: form.name.trim() ? "#C9A84C" : "#30373f", color: form.name.trim() ? "#0d1117" : "#8b949e" }}
              >
                {saving ? "Saving…" : "Add Lead"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-5 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: "#30373f", color: "#e6edf3" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
