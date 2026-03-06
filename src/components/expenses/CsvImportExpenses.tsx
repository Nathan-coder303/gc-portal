"use client";

import { useState } from "react";
import { parseExpensesCsv } from "@/lib/csv/parseExpenses";
import { importExpensesCsv } from "@/app/[companyId]/[projectId]/expenses/actions";

export default function CsvImportExpenses({ projectId }: { projectId: string }) {
  const [preview, setPreview] = useState<ReturnType<typeof parseExpensesCsv> | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: { row: number; field: string; message: string }[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
      setPreview(parseExpensesCsv(text));
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText) return;
    setImporting(true);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("csv", csvText);
    const res = await importExpensesCsv(fd);
    setResult({ imported: res.imported, errors: res.errors });
    setImporting(false);
    if (res.success) {
      setPreview(null);
      setCsvText("");
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
      />

      {preview && (
        <div className="mt-4">
          {preview.errors.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-medium text-red-700 mb-2">Validation errors ({preview.errors.length})</p>
              <ul className="text-sm text-red-600 space-y-1">
                {preview.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>Row {e.row} · {e.field}: {e.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">
                  {preview.rows.length} rows parsed, no errors
                </span>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {importing ? "Importing..." : "Confirm Import"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Date", "Vendor", "Description", "Cost Code", "Category", "Amount", "Payment", "Paid By"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{r.date}</td>
                        <td className="px-3 py-1.5">{r.vendor}</td>
                        <td className="px-3 py-1.5 max-w-xs truncate">{r.description}</td>
                        <td className="px-3 py-1.5">{r.costCode}</td>
                        <td className="px-3 py-1.5">{r.category}</td>
                        <td className="px-3 py-1.5 font-mono">${r.amount.toFixed(2)}</td>
                        <td className="px-3 py-1.5">{r.paymentMethod}</td>
                        <td className="px-3 py-1.5">{r.paidBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className={`mt-4 p-4 rounded-lg border ${result.errors.length === 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          {result.errors.length === 0 ? (
            <p className="text-sm text-green-700 font-medium">{result.imported} expenses imported successfully!</p>
          ) : (
            <div>
              <p className="text-sm text-red-700 font-medium mb-2">Import failed ({result.errors.length} errors)</p>
              <ul className="text-xs text-red-600 space-y-1">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>Row {e.row} · {e.field}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
