import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

  const [newLeads, estimatesToSend] = await Promise.all([
    // New leads = clients created today
    prisma.client.findMany({
      where: {
        companyId: params.companyId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, phone: true },
    }),
    // Estimates to send = DRAFT estimates created today across all projects
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
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#e6edf3" }}>
        Today&apos;s Overview
      </h1>
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
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8b949e" }}
            >
              New Leads of the Day
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: "#238636", color: "#fff" }}
            >
              {newLeads.length}
            </span>
          </div>
          {newLeads.length === 0 ? (
            <p className="text-xs" style={{ color: "#8b949e" }}>
              No new leads today.
            </p>
          ) : (
            <ul className="space-y-2">
              {newLeads.map((lead) => (
                <li key={lead.id} className="flex flex-col gap-0.5">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#e6edf3" }}
                  >
                    {lead.name}
                  </span>
                  {lead.email && (
                    <span className="text-xs" style={{ color: "#8b949e" }}>
                      {lead.email}
                    </span>
                  )}
                  {!lead.email && lead.phone && (
                    <span className="text-xs" style={{ color: "#8b949e" }}>
                      {lead.phone}
                    </span>
                  )}
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
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8b949e" }}
            >
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
            <p className="text-xs" style={{ color: "#8b949e" }}>
              No draft estimates created today.
            </p>
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
                  <div className="text-xs" style={{ color: "#8b949e" }}>
                    {est.project.name}
                  </div>
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
      style={{
        background: "#161b22",
        border: "1px solid #30373f",
        opacity: 0.55,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "#8b949e" }}
        >
          {label}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: "#30373f", color: "#8b949e" }}
        >
          —
        </span>
      </div>
      <p className="text-xs italic" style={{ color: "#8b949e" }}>
        Coming soon
      </p>
    </div>
  );
}
