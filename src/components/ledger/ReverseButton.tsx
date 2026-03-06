"use client";

import { useState } from "react";
import { reverseJournalEntry } from "@/app/[companyId]/[projectId]/ledger/actions";

export default function ReverseButton({
  entryId,
  isReversal,
  alreadyReversed,
}: {
  entryId: string;
  isReversal: boolean;
  alreadyReversed: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (isReversal || alreadyReversed) {
    return (
      <span className="text-xs text-slate-300">
        {isReversal ? "reversal" : "reversed"}
      </span>
    );
  }

  if (done) return <span className="text-xs text-amber-600">Reversed</span>;

  return (
    <span>
      <button
        onClick={async () => {
          if (!confirm("Reverse this entry? A new reversing entry will be created.")) return;
          setLoading(true);
          setError("");
          try {
            await reverseJournalEntry(entryId);
            setDone(true);
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed");
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="text-xs text-amber-600 hover:text-amber-800 hover:underline disabled:opacity-50"
      >
        {loading ? "…" : "Reverse"}
      </button>
      {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
    </span>
  );
}
