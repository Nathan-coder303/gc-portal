import Link from "next/link";

type ClientWithLog = {
  id: string;
  name: string;
  projectName: string | null;
  lastLogDate: string | null;
  lastLogStatus: string | null;
  logCount: number;
};

const GOLD = "#C9A84C";
const TEXT = "#e6edf3";
const MUTED = "#8b949e";
const BORDER = "#30373f";

function relativeDay(dateStr: string | null, todayDateStr: string): { label: string; tone: "today" | "yesterday" | "old" | "none" } {
  if (!dateStr) return { label: "No logs yet", tone: "none" };
  const ymd = dateStr.slice(0, 10);
  if (ymd === todayDateStr) return { label: "Today", tone: "today" };

  const [yT, mT, dT] = todayDateStr.split("-").map(Number);
  const today = new Date(Date.UTC(yT, mT - 1, dT));
  const log = new Date(dateStr);
  const diffDays = Math.floor((today.getTime() - log.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return { label: "Yesterday", tone: "yesterday" };
  if (diffDays > 1) return { label: `${diffDays}d ago`, tone: "old" };
  return { label: new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" }), tone: "old" };
}

export default function DailyLogsCard({
  companyId,
  clients,
  todayDateStr,
}: {
  companyId: string;
  clients: ClientWithLog[];
  todayDateStr: string;
}) {
  if (clients.length === 0) return null;

  return (
    <div className="rounded-2xl p-3 sm:p-5 mb-4" style={{ background: "#161b22", border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-bold tracking-tight" style={{ color: GOLD }}>📋 Daily Logs</span>
          <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}>
            {clients.length} active
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>tap to open</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {clients.map(c => {
          const r = relativeDay(c.lastLogDate, todayDateStr);
          const toneColor =
            r.tone === "today" ? "#22c55e" :
            r.tone === "yesterday" ? GOLD :
            r.tone === "none" ? "#f85149" :
            MUTED;
          return (
            <Link
              key={c.id}
              href={`/${companyId}/clients/${c.id}?tab=daily-logs`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:opacity-90"
              style={{ background: "#0d1117", border: `1px solid ${BORDER}` }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                  {c.projectName || c.name}
                </p>
                {c.projectName && c.projectName !== c.name && (
                  <p className="text-[10px] truncate" style={{ color: MUTED }}>{c.name}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold" style={{ color: toneColor }}>{r.label}</p>
                <p className="text-[10px]" style={{ color: MUTED }}>{c.logCount} log{c.logCount !== 1 ? "s" : ""}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
