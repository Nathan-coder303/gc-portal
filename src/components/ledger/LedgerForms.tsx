"use client";

import { useState } from "react";
import {
  addPartnerContribution,
  addPayExpense,
  addDistribution,
  addJournalEntry,
} from "@/app/[companyId]/[projectId]/ledger/actions";
import PayeeSelect from "@/components/ledger/PayeeSelect";

type Partner = { id: string; name: string };
type Account = { id: string; name: string; type: string };
type Tab = "contribution" | "expense" | "distribution" | "advanced";

const GOLD = "#C9A84C";
const TODAY = new Date().toISOString().split("T")[0];

const inputStyle = {
  background: "#0d1117",
  border: "1px solid #30373f",
  color: "#e6edf3",
} as const;

const labelStyle = { color: "#8b949e" } as const;

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={labelStyle}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-600"
      style={inputStyle}
    />
  );
}

function StyledSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-600"
      style={inputStyle}
    />
  );
}

function FormShell({
  children,
  onSubmit,
  loading,
  success,
  error,
  submitLabel,
}: {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  loading: boolean;
  success: boolean;
  error: string;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {children}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
          style={{ background: GOLD, color: "#0d1117" }}
        >
          {loading ? "Saving..." : submitLabel}
        </button>
        {success && <span className="text-sm font-medium" style={{ color: "#4ade80" }}>Saved!</span>}
        {error && <span className="text-sm" style={{ color: "#f87171" }}>{error}</span>}
      </div>
    </form>
  );
}

export default function LedgerForms({
  projectId,
  partners,
  accounts,
  payees,
}: {
  projectId: string;
  partners: Partner[];
  accounts: Account[];
  payees: string[];
}) {
  const [tab, setTab] = useState<Tab>("contribution");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function wrap(fn: (fd: FormData) => Promise<unknown>) {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      setLoading(true);
      setError("");
      setSuccess(false);
      const fd = new FormData(form);
      fd.set("projectId", projectId);
      try {
        await fn(fd);
        form.reset();
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoading(false);
      }
    };
  }

  const tabs: { key: Tab; label: string; desc: string }[] = [
    { key: "contribution", label: "Partner Contribution", desc: "Dr Cash / Cr Partner Capital" },
    { key: "expense",      label: "Pay Expense",          desc: "Dr Expenses / Cr Cash" },
    { key: "distribution", label: "Distribution",         desc: "Dr Owner Draws / Cr Cash" },
    { key: "advanced",     label: "Manual Entry",         desc: "Any debit / credit" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(""); setSuccess(false); }}
            className="px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors w-full"
            style={
              tab === t.key
                ? { background: GOLD, color: "#0d1117" }
                : { background: "#161b22", color: "#8b949e", border: "1px solid #30373f" }
            }
          >
            {t.label}
            <span className="block text-xs font-normal opacity-70">{t.desc}</span>
          </button>
        ))}
      </div>

      {tab === "contribution" && (
        <FormShell
          onSubmit={wrap(addPartnerContribution)}
          loading={loading}
          success={success}
          error={error}
          submitLabel="Record Contribution"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Partner" required>
              <StyledSelect name="partnerId" required>
                <option value="">— Select —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </StyledSelect>
            </Field>
            <Field label="Date" required>
              <StyledInput type="date" name="date" required defaultValue={TODAY} />
            </Field>
            <Field label="Amount ($)" required>
              <StyledInput type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" />
            </Field>
            <Field label="Method">
              <StyledSelect name="method">
                <option value="">— Select —</option>
                <option value="Wire Transfer">Wire Transfer</option>
                <option value="ACH">ACH</option>
                <option value="Check">Check</option>
                <option value="Cash">Cash</option>
                <option value="Zelle">Zelle</option>
                <option value="Other">Other</option>
              </StyledSelect>
            </Field>
            <Field label="Notes">
              <StyledInput type="text" name="notes" placeholder="Optional" />
            </Field>
          </div>
        </FormShell>
      )}

      {tab === "expense" && (
        <FormShell
          onSubmit={wrap(addPayExpense)}
          loading={loading}
          success={success}
          error={error}
          submitLabel="Record Expense Payment"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date" required>
              <StyledInput type="date" name="date" required defaultValue={TODAY} />
            </Field>
            <Field label="Amount ($)" required>
              <StyledInput type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" />
            </Field>
            <Field label="Description" required>
              <StyledInput type="text" name="description" required placeholder="What was purchased / paid for" />
            </Field>
            <Field label="Reference">
              <StyledInput type="text" name="reference" placeholder="e.g. INV-1234" />
            </Field>
            <Field label="Payment Source / From" required>
              <StyledSelect name="paymentSource" required>
                <option value="">— Select —</option>
                <option value="Chase 8536">Chase 8536</option>
                {partners.map((p) => (
                  <option key={p.id} value={`${p.name}'s Account`}>{p.name}&apos;s Account</option>
                ))}
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="ACH">ACH</option>
                <option value="Wire Transfer">Wire Transfer</option>
                <option value="Zelle">Zelle</option>
                <option value="Other">Other</option>
              </StyledSelect>
            </Field>
            <Field label="Payee / To" required>
              <PayeeSelect
                name="payee"
                required
                initialPayees={payees}
                inputStyle={inputStyle}
              />
            </Field>
          </div>
        </FormShell>
      )}

      {tab === "distribution" && (
        <FormShell
          onSubmit={wrap(addDistribution)}
          loading={loading}
          success={success}
          error={error}
          submitLabel="Record Distribution"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Partner (optional)">
              <StyledSelect name="partnerId">
                <option value="">— All / Unspecified —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </StyledSelect>
            </Field>
            <Field label="Date" required>
              <StyledInput type="date" name="date" required defaultValue={TODAY} />
            </Field>
            <Field label="Amount ($)" required>
              <StyledInput type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" />
            </Field>
            <Field label="Memo" required>
              <StyledInput type="text" name="memo" required placeholder="e.g. Q1 Distribution" />
            </Field>
          </div>
        </FormShell>
      )}

      {tab === "advanced" && (
        <FormShell
          onSubmit={wrap(addJournalEntry)}
          loading={loading}
          success={success}
          error={error}
          submitLabel="Add Entry"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Date" required>
              <StyledInput type="date" name="date" required defaultValue={TODAY} />
            </Field>
            <Field label="Reference">
              <StyledInput type="text" name="reference" placeholder="e.g. JE-006" />
            </Field>
            <Field label="Memo" required>
              <StyledInput type="text" name="memo" required placeholder="Description" />
            </Field>
            <Field label="Debit Account" required>
              <StyledSelect name="debitAccountId" required>
                <option value="">— Select —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </StyledSelect>
            </Field>
            <Field label="Credit Account" required>
              <StyledSelect name="creditAccountId" required>
                <option value="">— Select —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </StyledSelect>
            </Field>
            <Field label="Amount ($)" required>
              <StyledInput type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" />
            </Field>
            <Field label="Partner (optional)">
              <StyledSelect name="partnerId">
                <option value="">— None —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </StyledSelect>
            </Field>
          </div>
          <p className="text-xs mt-1" style={{ color: "#8b949e" }}>Debit and credit amounts must be equal (enforced server-side).</p>
        </FormShell>
      )}
    </div>
  );
}
