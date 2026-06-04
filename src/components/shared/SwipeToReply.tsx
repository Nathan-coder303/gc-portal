"use client";

import { useRef, useState } from "react";

const THRESHOLD = 60;
const MAX = 90;

export default function SwipeToReply({
  onReply,
  children,
}: {
  onReply: () => void;
  children: React.ReactNode;
}) {
  const [tx, setTx] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const triggered = useRef(false);
  const locked = useRef<"h" | "v" | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    triggered.current = false;
    locked.current = null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (locked.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      } else {
        return;
      }
    }

    if (locked.current !== "h" || dx <= 0) {
      if (tx !== 0) setTx(0);
      return;
    }

    const clamped = Math.min(dx, MAX);
    setTx(clamped);
    if (clamped >= THRESHOLD && !triggered.current) {
      triggered.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.(10); } catch { /* ignore */ }
      }
    }
  }

  function onTouchEnd() {
    if (triggered.current) onReply();
    setTx(0);
    startX.current = null;
    startY.current = null;
    triggered.current = false;
    locked.current = null;
  }

  const iconOpacity = Math.min(tx / THRESHOLD, 1);
  const iconScale = 0.6 + Math.min(tx / THRESHOLD, 1) * 0.4;

  return (
    <div style={{ position: "relative" }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {tx > 4 && (
        <div
          style={{
            position: "absolute",
            left: 4,
            top: "50%",
            transform: `translateY(-50%) scale(${iconScale})`,
            color: "#C9A84C",
            fontSize: 20,
            opacity: iconOpacity,
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          ↩
        </div>
      )}
      <div
        style={{
          transform: `translateX(${tx}px)`,
          transition: tx === 0 ? "transform 0.2s ease-out" : undefined,
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
