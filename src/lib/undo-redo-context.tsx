"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type UndoAction = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

interface UndoRedoCtx {
  pushUndo: (action: UndoAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

const UndoRedoContext = createContext<UndoRedoCtx | null>(null);

export function useUndoRedo() {
  const ctx = useContext(UndoRedoContext);
  if (!ctx) throw new Error("useUndoRedo must be inside UndoRedoProvider");
  return ctx;
}

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(async () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const action = prev[prev.length - 1];
      action.undo().then(() => {
        setRedoStack(r => [...r, action]);
      });
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(async () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const action = prev[prev.length - 1];
      action.redo().then(() => {
        setUndoStack(u => [...u, action]);
      });
      return prev.slice(0, -1);
    });
  }, []);

  return (
    <UndoRedoContext.Provider value={{
      pushUndo, undo, redo,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
      redoLabel: redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null,
    }}>
      {children}
    </UndoRedoContext.Provider>
  );
}
