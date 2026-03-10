"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isSameMonth,
  isToday,
  eachDayOfInterval,
} from "date-fns";

export type CalEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (startDate)
  endDate?: string | null; // YYYY-MM-DD
  status: string;
  project: string;
  phase?: string;
};

type View = "day" | "3day" | "week" | "month";

const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: "#8b949e",
  IN_PROGRESS: "#C9A84C",
  BLOCKED: "#ef4444",
  DONE: "#22c55e",
};

const STATUS_BG: Record<string, string> = {
  NOT_STARTED: "#8b949e22",
  IN_PROGRESS: "#C9A84C22",
  BLOCKED: "#ef444422",
  DONE: "#22c55e22",
};

function EventChip({ event, small = false }: { event: CalEvent; small?: boolean }) {
  const color = STATUS_COLOR[event.status] ?? "#8b949e";
  const bg = STATUS_BG[event.status] ?? "#8b949e22";
  return (
    <div
      className="truncate rounded px-1.5 py-0.5 text-xs font-medium leading-snug"
      style={{ background: bg, borderLeft: `2px solid ${color}`, color: color }}
      title={`${event.title} — ${event.project}`}
    >
      {small ? event.title : `${event.title}`}
    </div>
  );
}

function getEventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  const dayStr = format(day, "yyyy-MM-dd");
  return events.filter((e) => {
    if (!e.date) return false;
    const start = e.date;
    const end = e.endDate ?? e.date;
    return dayStr >= start && dayStr <= end;
  });
}

// ─── Month view ──────────────────────────────────────────────────────────────

function MonthView({ anchor, events }: { anchor: Date; events: CalEvent[] }) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "#30373f" }}>
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: "#8b949e" }}>
            {d}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className="flex flex-col p-1 overflow-hidden"
              style={{ borderRight: "1px solid #30373f", borderBottom: "1px solid #30373f", background: today ? "#1e2736" : "transparent" }}
            >
              <div className="mb-1 flex items-center justify-center">
                <span
                  className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                  style={
                    today
                      ? { background: "#C9A84C", color: "#0d1117" }
                      : { color: inMonth ? "#e6edf3" : "#30373f" }
                  }
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => (
                  <EventChip key={e.id + day.toISOString()} event={e} small />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs px-1" style={{ color: "#8b949e" }}>+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Multi-day column view (day / 3-day / week) ───────────────────────────────

function ColumnView({ days, events }: { days: Date[]; events: CalEvent[] }) {
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b" style={{ borderColor: "#30373f", gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="py-3 text-center" style={{ borderRight: "1px solid #30373f" }}>
              <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: "#8b949e" }}>
                {DAYS_SHORT[day.getDay()]}
              </div>
              <div className="mt-1 flex justify-center">
                <span
                  className="text-lg font-bold w-9 h-9 flex items-center justify-center rounded-full"
                  style={today ? { background: "#C9A84C", color: "#0d1117" } : { color: "#e6edf3" }}
                >
                  {format(day, "d")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Events */}
      <div className="grid flex-1 overflow-y-auto" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className="p-2 space-y-1.5 overflow-y-auto"
              style={{ borderRight: "1px solid #30373f", background: today ? "#1e273644" : "transparent", minHeight: "200px" }}
            >
              {dayEvents.length === 0 && (
                <div className="text-xs text-center mt-4" style={{ color: "#30373f" }}>—</div>
              )}
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg p-2"
                  style={{ background: STATUS_BG[e.status] ?? "#8b949e22", borderLeft: `3px solid ${STATUS_COLOR[e.status] ?? "#8b949e"}` }}
                >
                  <div className="text-xs font-semibold leading-tight" style={{ color: STATUS_COLOR[e.status] ?? "#8b949e" }}>{e.title}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "#8b949e" }}>{e.project}</div>
                  {e.phase && <div className="text-xs truncate" style={{ color: "#8b949e88" }}>{e.phase}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main calendar ────────────────────────────────────────────────────────────

export default function DarkCalendar({ events }: { events: CalEvent[] }) {
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(new Date());

  function prev() {
    if (view === "month") setAnchor((d) => subMonths(d, 1));
    else if (view === "week") setAnchor((d) => subWeeks(d, 1));
    else if (view === "3day") setAnchor((d) => subDays(d, 3));
    else setAnchor((d) => subDays(d, 1));
  }

  function next() {
    if (view === "month") setAnchor((d) => addMonths(d, 1));
    else if (view === "week") setAnchor((d) => addWeeks(d, 1));
    else if (view === "3day") setAnchor((d) => addDays(d, 3));
    else setAnchor((d) => addDays(d, 1));
  }

  function goToday() { setAnchor(new Date()); }

  const headerLabel = useMemo(() => {
    if (view === "month") return format(anchor, "MMMM yyyy");
    if (view === "week") {
      const start = startOfWeek(anchor, { weekStartsOn: 0 });
      const end = endOfWeek(anchor, { weekStartsOn: 0 });
      return isSameMonth(start, end)
        ? `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`
        : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    if (view === "3day") {
      const end = addDays(anchor, 2);
      return `${format(anchor, "MMM d")} – ${format(end, isSameMonth(anchor, end) ? "d, yyyy" : "MMM d, yyyy")}`;
    }
    return format(anchor, "EEEE, MMMM d, yyyy");
  }, [view, anchor]);

  const columnDays = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    if (view === "3day") return eachDayOfInterval({ start: anchor, end: addDays(anchor, 2) });
    if (view === "day") return [anchor];
    return [];
  }, [view, anchor]);

  const VIEWS: { key: View; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "3day", label: "3 Days" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
  ];

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: "#0d1117", border: "1px solid #30373f", minHeight: "600px" }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: "1px solid #30373f" }}>
        {/* Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ border: "1px solid #30373f", color: "#e6edf3" }}
          >
            Today
          </button>
          <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm" style={{ border: "1px solid #30373f", color: "#e6edf3" }}>
            ‹
          </button>
          <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm" style={{ border: "1px solid #30373f", color: "#e6edf3" }}>
            ›
          </button>
          <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{headerLabel}</span>
        </div>

        {/* View switcher */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30373f" }}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                view === v.key
                  ? { background: "#C9A84C", color: "#0d1117" }
                  : { background: "transparent", color: "#8b949e" }
              }
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 flex-wrap" style={{ borderBottom: "1px solid #30373f" }}>
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color: "#8b949e" }}>{status.replace("_", " ")}</span>
          </div>
        ))}
      </div>

      {/* Body */}
      {view === "month" ? (
        <MonthView anchor={anchor} events={events} />
      ) : (
        <ColumnView days={columnDays} events={events} />
      )}
    </div>
  );
}
