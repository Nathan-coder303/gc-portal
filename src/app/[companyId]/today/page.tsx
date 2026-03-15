import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SyncLeadsButton from "@/components/today/SyncLeadsButton";

export default async function TodayPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

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
        <div
          className="rounded-xl p-5 flex flex-col gap-3"
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
                style={{ background: "#238636", color: "#fff" }}
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
                <li key={lead.id} className="flex flex-col gap-0.5 pb-3" style={{ borderBottom: "1px solid #21262d" }}>
                  <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
                    {lead.name ?? "Unknown"}
                  </span>
                  {lead.projectType && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded self-start"
                      style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
                    >
                      {lead.projectType}
                    </span>
                  )}
                  {lead.email && <span className="text-xs" style={{ color: "#58a6ff" }}>{lead.email}</span>}
                  {lead.phone && <span className="text-xs" style={{ color: "#8b949e" }}>{lead.phone}</span>}
                  {(lead.city || lead.state) && (
                    <span className="text-xs" style={{ color: "#8b949e" }}>
                      {[lead.city, lead.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {lead.message && (
                    <span className="text-xs leading-relaxed" style={{ color: "#8b949e" }}>
                      {lead.message.slice(0, 120)}{lead.message.length > 120 ? "…" : ""}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: "#484f58" }}>
                    {new Date(lead.receivedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

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
