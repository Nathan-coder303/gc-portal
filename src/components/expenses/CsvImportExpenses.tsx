"use client";

import { useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { importExpensesCsv } from "@/app/[companyId]/[projectId]/expenses/actions";

const EXPECTED_FIELDS = [
  { key: "date", label: "Date", required: true },
  { key: "vendor", label: "Vendor", required: true },
  { key: "description", label: "Description", required: true },
  { key: "category", label: "Category", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "paymentMethod", label: "Payment Method", required: true },
  { key: "paidBy", label: "Paid By", required: true },
  { key: "costCode", label: "Cost Code", required: false },
  { key: "tax", label: "Tax", required: false },
  { key: "receiptUrl", label: "Receipt URL", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

type FieldKey = typeof EXPECTED_FIELDS[number]["key"];

type ParsedRow = Record<string, string>;

const RowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  vendor: z.string().min(1, "Required"),
  description: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  amount: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Must be a number ≥ 0"),
  paymentMethod: z.string().min(1, "Required"),
  paidBy: z.string().min(1, "Required"),
  costCode: z.string().optional(),
  tax: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

type StepType = "upload" | "map" | "preview" | "done";

export default function CsvImportExpenses({ projectId }: { projectId: string }) {
  const [step, setStep] = useState<StepType>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [validRows, setValidRows] = useState<z.infer<typeof RowSchema>[]>([]);
  const [rowErrors, setRowErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; rowErrors: { row: number; message: string }[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields ?? [];
        setCsvHeaders(headers);
        setRawRows(results.data);

        // Auto-map by common aliases
        const aliases: Record<FieldKey, string[]> = {
          date: ["date","Date","transaction_date","exp_date"],
          vendor: ["vendor","Vendor","supplier","payee","merchant"],
          description: ["description","Description","desc","memo","notes"],
          category: ["category","Category","type","expense_type"],
          amount: ["amount","Amount","total","cost","net"],
          paymentMethod: ["payment_method","Payment Method","method","payment","pay_method"],
          paidBy: ["paid_by","Paid By","payer","paid by","paid_by_name"],
          costCode: ["cost_code","Cost Code","code","cc"],
          tax: ["tax","Tax","tax_amount","gst","vat"],
          receiptUrl: ["receipt_url","Receipt URL","receipt","attachment"],
          notes: ["notes","Notes","comment","comments","remarks"],
        };
        const autoMap: Partial<Record<FieldKey, string>> = {};
        for (const [field, aliasList] of Object.entries(aliases)) {
          const match = headers.find(h => aliasList.includes(h) || aliasList.includes(h.toLowerCase()));
          if (match) autoMap[field as FieldKey] = match;
        }
        setMapping(autoMap as Record<FieldKey, string>);
        setStep("map");
      },
    });
  }

  function applyMapping() {
    const errors: { row: number; field: string; message: string }[] = [];
    const valid: z.infer<typeof RowSchema>[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const mapped: Record<string, string> = {};
      for (const f of EXPECTED_FIELDS) {
        const col = mapping[f.key];
        mapped[f.key] = col ? (raw[col] ?? "").trim() : "";
      }

      const result = RowSchema.safeParse(mapped);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({ row: i + 2, field: String(issue.path[0] ?? "unknown"), message: issue.message });
        }
      } else {
        valid.push(result.data);
      }
    }

    setValidRows(valid);
    setRowErrors(errors);
    setStep("preview");
  }

  async function handleImport() {
    setImporting(true);
    const rows = validRows.map(r => ({
      date: r.date,
      vendor: r.vendor,
      description: r.description,
      costCode: r.costCode ?? "",
      category: r.category,
      amount: parseFloat(r.amount),
      tax: parseFloat(r.tax ?? "0") || 0,
      paymentMethod: r.paymentMethod,
      paidBy: r.paidBy,
      receiptUrl: r.receiptUrl ?? "",
      notes: r.notes ?? "",
    }));

    const res = await importExpensesCsv(projectId, rows);
    setResult({ imported: res.imported, rowErrors: res.rowErrors });
    setStep("done");
    setImporting(false);
  }

  function reset() {
    setStep("upload");
    setCsvHeaders([]);
    setRawRows([]);
    setMapping({} as Record<FieldKey, string>);
    setValidRows([]);
    setRowErrors([]);
    setResult(null);
  }

  return (
    <div>
      {step === "upload" && (
        <div>
          <input type="file" accept=".csv"
            onChange={handleFile}
            className="block text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
          <p className="text-xs text-slate-400 mt-2">Accepts any CSV — you&apos;ll map columns in the next step</p>
        </div>
      )}

      {step === "map" && (
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Map your CSV columns ({csvHeaders.length} detected) to the required fields:
          </p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {EXPECTED_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600 w-32 shrink-0">
                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                  className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— skip —</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={applyMapping}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
              Preview →
            </button>
            <button onClick={reset}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-sm text-slate-700">
              <span className="font-semibold text-green-700">{validRows.length} valid</span>
              {rowErrors.length > 0 && <span className="ml-3 font-semibold text-red-600">{rowErrors.length} errors</span>}
              <span className="ml-3 text-slate-400">of {rawRows.length} rows</span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setStep("map")}
                className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                ← Remap
              </button>
              {validRows.length > 0 && (
                <button onClick={handleImport} disabled={importing}
                  className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">
                  {importing ? "Importing..." : `Import ${validRows.length} rows`}
                </button>
              )}
            </div>
          </div>

          {rowErrors.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 mb-2">Row errors (these rows will be skipped):</p>
              {rowErrors.map((e, i) => (
                <div key={i} className="text-xs text-red-600">Row {e.row} · {e.field}: {e.message}</div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Date","Vendor","Description","Category","Amount","Tax","Payment","Paid By","Cost Code"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validRows.slice(0, 30).map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-1.5 font-medium">{r.vendor}</td>
                    <td className="px-3 py-1.5 max-w-xs truncate">{r.description}</td>
                    <td className="px-3 py-1.5">{r.category}</td>
                    <td className="px-3 py-1.5 font-mono">${parseFloat(r.amount).toFixed(2)}</td>
                    <td className="px-3 py-1.5 font-mono">${parseFloat(r.tax ?? "0").toFixed(2)}</td>
                    <td className="px-3 py-1.5">{r.paymentMethod}</td>
                    <td className="px-3 py-1.5">{r.paidBy}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-400">{r.costCode ?? "—"}</td>
                  </tr>
                ))}
                {validRows.length > 30 && (
                  <tr><td colSpan={9} className="px-3 py-2 text-xs text-slate-400 text-center">
                    + {validRows.length - 30} more rows
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div>
          <div className={`p-4 rounded-lg border mb-4 ${result.rowErrors.length === 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
            <p className="font-semibold text-slate-800">{result.imported} expenses imported successfully!</p>
            {result.rowErrors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-amber-700">{result.rowErrors.length} rows failed:</p>
                {result.rowErrors.map((e, i) => (
                  <div key={i} className="text-xs text-amber-600">Row {e.row}: {e.message}</div>
                ))}
              </div>
            )}
          </div>
          <button onClick={reset} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
