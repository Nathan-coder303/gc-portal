"use client";

import { useState, useRef, useEffect } from "react";

function evalFormula(expr: string): number | null {
  const e = expr.replace(/^=/, "").replace(/,/g, "").trim();
  if (!e) return null;
  if (!/^[\d\s\+\-\*\/\(\)\.]+$/.test(e)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${e})`)();
    if (typeof result === "number" && isFinite(result)) return Math.round(result * 1e10) / 1e10;
    return null;
  } catch { return null; }
}

function parseRaw(raw: string): number | null {
  if (raw.startsWith("=")) return evalFormula(raw);
  const n = parseFloat(raw.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function fxKey(storageKey: string) { return `fx:${storageKey}`; }

interface FormulaInputProps {
  value: number | string;
  onChange: (value: number) => void;
  storageKey?: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}

export function FormulaInput({ value, onChange, storageKey, className = "", style, placeholder = "0" }: FormulaInputProps) {
  const getStored = () => storageKey && typeof window !== "undefined" ? localStorage.getItem(fxKey(storageKey)) : null;

  const [raw, setRaw] = useState<string>(() => getStored() ?? String(value ?? ""));
  const [focused, setFocused] = useState(false);
  const prevValue = useRef(value);

  // Sync when external value changes (e.g. after save/reload)
  useEffect(() => {
    if (!focused && value !== prevValue.current) {
      prevValue.current = value;
      const stored = getStored();
      setRaw(stored ?? String(value ?? ""));
    }
  });

  const isFormula = raw.startsWith("=");
  const computed = parseRaw(raw);
  const displayValue = focused ? raw : (computed != null ? String(computed) : raw);

  function handleFocus() {
    setFocused(true);
    const stored = getStored();
    if (stored) setRaw(stored);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setRaw(v);
    if (storageKey && typeof window !== "undefined") {
      if (v.startsWith("=")) localStorage.setItem(fxKey(storageKey), v);
      else localStorage.removeItem(fxKey(storageKey));
    }
    const num = parseRaw(v);
    if (num != null) onChange(num);
  }

  function handleBlur() {
    setFocused(false);
    const num = parseRaw(raw);
    if (num != null) {
      onChange(num);
      if (!isFormula) setRaw(String(num));
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      style={{
        ...style,
        ...(isFormula && !focused ? { borderColor: "#C9A84C", boxShadow: "0 0 0 1px #C9A84C55" } : {}),
      }}
      placeholder={placeholder}
      title={isFormula && !focused ? `Formula: ${raw}` : undefined}
    />
  );
}
