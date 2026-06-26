"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Client = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  estimateCount: number;
  estimateTotal: number;
  status: string;
  updatedAt: string;
};

type Stage = {
  key: string;
  title: string;
  accent: string;
  bg: string;
};

const STAGES: Stage[] = [
  { key: "PROSPECT",  title: "Prospects",     accent: "#C9A84C", bg: "#1a1508" },
  { key: "PIPELINE",  title: "Pipeline",      accent: "#3b82f6", bg: "#0a1220" },
  { key: "ACTIVE",    title: "Active Clients", accent: "#22c55e", bg: "#0a1a0f" },
  { key: "COMPLETED", title: "Closed Jobs",   accent: "#8b949e", bg: "#0d1117" },
  { key: "DEAD",      title: "Dead Clients",  accent: "#ef4444", bg: "#1a0a0a" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

const LONG_PRESS_MS = 320;
const MOVE_CANCEL_PX = 8;

type DragState = {
  client: Client;
  pointerId: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  cardHeight: number;
  hoverStage: string | null;
};

function StageCard({
  stage, clients, companyId,
  isDropTarget,
  onClientPointerDown,
  dragActive,
  dragClientId,
  registerStageEl,
}: {
  stage: Stage;
  clients: Client[];
  companyId: string;
  isDropTarget: boolean;
  onClientPointerDown: (e: React.PointerEvent, c: Client) => void;
  dragActive: boolean;
  dragClientId: string | null;
  registerStageEl: (key: string, el: HTMLDivElement | null) => void;
}) {
  // Expand if drop target (so user can drop into an empty/closed stage); otherwise user-toggled
  const [openManual, setOpenManual] = useState(false);
  const open = openManual || isDropTarget;
  const count = clients.length;
  const total = clients.reduce((s, c) => s + c.estimateTotal, 0);

  return (
    <div
      ref={el => registerStageEl(stage.key, el)}
      data-stage-key={stage.key}
      className="rounded-2xl overflow-hidden w-full transition-shadow"
      style={{
        background: "#161b22",
        border: `1px solid ${isDropTarget ? stage.accent : `${stage.accent}44`}`,
        boxShadow: isDropTarget ? `0 0 0 3px ${stage.accent}55` : undefined,
      }}
    >
      <button
        onClick={() => setOpenManual(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: stage.bg }}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.accent }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: stage.accent }}>{stage.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#8b949e" }}>
            {count} client{count !== 1 ? "s" : ""}{total > 0 ? ` · ${fmt(total)}` : ""}
            {isDropTarget && <span className="ml-2 font-bold" style={{ color: stage.accent }}>· drop here</span>}
          </p>
        </div>
        <span className="text-xs shrink-0" style={{ color: stage.accent }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 space-y-1.5" style={{ borderTop: `1px solid ${stage.accent}22` }}>
          {clients.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "#8b949e" }}>
              {isDropTarget ? "Release to drop client here." : "No clients in this stage."}
            </p>
          ) : (
            clients.map(c => {
              const location = [c.city, c.state].filter(Boolean).join(", ");
              const isBeingDragged = dragActive && dragClientId === c.id;
              return (
                <div
                  key={c.id}
                  data-client-row="1"
                  onPointerDown={e => onClientPointerDown(e, c)}
                  style={{
                    background: "#0d1117",
                    border: "1px solid #30373f",
                    borderRadius: 12,
                    opacity: isBeingDragged ? 0.35 : 1,
                    transition: "opacity 0.12s",
                    touchAction: "manipulation",
                    // prevent iOS text selection / image drag during press
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                >
                  <Link
                    href={`/${companyId}/clients/${c.id}`}
                    className="flex items-center gap-3 px-3 py-2.5"
                    // Long-press intercepts the link below; a quick tap still navigates.
                    onClick={e => { if (dragActive) e.preventDefault(); }}
                  >
                    <span className="text-base shrink-0 select-none" style={{ color: "#484f58", touchAction: "none" }}>⠿</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{c.name}</p>
                      {(location || c.address) && (
                        <p className="text-[11px] truncate" style={{ color: "#8b949e" }}>{location || c.address}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {c.estimateTotal > 0 && (
                        <p className="text-xs font-bold" style={{ color: "#C9A84C" }}>{fmt(c.estimateTotal)}</p>
                      )}
                      {c.estimateCount > 0 && (
                        <p className="text-[10px]" style={{ color: "#8b949e" }}>{c.estimateCount} est</p>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function MobileClientList({ companyId, clients: initialClients }: { companyId: string; clients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number; pointerId: number; clientId: string } | null>(null);
  const stageEls = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Sync external client list updates
  useEffect(() => { setClients(initialClients); }, [initialClients]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q)
      )
    : clients;

  const registerStageEl = useCallback((key: string, el: HTMLDivElement | null) => {
    stageEls.current.set(key, el);
  }, []);

  const findStageUnder = useCallback((x: number, y: number): string | null => {
    let hit: string | null = null;
    stageEls.current.forEach((el, key) => {
      if (hit || !el) return;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = key;
    });
    return hit;
  }, []);

  const cancelPending = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    pressStart.current = null;
  }, []);

  const beginDrag = useCallback((client: Client, pointerId: number, x: number, y: number, sourceRect: DOMRect | null) => {
    // Haptic feedback if available
    try { (navigator as Navigator & { vibrate?: (n: number) => boolean }).vibrate?.(35); } catch { /* */ }
    const cardWidth = sourceRect?.width ?? 320;
    const cardHeight = sourceRect?.height ?? 56;
    setDrag({
      client,
      pointerId,
      pointerX: x,
      pointerY: y,
      offsetX: sourceRect ? x - sourceRect.left : cardWidth / 2,
      offsetY: sourceRect ? y - sourceRect.top : cardHeight / 2,
      width: cardWidth,
      cardHeight,
      hoverStage: findStageUnder(x, y),
    });
  }, [findStageUnder]);

  const onClientPointerDown = useCallback((e: React.PointerEvent, c: Client) => {
    // Only treat touch / pen as long-press drag; allow mouse for desktop too
    if (e.button !== undefined && e.button !== 0) return;
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    pressStart.current = { x: startX, y: startY, pointerId: e.pointerId, clientId: c.id };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      // Only start drag if pointer hasn't moved much (handled in move handler)
      if (!pressStart.current || pressStart.current.clientId !== c.id) return;
      try { target.setPointerCapture(e.pointerId); } catch { /* */ }
      beginDrag(c, e.pointerId, startX, startY, rect);
    }, LONG_PRESS_MS);
  }, [beginDrag]);

  // Global pointer move / up handlers (cover the whole document while drag pending or active)
  useEffect(() => {
    function onMove(ev: PointerEvent) {
      // Cancel pending drag if user moves significantly before long-press fires
      if (!dragRef.current && pressStart.current && ev.pointerId === pressStart.current.pointerId) {
        const dx = ev.clientX - pressStart.current.x;
        const dy = ev.clientY - pressStart.current.y;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancelPending();
        return;
      }
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      ev.preventDefault();
      const x = ev.clientX, y = ev.clientY;
      const hover = findStageUnder(x, y);
      setDrag(prev => prev ? { ...prev, pointerX: x, pointerY: y, hoverStage: hover } : prev);

      // Auto-scroll near top/bottom edges
      const edge = 80;
      if (y < edge) window.scrollBy({ top: -10, behavior: "auto" });
      else if (y > window.innerHeight - edge) window.scrollBy({ top: 10, behavior: "auto" });
    }
    async function onUp(ev: PointerEvent) {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) {
        cancelPending();
        return;
      }
      const target = d.hoverStage;
      const movedTo = target && target !== d.client.status ? target : null;
      setDrag(null);
      if (movedTo) {
        // Optimistic update
        setClients(prev => prev.map(c => c.id === d.client.id ? { ...c, status: movedTo } : c));
        try {
          await fetch(`/api/${companyId}/clients/${d.client.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: movedTo }),
          });
          try { (navigator as Navigator & { vibrate?: (n: number) => boolean }).vibrate?.(20); } catch { /* */ }
        } catch {
          // Revert on failure
          setClients(prev => prev.map(c => c.id === d.client.id ? { ...c, status: d.client.status } : c));
        }
      }
    }
    function onCancel(ev: PointerEvent) {
      if (dragRef.current && ev.pointerId === dragRef.current.pointerId) setDrag(null);
      cancelPending();
    }
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, [cancelPending, findStageUnder, companyId]);

  // Disable page scroll while actively dragging on touch
  useEffect(() => {
    if (drag) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [drag]);

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Clients</h1>
        <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
          {filtered.length} client{filtered.length !== 1 ? "s" : ""}
          <span className="ml-2" style={{ color: "#484f58" }}>· hold a card to drag between stages</span>
        </p>
      </div>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#484f58" }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="w-full text-sm rounded-xl pl-9 pr-9 py-2.5 outline-none"
          style={{ background: "#161b22", border: `1px solid ${search ? "#C9A84C66" : "#30373f"}`, color: "#e6edf3" }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#484f58" }}>✕</button>
        )}
      </div>

      <div className="space-y-3 w-full">
        {STAGES.map(stage => (
          <StageCard
            key={stage.key}
            stage={stage}
            clients={filtered.filter(c => c.status === stage.key)}
            companyId={companyId}
            isDropTarget={!!drag && drag.hoverStage === stage.key}
            onClientPointerDown={onClientPointerDown}
            dragActive={!!drag}
            dragClientId={drag?.client.id ?? null}
            registerStageEl={registerStageEl}
          />
        ))}
      </div>

      {/* Floating ghost that follows the finger while dragging */}
      {drag && (
        <div
          style={{
            position: "fixed",
            left: drag.pointerX - drag.offsetX,
            top: drag.pointerY - drag.offsetY,
            width: drag.width,
            background: "#1e2736",
            border: "2px solid #C9A84C",
            borderRadius: 12,
            padding: "12px 14px",
            color: "#e6edf3",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 16px 32px rgba(0,0,0,0.6)",
            pointerEvents: "none",
            zIndex: 9999,
            transform: "rotate(-1.2deg)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "#C9A84C" }}>⠿</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{drag.client.name}</span>
          <span style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase" }}>
            {drag.hoverStage ? `→ ${STAGES.find(s => s.key === drag.hoverStage)?.title ?? drag.hoverStage}` : "Release on a stage"}
          </span>
        </div>
      )}
    </div>
  );
}
