"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

type Settings = {
  name: string;
  address: string;
  phone: string;
  email: string;
  licenses: string;
  tagline: string;
  website: string;
  contactName: string;
  logoUrl: string | null;
};

const EMPTY: Settings = { name: "", address: "", phone: "", email: "", licenses: "", tagline: "", website: "", contactName: "", logoUrl: null };

export default function CompanySettingsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [form, setForm] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/${companyId}/settings`)
      .then(r => r.json())
      .then((d: Settings) => {
        setForm({
          name: d.name ?? "",
          address: d.address ?? "",
          phone: d.phone ?? "",
          email: d.email ?? "",
          licenses: d.licenses ?? "",
          tagline: d.tagline ?? "",
          website: d.website ?? "",
          contactName: d.contactName ?? "",
          logoUrl: d.logoUrl ?? null,
        });
        setLogoPreview(d.logoUrl ?? null);
        setLoading(false);
      });
  }, [companyId]);

  async function handleSave() {
    setSaving(true);
    const { logoUrl: _logoUrl, ...rest } = form;
    await fetch(`/api/${companyId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/${companyId}/settings`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.logoUrl) {
      setLogoPreview(data.logoUrl);
      setForm(prev => ({ ...prev, logoUrl: data.logoUrl }));
    }
    setLogoUploading(false);
  }

  const field = (label: string, key: keyof Settings, placeholder = "") => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#8b949e" }}>{label}</label>
      <input
        value={(form[key] as string) ?? ""}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", outline: "none" }}
      />
    </div>
  );

  if (loading) return <div className="p-8 text-sm" style={{ color: "#8b949e" }}>Loading…</div>;

  return (
    <div className="max-w-xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-lg font-bold" style={{ color: "#e6edf3" }}>Company Settings</h1>

      {/* Logo */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8b949e" }}>Logo</label>
        <div className="flex items-center gap-4">
          <div className="rounded-xl overflow-hidden flex items-center justify-center"
            style={{ width: 80, height: 80, background: "#0d1117", border: "1px solid #30373f" }}>
            {logoPreview
              ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ color: "#484f58", fontSize: 28 }}>🏢</span>}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#1e2736", border: "1px solid #C9A84C55", color: "#C9A84C" }}>
              {logoUploading ? "Uploading…" : "Upload Logo"}
            </button>
            <p className="text-[11px]" style={{ color: "#484f58" }}>PNG or JPG, square recommended</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {field("Company Name", "name", "MIBH Construction")}
        {field("Address", "address", "2950 N 28 Terr, Hollywood, FL 33020")}
        {field("Phone", "phone", "305-746-7307")}
        {field("Email", "email", "mike@mibhconstruction.com")}
        {field("Website", "website", "mibhconstruction.com")}
        {field("License Numbers", "licenses", "CGC1527069 | CCC1336817")}
        {field("Contact Name (PDF footer & signature)", "contactName", "Mike Baruh")}
        {field("Tagline (PDF cover page)", "tagline", "20 YEARS OF EXCELLENCE")}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl text-sm font-bold"
        style={{ background: saved ? "#166534" : "#C9A84C", color: saved ? "#bbf7d0" : "#0d1117" }}>
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
      </button>
    </div>
  );
}
