import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DarkCalendar from "@/components/calendar/DarkCalendar";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HubPage({
  params,
  searchParams,
}: {
  params: { companyId: string };
  searchParams?: { tab?: string };
}) {
  const session = await auth();
  if (session?.user.role === "PARTNER") redirect(`/${params.companyId}/projects`);

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
    const company = await prisma.company.findFirst({
      where: { id: params.companyId },
      select: { requestTrackerUrl: true, requestTrackerDate: true },
    });

    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Memory</h1>

        {/* Request Tracker Download */}
        <div className="rounded-2xl p-5" style={{ background: "#1e2736", border: `1px solid ${company?.requestTrackerUrl ? "#C9A84C44" : "#30373f"}` }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="text-3xl">📊</span>
              <div>
                <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Full Request Tracker</div>
                {company?.requestTrackerUrl ? (
                  <p className="text-sm" style={{ color: "#C9A84C" }}>
                    As of {company.requestTrackerDate ?? "unknown date"} — all requests since day one
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: "#8b949e" }}>Not yet uploaded — run the daily sync script.</p>
                )}
                <p className="text-xs mt-1" style={{ color: "#484f58" }}>
                  Excel file · every request, status, and date · updated daily by local cron
                </p>
              </div>
            </div>
            {company?.requestTrackerUrl && (
              <a
                href={`/api/${params.companyId}/download-request-tracker`}
                download="GC_Portal_Request_Tracker.xlsx"
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                ↓ Download
              </a>
            )}
          </div>
        </div>

        {/* Database Backup */}
        <div className="rounded-2xl p-5" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">💾</span>
            <div className="flex-1">
              <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Daily Database Backup</div>
              <p className="text-sm" style={{ color: "#8b949e" }}>Runs nightly at 2 AM — saved locally to ~/gc-portal-backups/</p>
              <p className="text-xs mt-2" style={{ color: "#484f58" }}>
                Full PostgreSQL dump · runs every night at 2 AM · previous backup deleted automatically
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: go to projects
  redirect(`/${params.companyId}/today`);
}
