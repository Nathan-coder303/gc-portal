"use client";

import { useState } from "react";
import { parseScheduleCsv } from "@/lib/csv/parseSchedule";
import { importScheduleCsv } from "@/app/[companyId]/[projectId]/schedule/actions";
import { format } from "date-fns";

export default function CsvImportSchedule({ projectId }: { projectId: string }) {
  const [preview, setPreview] = useState<ReturnType<typeof parseScheduleCsv> | null>(null);
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
      setPreview(parseScheduleCsv(text, new Date("2026-01-06")));
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
    const res = await importScheduleCsv(fd);
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
              <p className="font-medium text-red-700 mb-2">Validation errors</p>
              <ul className="text-sm text-red-600 space-y-1">
                {preview.errors.map((e, i) => (
                  <li key={i}>Row {e.row} · {e.field}: {e.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">
                  {preview.tasks.length} tasks parsed, no errors
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
                      {["Phase", "Task", "Duration", "Start", "End", "Trade", "Milestone"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.tasks.map((t, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{t.phase}</td>
                        <td className="px-3 py-1.5 font-medium">{t.name}</td>
                        <td className="px-3 py-1.5">{t.durationDays}d</td>
                        <td className="px-3 py-1.5">{format(t.startDate, "MMM d")}</td>
                        <td className="px-3 py-1.5">{t.isMilestone ? "—" : format(t.endDate, "MMM d")}</td>
                        <td className="px-3 py-1.5">{t.trade}</td>
                        <td className="px-3 py-1.5">{t.isMilestone ? "Yes" : "No"}</td>
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
            <p className="text-sm text-green-700 font-medium">{result.imported} tasks imported successfully!</p>
          ) : (
            <div>
              <p className="text-sm text-red-700 font-medium mb-2">Import failed</p>
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
