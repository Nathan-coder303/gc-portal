"use client";

import { type GanttTask } from "@/lib/schedule/gantt";
import { format } from "date-fns";

export default function PrintScheduleButton({
  tasks,
  projectName,
  projectStart,
}: {
  tasks: GanttTask[];
  projectName: string;
  projectStart: Date;
}) {
  function openPrint() {
    const today = new Date();

    const phases = new Map<string, GanttTask[]>();
    for (const t of tasks) {
      const arr = phases.get(t.phase) ?? [];
      arr.push(t);
      phases.set(t.phase, arr);
    }

    const projectEnd = tasks.reduce(
      (max, t) => (t.endDate > max ? t.endDate : max),
      tasks[0]?.endDate ?? today
    );

    const totalDays =
      Math.ceil((projectEnd.getTime() - projectStart.getTime()) / 86400000) + 1;
    const CELL_W = 12;
    const ROW_H = 18;
    const LABEL_W = 200;
    const HEADER_H = 20;
    const svgW = LABEL_W + totalDays * CELL_W;

    const svgRows: string[] = [];
    let yOff = HEADER_H;

    // Month headers
    const monthHeaders: string[] = [];
    let cursor = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    while (cursor <= projectEnd) {
      const startDay = Math.max(
        0,
        Math.ceil((cursor.getTime() - projectStart.getTime()) / 86400000)
      );
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const end = monthEnd < projectEnd ? monthEnd : projectEnd;
      const days = Math.ceil((end.getTime() - cursor.getTime()) / 86400000) + 1;
      monthHeaders.push(
        `<rect x="${LABEL_W + startDay * CELL_W}" y="0" width="${days * CELL_W}" height="${HEADER_H}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5"/>`,
        `<text x="${LABEL_W + startDay * CELL_W + 3}" y="13" font-size="8" fill="#475569" font-weight="600">${format(cursor, "MMM yyyy")}</text>`
      );
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    // Today line
    const todayX = LABEL_W + Math.ceil((today.getTime() - projectStart.getTime()) / 86400000) * CELL_W;
    const todayLine =
      today >= projectStart && today <= projectEnd
        ? `<line x1="${todayX}" y1="0" x2="${todayX}" y2="9999" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,2"/>`
        : "";

    // Rows
    for (const [phase, phaseTasks] of Array.from(phases.entries())) {
      const done = phaseTasks.filter((t) => t.status === "DONE").length;
      const pct = Math.round((done / phaseTasks.length) * 100);
      svgRows.push(
        `<rect x="0" y="${yOff}" width="${svgW}" height="16" fill="#e2e8f0"/>`,
        `<text x="6" y="${yOff + 11}" font-size="9" fill="#334155" font-weight="700">${phase} (${phaseTasks.length} tasks · ${pct}%)</text>`
      );
      yOff += 16;

      for (const task of phaseTasks) {
        const startDay = Math.max(
          0,
          Math.ceil((task.startDate.getTime() - projectStart.getTime()) / 86400000)
        );
        const barW = Math.max(task.durationDays * CELL_W, CELL_W);
        const barX = LABEL_W + startDay * CELL_W;
        const color =
          task.status === "DONE"
            ? "#22c55e"
            : task.status === "IN_PROGRESS"
            ? "#3b82f6"
            : task.status === "BLOCKED"
            ? "#f97316"
            : "#C9A84C";
        const label =
          task.name.length > 28 ? task.name.slice(0, 28) + "…" : task.name;
        const isEven = svgRows.length % 2 === 0;

        svgRows.push(
          `<rect x="0" y="${yOff}" width="${svgW}" height="${ROW_H}" fill="${isEven ? "#ffffff" : "#f8fafc"}"/>`,
          `<line x1="0" y1="${yOff + ROW_H}" x2="${svgW}" y2="${yOff + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`,
          `<text x="6" y="${yOff + 12}" font-size="9" fill="#1e293b">${label}</text>`,
          task.isMilestone
            ? `<polygon points="${barX},${yOff + 3} ${barX + 7},${yOff + ROW_H / 2} ${barX},${yOff + ROW_H - 3} ${barX - 7},${yOff + ROW_H / 2}" fill="#7c3aed"/>`
            : `<rect x="${barX}" y="${yOff + 4}" width="${barW}" height="${ROW_H - 8}" rx="2" fill="${color}" opacity="0.85"/>` +
              (task.percentComplete > 0
                ? `<rect x="${barX}" y="${yOff + 4}" width="${(barW * task.percentComplete) / 100}" height="${ROW_H - 8}" rx="2" fill="${color}"/>`
                : "")
        );
        yOff += ROW_H;
      }
    }

    const svgH = yOff + 24;

    // Legend row
    const legendItems = [
      { color: "#3b82f6", label: "In Progress" },
      { color: "#22c55e", label: "Done" },
      { color: "#f97316", label: "Blocked" },
      { color: "#C9A84C", label: "Not Started" },
      { color: "#7c3aed", label: "Milestone" },
      { color: "#ef4444", label: "Today" },
    ];
    const legendSvg = legendItems
      .map(
        (item, i) =>
          `<rect x="${i * 95}" y="0" width="10" height="10" fill="${item.color}" rx="2"/><text x="${i * 95 + 13}" y="9" font-size="9" fill="#64748b">${item.label}</text>`
      )
      .join("");

    // Stats
    const doneTasks = tasks.filter((t) => t.status === "DONE").length;
    const lateTasks = tasks.filter(
      (t) => t.status !== "DONE" && t.endDate && t.endDate < today
    ).length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${projectName} — Schedule</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 20px 24px; color: #1e293b; }
  h1 { font-size: 18px; margin: 0 0 2px; color: #0f172a; }
  .subtitle { font-size: 11px; color: #64748b; margin-bottom: 12px; }
  .stats { display: flex; gap: 24px; margin-bottom: 16px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
  .stat { text-align: center; }
  .stat-val { font-size: 20px; font-weight: 700; line-height: 1; color: #0f172a; }
  .stat-late { color: #dc2626; }
  .stat-label { font-size: 10px; color: #64748b; margin-top: 2px; }
  .scroll { overflow-x: auto; }
  svg { display: block; }
  .legend { margin-top: 10px; }
  @media print {
    body { padding: 10px; }
    .no-print { display: none; }
    @page { size: landscape; margin: 0.5in; }
  }
</style>
</head>
<body>
<h1>${projectName} — Schedule</h1>
<p class="subtitle">Printed ${format(today, "MMMM d, yyyy")} · Project start: ${format(projectStart, "MMM d, yyyy")} · ${tasks.length} tasks</p>
<div class="stats">
  <div class="stat"><div class="stat-val">${tasks.length}</div><div class="stat-label">Total Tasks</div></div>
  <div class="stat"><div class="stat-val">${doneTasks}</div><div class="stat-label">Done</div></div>
  <div class="stat"><div class="stat-val">${inProgress}</div><div class="stat-label">In Progress</div></div>
  <div class="stat"><div class="stat-val ${lateTasks > 0 ? "stat-late" : ""}">${lateTasks}</div><div class="stat-label">Late</div></div>
  <div class="stat"><div class="stat-val">${Math.round((doneTasks / tasks.length) * 100)}%</div><div class="stat-label">Complete</div></div>
</div>
<button class="no-print" onclick="window.print()" style="margin-bottom:14px;padding:6px 16px;background:#1e293b;color:white;border:none;border-radius:5px;font-size:12px;cursor:pointer">Print / Save as PDF</button>
<div class="scroll">
<svg width="${svgW}" height="${svgH}">
  ${monthHeaders.join("")}
  ${todayLine}
  ${svgRows.join("")}
  <g transform="translate(${LABEL_W + 4}, ${svgH - 12})">${legendSvg}</g>
</svg>
</div>
<div class="legend"></div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  if (!tasks.length) return null;

  return (
    <button
      onClick={openPrint}
      className="px-3 py-1.5 text-sm rounded-lg font-medium"
      style={{ background: "#1e2736", color: "#e6edf3", border: "1px solid #30373f" }}
    >
      Print Preview
    </button>
  );
}
