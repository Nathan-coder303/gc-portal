"use client";

import { useUndoRedo } from "@/lib/undo-redo-context";

export default function UndoRedoBar() {
  const { undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useUndoRedo();

  const btnStyle = (active: boolean) => ({
    background: active ? "#C9A84C22" : "transparent",
    color: active ? "#C9A84C" : "#30373f",
    border: `1px solid ${active ? "#C9A84C55" : "#30373f"}`,
    cursor: active ? "pointer" : "not-allowed",
  });

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={undo}
        disabled={!canUndo}
        title={undoLabel ? `Undo: ${undoLabel}` : "Nothing to undo"}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
        style={btnStyle(canUndo)}
      >
        ←
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title={redoLabel ? `Redo: ${redoLabel}` : "Nothing to redo"}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all"
        style={btnStyle(canRedo)}
      >
        →
      </button>
    </div>
  );
}
