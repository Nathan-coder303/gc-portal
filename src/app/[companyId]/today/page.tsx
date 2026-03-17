import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SyncLeadsButton from "@/components/today/SyncLeadsButton";
import TodayLeadCard from "@/components/leads/TodayLeadCard";

export default async function TodayPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Compute start/end of today in Eastern Time (handles EST/EDT automatically)
  const now = new Date();
  const etDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // "YYYY-MM-DD"
  const [etY, etM, etD] = etDateStr.split("-").map(Number);
  // Find the UTC time that corresponds to midnight ET (try EDT=4, EST=5)
  let todayStart = new Date(Date.UTC(etY, etM - 1, etD, 4, 0, 0, 0));
  const verifyHour = parseInt(todayStart.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
  if (verifyHour !== 0) todayStart = new Date(Date.UTC(etY, etM - 1, etD, 5, 0, 0, 0)); // fall back to EST
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1); // 23:59:59.999 ET

  const [todayLeads, allLeadsCount, estimatesToSend] = await Promise.all([
    // Leads received today from email
    prisma.lead.findMany({
      where: {
        companyId: params.companyId,
        receivedAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        projectType: true,
        message: true,
        city: true,
        state: true,
        receivedAt: true,
      },
    }),
    // All-time lead count
    prisma.lead.count({ where: { companyId: params.companyId } }),
    // DRAFT estimates created today
    prisma.projectEstimate.findMany({
      where: {
        project: { companyId: params.companyId },
        status: "DRAFT",
        archivedAt: null,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>
          Today&apos;s Overview
        </h1>
        <SyncLeadsButton companyId={params.companyId} />
      </div>
      <p className="text-sm mb-8" style={{ color: "#8b949e" }}>
        {today}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1 — New Leads of the Day */}
        <Link
          href={`/${params.companyId}/leads`}
          className="rounded-xl p-5 flex flex-col gap-3 transition-colors hover:border-[#C9A84C55] block"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
              New Leads of the Day
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#8b949e" }}>{allLeadsCount} total</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {todayLeads.length} today
              </span>
            </div>
          </div>
          {todayLeads.length === 0 ? (
            <p className="text-xs" style={{ color: "#8b949e" }}>No new leads today.</p>
          ) : (
            <ul className="space-y-3">
              {todayLeads.map((lead) => (
                <TodayLeadCard key={lead.id} lead={lead} companyId={params.companyId} />
              ))}
            </ul>
          )}
        </Link>

        {/* Card 2 — Estimates to be Sent Today */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
              Estimates to be Sent Today
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              {estimatesToSend.length}
            </span>
          </div>
          {estimatesToSend.length === 0 ? (
            <p className="text-xs" style={{ color: "#8b949e" }}>No draft estimates created today.</p>
          ) : (
            <ul className="space-y-2">
              {estimatesToSend.map((est) => (
                <li key={est.id}>
                  <Link
                    href={`/${params.companyId}/${est.project.id}/estimates/${est.id}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: "#58a6ff" }}
                  >
                    {est.name}
                  </Link>
                  <div className="text-xs" style={{ color: "#8b949e" }}>{est.project.name}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 3 — TBD */}
        <TbdCard label="Follow-ups Due" />

        {/* Card 4 — TBD */}
        <TbdCard label="Active Projects" />

        {/* Card 5 — TBD */}
        <TbdCard label="Pending Invoices" />

        {/* Card 6 — TBD */}
        <TbdCard label="Open Tasks" />
      </div>
    </div>
  );
}

function TbdCard({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "#161b22", border: "1px solid #30373f", opacity: 0.55 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
          {label}
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#30373f", color: "#8b949e" }}>
          —
        </span>
      </div>
      <p className="text-xs italic" style={{ color: "#8b949e" }}>Coming soon</p>
    </div>
  );
}
