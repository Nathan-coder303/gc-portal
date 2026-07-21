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

// True when the raw text is a formula (leading "=", a leading paren, or an
// arithmetic operator between two numbers) rather than a plain number.
function looksLikeFormula(raw: string): boolean {
  const c = raw.replace(/,/g, "").trim();
  return c.startsWith("=") || /^\(/.test(c) || /\d\s*[\+\-\*\/]\s*\d/.test(c);
}

function parseRaw(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned.startsWith("=")) return evalFormula(cleaned);
  // If it contains an arithmetic operator (not as a leading sign), evaluate as a formula
  // e.g. "100+50", "100 - 25 * 2", "(10+5)*2"
  if (/\d\s*[\+\-\*\/]\s*\d/.test(cleaned) || /^\(/.test(cleaned)) {
    const evaluated = evalFormula(cleaned);
    if (evaluated != null) return evaluated;
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function fxKey(storageKey: string) { return `fx:${storageKey}`; }

interface FormulaInputProps {
  value: number | string;
  onChange: (value: number) => void;
  /** Local-only formula persistence (per browser). */
  storageKey?: string;
  /** Server-side persistence: pair with `scope` so the formula survives across devices. */
  companyId?: string;
  scope?: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  /** Fires with the raw formula text (or null when it's a plain number) on load and edit. */
  onFormulaChange?: (formula: string | null) => void;
}

export function FormulaInput({ value, onChange, storageKey, companyId, scope, className = "", style, placeholder = "0", autoFocus, onKeyDown, disabled, onFormulaChange }: FormulaInputProps) {
  const getStored = () => storageKey && typeof window !== "undefined" ? localStorage.getItem(fxKey(storageKey)) : null;

  const [raw, setRaw] = useState<string>(() => getStored() ?? String(value ?? ""));
  const [focused, setFocused] = useState(false);
  const prevValue = useRef(value);
  const serverLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load server-stored formula on mount (cross-device persistence)
  useEffect(() => {
    if (!companyId || !scope || serverLoaded.current) return;
    serverLoaded.current = true;
    fetch(`/api/${companyId}/formulas?scope=${encodeURIComponent(scope)}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((data: { expression: string } | null) => {
        if (data?.expression && !focused) {
          setRaw(data.expression);
          onFormulaChange?.(data.expression);
          // Mirror to localStorage so subsequent loads on this device are instant
          if (storageKey && typeof window !== "undefined") {
            localStorage.setItem(fxKey(storageKey), data.expression);
          }
        }
      })
      .catch(() => { /* non-fatal */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, scope]);

  // Sync when external value changes (e.g. after save/reload)
  useEffect(() => {
    if (!focused && value !== prevValue.current) {
      prevValue.current = value;
      const stored = getStored();
      setRaw(stored ?? String(value ?? ""));
    }
  });

  const isFormula = looksLikeFormula(raw);
  const computed = parseRaw(raw);
  const displayValue = focused ? raw : (computed != null ? String(computed) : raw);

  function handleFocus() {
    setFocused(true);
    const stored = getStored();
    if (stored) setRaw(stored);
  }

  // Debounced server save — only after a short pause so we don't hammer the API while typing
  function queueServerSave(rawValue: string) {
    if (!companyId || !scope) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (looksLikeFormula(rawValue)) {
        fetch(`/api/${companyId}/formulas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, expression: rawValue }),
        }).catch(() => { /* non-fatal */ });
      } else {
        fetch(`/api/${companyId}/formulas?scope=${encodeURIComponent(scope)}`, { method: "DELETE" })
          .catch(() => { /* non-fatal */ });
      }
    }, 600);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setRaw(v);
    const formula = looksLikeFormula(v);
    if (storageKey && typeof window !== "undefined") {
      if (formula) localStorage.setItem(fxKey(storageKey), v);
      else localStorage.removeItem(fxKey(storageKey));
    }
    queueServerSave(v);
    onFormulaChange?.(formula ? v : null);
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
      // Use full text keyboard on mobile so + - * / and parens are reachable
      inputMode="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      disabled={disabled}
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
