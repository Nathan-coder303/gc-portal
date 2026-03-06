"use client";

import { useRef, useState } from "react";
import {
  addPartnerContribution,
  addPayExpense,
  addDistribution,
  addJournalEntry,
} from "@/app/[companyId]/[projectId]/ledger/actions";

type Partner = { id: string; name: string };
type Account = { id: string; name: string; type: string };

type Tab = "contribution" | "expense" | "distribution" | "advanced";

const TODAY = new Date().toISOString().split("T")[0];

function FormShell({
  children,
  onSubmit,
  loading,
  success,
  error,
  submitLabel,
  submitColor = "bg-blue-600 hover:bg-blue-700",
}: {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  loading: boolean;
  success: boolean;
  error: string;
  submitLabel: string;
  submitColor?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {children}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-white text-sm rounded-lg font-medium disabled:opacity-50 ${submitColor}`}
        >
          {loading ? "Saving..." : submitLabel}
        </button>
        {success && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

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
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function LedgerForms({
  projectId,
  partners,
  accounts,
}: {
  projectId: string;
  partners: Partner[];
  accounts: Account[];
}) {
  const [tab, setTab] = useState<Tab>("contribution");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function wrap(fn: (fd: FormData) => Promise<unknown>) {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      setError("");
      setSuccess(false);
      const fd = new FormData(e.currentTarget);
      fd.set("projectId", projectId);
      try {
        await fn(fd);
        (e.currentTarget as HTMLFormElement).reset();
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
      <div className="flex gap-1 mb-5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(""); setSuccess(false); }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
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
          submitColor="bg-green-600 hover:bg-green-700"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Partner" required>
              <select name="partnerId" required className={inputCls}>
                <option value="">— Select —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Date" required>
              <input type="date" name="date" required defaultValue={TODAY} className={inputCls} />
            </Field>
            <Field label="Amount ($)" required>
              <input type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Notes">
              <input type="text" name="notes" placeholder="Optional" className={inputCls} />
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <input type="date" name="date" required defaultValue={TODAY} className={inputCls} />
            </Field>
            <Field label="Reference">
              <input type="text" name="reference" placeholder="e.g. INV-1234" className={inputCls} />
            </Field>
            <Field label="Memo" required>
              <input type="text" name="memo" required placeholder="Description" className={`${inputCls} col-span-2`} />
            </Field>
            <Field label="Amount ($)" required>
              <input type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" className={inputCls} />
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
          submitColor="bg-amber-600 hover:bg-amber-700"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Partner (optional)">
              <select name="partnerId" className={inputCls}>
                <option value="">— All / Unspecified —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Date" required>
              <input type="date" name="date" required defaultValue={TODAY} className={inputCls} />
            </Field>
            <Field label="Amount ($)" required>
              <input type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Memo" required>
              <input type="text" name="memo" required placeholder="e.g. Q1 Distribution" className={inputCls} />
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Date" required>
              <input type="date" name="date" required defaultValue={TODAY} className={inputCls} />
            </Field>
            <Field label="Reference">
              <input type="text" name="reference" placeholder="e.g. JE-006" className={inputCls} />
            </Field>
            <Field label="Memo" required>
              <input type="text" name="memo" required placeholder="Description" className={inputCls} />
            </Field>
            <Field label="Debit Account" required>
              <select name="debitAccountId" required className={inputCls}>
                <option value="">— Select —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Credit Account" required>
              <select name="creditAccountId" required className={inputCls}>
                <option value="">— Select —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Amount ($)" required>
              <input type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="Partner (optional)">
              <select name="partnerId" className={inputCls}>
                <option value="">— None —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-slate-400">Debit and credit amounts must be equal (enforced server-side).</p>
        </FormShell>
      )}
    </div>
  );
}
