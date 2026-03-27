import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DarkCalendar from "@/components/calendar/DarkCalendar";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

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
    let backupStatus: { date: string; file: string; size: string; timestamp: string } | null = null;
    try {
      const statusFile = path.join(process.env.HOME || "/Users/mike", "gc-portal-backups", "last-backup.json");
      backupStatus = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
    } catch { /* no backup yet */ }

    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Memory</h1>

        <div className="rounded-2xl p-5" style={{ background: "#1e2736", border: `1px solid ${backupStatus ? "#22c55e44" : "#30373f"}` }}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">💾</span>
            <div className="flex-1">
              <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Daily Database Backup</div>
              {backupStatus ? (
                <>
                  <p className="text-sm" style={{ color: "#22c55e" }}>
                    Last backup: {new Date(backupStatus.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} — {backupStatus.size}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#484f58" }}>
                    Saved to: {backupStatus.file}
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: "#8b949e" }}>No backup yet — runs nightly at 2 AM.</p>
              )}
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
