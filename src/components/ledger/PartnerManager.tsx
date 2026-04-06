"use client";

import { useState } from "react";
import { createPartner, updatePartner, archivePartner, archiveAllPartners, createPartnerPortalAccess } from "@/app/[companyId]/[projectId]/ledger/actions";
import { TrashIcon, PencilIcon } from "@/components/ui/icons";

type Partner = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  ownershipPct: number | null;
};

const GOLD = "#C9A84C";
const CARD = { background: "#0d1117", border: "1px solid #30373f" };

const inputStyle = {
  background: "#1e2736",
  border: "1px solid #30373f",
  color: "#e6edf3",
};

function PartnerFormFields({ defaults }: { defaults?: Partner }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <div>
        <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Name *</label>
        <input type="text" name="name" required defaultValue={defaults?.name ?? ""}
          placeholder="Full name"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email</label>
        <input type="email" name="email" defaultValue={defaults?.email ?? ""}
          placeholder="partner@email.com"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Role / Title</label>
        <input type="text" name="role" defaultValue={defaults?.role ?? ""}
          placeholder="e.g. Managing Partner"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Ownership %</label>
        <input type="number" name="ownershipPct" min="0" max="100" step="0.01"
          defaultValue={defaults?.ownershipPct ?? ""}
          placeholder="e.g. 40"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle} />
      </div>
    </div>
  );
}

