import { redirect } from "next/navigation";
import { getDailySummaries } from "@/lib/daily-summary";
import { prisma } from "@/lib/prisma";
import DarkCalendar from "@/components/calendar/DarkCalendar";

export default async function HubPage({
  params,
  searchParams,
}: {
  params: { companyId: string };
  searchParams?: { tab?: string };
}) {
  const tab = searchParams?.tab;

  if (tab === "calendar") {
    const tasks = await prisma.task.findMany({
      where: {
        archivedAt: null,
        project: { companyId: params.companyId },
        OR: [{ startDate: { not: null } }, { endDate: { not: null } }],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        phase: true,
        project: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
    });

    const events = tasks.map((t) => ({
      id: t.id,
      title: t.name,
      date: t.startDate ? t.startDate.toISOString().split("T")[0] : (t.endDate!.toISOString().split("T")[0]),
      endDate: t.endDate ? t.endDate.toISOString().split("T")[0] : null,
      status: t.status,
      project: t.project.name,
      phase: t.phase ?? undefined,
    }));

    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Calendar</h1>
        <DarkCalendar events={events} />
      </div>
    );
  }

  if (tab === "memory") {
    const summaries = await getDailySummaries(params.companyId);
    const todayUTC = new Date().toISOString().split("T")[0];

    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Memory</h1>

        {/* Info banner */}
        <div className="rounded-2xl p-5" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">🧠</span>
            <div>
              <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Daily Summaries</div>
              <p className="text-sm" style={{ color: "#8b949e" }}>
                Auto-generated at 9 PM ET each day by Claude. Covers expenses, task progress,
                journal entries, and new estimates across all projects.
              </p>
            </div>
          </div>
        </div>

        {/* Summary list */}
        {summaries.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
            <p className="text-sm" style={{ color: "#8b949e" }}>
              No summaries yet. The first one will appear tonight at 9 PM ET.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((s) => {
              const dateLabel = new Date(s.date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              });
              const isToday = s.date.toISOString().split("T")[0] === todayUTC;

              return (
                <div
                  key={s.id}
                  className="rounded-2xl p-5"
                  style={{ background: "#1e2736", border: "1px solid #30373f" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span>📅</span>
                    <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                      {dateLabel}
                    </span>
                    {isToday && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}
                      >
                        Today
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#8b949e" }}>
                    {s.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Default: go to projects
  redirect(`/${params.companyId}/today`);
}