/** Inline add form — rendered in the page header area */
export function AddPartnerInline({ onAdded }: { onAdded: (p: Partner) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await createPartner(fd);
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      // Refresh to get new partner with id
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg"
          style={{ background: GOLD, color: "#0d1117" }}
        >
          + Add Partner
        </button>
      ) : (
        <div className="mt-4 rounded-xl p-4" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
          <p className="text-xs font-semibold mb-3" style={{ color: GOLD }}>New Partner</p>
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "#2d1b1b", border: "1px solid #6b2a2a", color: "#f87171" }}>
              {error}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <PartnerFormFields />
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={loading}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ background: GOLD, color: "#0d1117" }}>
                {loading ? "Adding..." : "Add Partner"}
              </button>
              <button type="button" onClick={() => { setOpen(false); setError(""); }}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ background: "#30373f", color: "#8b949e" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function PartnerManager({
  partners: initialPartners,
  projectId,
}: {
  partners: Partner[];
  projectId: string;
}) {
  const [partners, setPartners] = useState(initialPartners);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await updatePartner(fd);
      const id = fd.get("id") as string;
      setPartners((prev) => prev.map((p) =>
        p.id === id ? {
          ...p,
          name: fd.get("name") as string,
          email: (fd.get("email") as string) || null,
          role: (fd.get("role") as string) || null,
          ownershipPct: fd.get("ownershipPct") ? parseFloat(fd.get("ownershipPct") as string) : null,
        } : p
      ));
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(id: string) {
    setArchiving(id);
    try {
      await archivePartner(id);
      setPartners((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setArchiving(null);
    }
  }

  async function handleResetAll() {
    setResetting(true);
    try {
      const result = await archiveAllPartners();
      setPartners([]);
      setSuccess(`Removed ${result.count} partner${result.count !== 1 ? "s" : ""}.`);
      setConfirmReset(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setResetting(false);
    }
  }

  async function handleGrantAccess(partner: Partner) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await createPartnerPortalAccess({
        partnerId: partner.id,
        projectId,
        email: accessEmail,
        password: accessPassword,
      });
      setSuccess(`Portal access created for ${partner.name}. They can now log in.`);
      setGrantingId(null);
      setAccessEmail("");
      setAccessPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create access");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base" style={{ color: "#e6edf3" }}>Partners</h2>
        {partners.length > 0 && !confirmReset && (
          <button
            onClick={() => setConfirmReset(true)}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ color: "#f85149", border: "1px solid #f8514933", background: "#f8514911" }}
          >
            Reset All
          </button>
        )}
        {confirmReset && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#f87171" }}>Remove all partners?</span>
            <button onClick={handleResetAll} disabled={resetting}
              className="text-xs px-2 py-1 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: "#f85149", color: "#fff" }}>
              {resetting ? "..." : "Yes, reset"}
            </button>
            <button onClick={() => setConfirmReset(false)}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: "#30373f", color: "#8b949e" }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "#2d1b1b", border: "1px solid #6b2a2a", color: "#f87171" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "#0d2a1a", border: "1px solid #166534", color: "#4ade80" }}>
          {success}
        </div>
      )}

      {partners.length === 0 ? (
        <p className="text-sm" style={{ color: "#8b949e" }}>No partners yet. Use &ldquo;+ Add Partner&rdquo; above to add one.</p>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => (
            <div key={p.id}>
              {editing?.id === p.id ? (
                <form onSubmit={handleSave} className="rounded-xl p-4" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: GOLD }}>Edit {p.name}</p>
                  <PartnerFormFields defaults={editing} />
                  <div className="flex gap-2 mt-3">
                    <button type="submit" disabled={loading}
                      className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                      style={{ background: GOLD, color: "#0d1117" }}>
                      {loading ? "Saving..." : "Save"}
                    </button>
                    <button type="button" onClick={() => { setEditing(null); setError(""); }}
                      className="px-4 py-2 text-sm rounded-lg"
                      style={{ background: "#30373f", color: "#8b949e" }}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-xl p-4" style={CARD}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "#e6edf3" }}>{p.name}</div>
                      <div className="text-xs mt-0.5 space-x-3" style={{ color: "#8b949e" }}>
                        {p.role && <span>{p.role}</span>}
                        {p.ownershipPct != null && <span>{p.ownershipPct}% ownership</span>}
                        {p.email && <span>{p.email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => { setGrantingId(grantingId === p.id ? null : p.id); setError(""); setSuccess(""); setAccessEmail(p.email ?? ""); setAccessPassword(""); }}
                        className="text-xs font-semibold px-2 py-1 rounded-lg"
                        style={{ background: "#C9A84C22", color: GOLD, border: "1px solid #C9A84C44" }}>
                        🔑 Portal Access
                      </button>
                      <button onClick={() => { setEditing(p); setError(""); setSuccess(""); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                        title="Edit">
                        <PencilIcon size={13} />
                      </button>
                      <button onClick={() => handleArchive(p.id)}
                        disabled={archiving === p.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                        style={{ background: "#f8514922", color: "#f85149", border: "1px solid #f8514933" }}
                        title="Remove">
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  </div>

                  {grantingId === p.id && (
                    <div className="mt-3 pt-3 rounded-lg p-3" style={{ background: "#1e2736", border: `1px solid ${GOLD}44` }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: GOLD }}>
                        Create portal login for {p.name}
                      </p>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Email</label>
                          <input type="email" value={accessEmail}
                            onChange={(e) => setAccessEmail(e.target.value)}
                            placeholder="partner@email.com"
                            className="w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                            style={inputStyle} />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "#8b949e" }}>Password</label>
                          <input type="password" value={accessPassword}
                            onChange={(e) => setAccessPassword(e.target.value)}
                            placeholder="Min 8 characters"
                            className="w-full rounded px-2 py-1.5 text-sm focus:outline-none"
                            style={inputStyle} />
                        </div>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "#8b949e" }}>
                        They will only see <strong style={{ color: "#e6edf3" }}>Ledger</strong> + <strong style={{ color: "#e6edf3" }}>Schedule</strong> for this project.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => handleGrantAccess(p)}
                          disabled={loading || !accessEmail || accessPassword.length < 8}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                          style={{ background: GOLD, color: "#0d1117" }}>
                          {loading ? "Creating..." : "Create Access"}
                        </button>
                        <button onClick={() => setGrantingId(null)}
                          className="px-3 py-1.5 text-xs rounded-lg"
                          style={{ background: "#30373f", color: "#8b949e" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
