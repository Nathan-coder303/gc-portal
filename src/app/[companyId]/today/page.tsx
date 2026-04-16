import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SyncLeadsButton from "@/components/today/SyncLeadsButton";
import SyncBidsButton from "@/components/today/SyncBidsButton";
import AddLeadButton from "@/components/leads/AddLeadButton";
import TodayLeadCard from "@/components/leads/TodayLeadCard";
import TodayTaskCard, { FollowUpItem } from "@/components/today/TodayTaskCard";
import PendingCountersignsCard from "@/components/today/PendingCountersignsCard";
import AppointmentsCard from "@/components/today/AppointmentsCard";
import BarometerSection, { type ClientIncomeSummary } from "@/components/today/BarometerSection";

type DivisionLike = { items: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }[]; groups: { items: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }[] }[] };

function calcRaw(divisions: DivisionLike[]): number {
  return divisions.reduce((sum, div) => {
    const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
    return sum + allItems.reduce((s, i) => {
      const qty = i.defaultQty ? Number(i.defaultQty) : 0;
      const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
      const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
      return s + qty * cost * (1 + markup / 100);
    }, 0);
  }, 0);
}

function calcMarkupTotal(divisions: DivisionLike[]): number {
  return divisions.reduce((sum, div) => {
    const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
    return sum + allItems.reduce((s, i) => {
      const qty = i.defaultQty ? Number(i.defaultQty) : 0;
      const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
      const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
      return s + qty * cost * (markup / 100);
    }, 0);
  }, 0);
}

function calcGcFeeAmt(divisions: DivisionLike[], gcFeePercent: unknown): number {
  if (!gcFeePercent) return 0;
  return calcRaw(divisions) * Number(gcFeePercent) / 100;
}

function calcEstimateTotal(divisions: DivisionLike[], gcFeePercent: unknown): number {
  return calcRaw(divisions) * (1 + (gcFeePercent ? Number(gcFeePercent) / 100 : 0));
}

export default async function TodayPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "PARTNER") redirect(`/${params.companyId}/projects`);

  // Compute start/end of today in Eastern Time (handles EST/EDT automatically)
  const now = new Date();
  const etDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // "YYYY-MM-DD"
  const [etY, etM, etD] = etDateStr.split("-").map(Number);
  let todayStart = new Date(Date.UTC(etY, etM - 1, etD, 4, 0, 0, 0));
  const verifyHour = parseInt(todayStart.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
  if (verifyHour !== 0) todayStart = new Date(Date.UTC(etY, etM - 1, etD, 5, 0, 0, 0));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const [todayLeads, allLeadsCount, estimatesToSend, followUps, clients, urgentLeads, untriaged, pendingCountersigns, todayAppointments, upcomingAppointments, activeClients] = await Promise.all([
    // Leads received today from email
    prisma.lead.findMany({
      where: {
        companyId: params.companyId,
        receivedAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true, name: true, email: true, phone: true,
        projectType: true, message: true, city: true, state: true, receivedAt: true,
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
      select: { id: true, name: true, project: { select: { id: true, name: true } } },
    }),
    // All follow-ups for this company — only show items due today or earlier (or with no due date)
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        OR: [{ dueDate: null }, { dueDate: { lte: todayEnd } }],
      },
      orderBy: { createdAt: "asc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    // Clients list for assignment dropdowns
    prisma.client.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // To Call ASAP pipeline cards
    prisma.pipelineCard.findMany({
      where: { companyId: params.companyId, stage: "TO_CALL_ASAP" },
      orderBy: [{ createdAt: "desc" }],
      include: {
        client: { select: { id: true, name: true, phone: true } },
        lead: { select: { phone: true } },
      },
    }),
    // Leads not yet in pipeline
    prisma.lead.count({
      where: { companyId: params.companyId, pipelineCard: null },
    }),
    // Estimates signed by client but not yet countersigned
    prisma.estimateTemplate.findMany({
      where: {
        companyId: params.companyId,
        signedAt: { not: null },
        counterSignedAt: null,
        archivedAt: null,
      },
      orderBy: { signedAt: "asc" },
      select: {
        id: true, name: true, estimateNumber: true,
        signedAt: true, signedByName: true, signatureToken: true,
        client: { select: { id: true, name: true } },
      },
    }),
    // Today's appointments — exact date range so future-scheduled ones appear on their day
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        category: "TASK",
        text: { startsWith: "📅 Appointment" },
        completedAt: null,
        dueDate: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Upcoming appointments (future dates)
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        category: "TASK",
        text: { startsWith: "📅 Appointment" },
        completedAt: null,
        dueDate: { gt: todayEnd },
      },
      orderBy: { dueDate: "asc" },
    }),
    // Active + Completed clients with template data for MIBH Income barometer
    prisma.client.findMany({
      where: { companyId: params.companyId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: {
        id: true,
        name: true,
        status: true,
        templates: {
          where: { type: "CLIENT_ESTIMATE", archivedAt: null },
          select: {
            gcFeePercent: true,
            internalProfitOverride: true,
            divisions: {
              where: { archivedAt: null },
              select: {
                items: { where: { archivedAt: null, groupId: null }, select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true } },
                groups: { where: { archivedAt: null }, select: { items: { where: { archivedAt: null }, select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // MIBH Income = sum of (internalProfit + gcFee) across active + completed clients
  const clientIncomeSummaries: ClientIncomeSummary[] = activeClients.map(c => {
    const internalProfit = c.templates.reduce((s, t) => s + (t.internalProfitOverride != null ? Number(t.internalProfitOverride) : calcMarkupTotal(t.divisions)), 0);
    const gcFee = c.templates.reduce((s, t) => s + calcGcFeeAmt(t.divisions, t.gcFeePercent), 0);
    const estimateTotal = c.templates.reduce((s, t) => s + calcEstimateTotal(t.divisions, t.gcFeePercent), 0);
    return { id: c.id, name: c.name, status: c.status, estimateTotal, internalProfit, gcFee, mibhIncome: internalProfit + gcFee, companyId: params.companyId };
  });
  const mibhIncome = clientIncomeSummaries.filter(c => c.status === "ACTIVE").reduce((s, c) => s + c.mibhIncome, 0);

  // Today's appointments come from the dedicated query (exact date match, works for future dates too)
  const appointments = todayAppointments;

  // Map follow-ups to FollowUpItem shape for each category
  function toItems(category: "TASK" | "FOLLOW_UP" | "ESTIMATE"): FollowUpItem[] {
    return followUps
      .filter(f => f.category === category)
      .map(f => ({
        id: f.id,
        text: f.text,
        audioUrl: f.audioUrl,
        audioMimeType: f.audioMimeType,
        audioSize: f.audioSize,
        clientId: f.clientId,
        clientName: f.client?.name ?? null,
        completedAt: f.completedAt ? f.completedAt.toISOString() : null,
        createdAt: f.createdAt.toISOString(),
      }));
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between mb-1 gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: "#e6edf3" }}>
            Today&apos;s Overview
          </h1>
          <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ color: "#8b949e" }}>{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncBidsButton companyId={params.companyId} />
          <SyncLeadsButton companyId={params.companyId} />
        </div>
      </div>

      {/* MIBH Income 2026 Barometer */}
      <BarometerSection mibhIncome={mibhIncome} clients={clientIncomeSummaries} />

      {/* Today's Appointments */}
      <AppointmentsCard
        companyId={params.companyId}
        initialAppointments={appointments.map(a => ({ id: a.id, text: a.text, dueDate: a.dueDate ? a.dueDate.toISOString() : null }))}
        initialUpcoming={upcomingAppointments.map(a => ({ id: a.id, text: a.text, dueDate: a.dueDate ? a.dueDate.toISOString() : null }))}
        todayDateStr={etDateStr}
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* LEADS card — full width, left=triaging right=new leads */}
        <div
          className="col-span-2 lg:col-span-3 rounded-2xl p-4 sm:p-5"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center text-[52px] sm:text-6xl font-black leading-none tracking-tight" style={{ color: "#C9A84C" }}>Leads</div>
            <AddLeadButton companyId={params.companyId} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            {/* Triaging */}
            <Link
              href={`/${params.companyId}/leads`}
              className="flex flex-col gap-1 p-3 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "#0d1117", border: `1px solid ${untriaged > 0 ? "#ef444433" : "#30373f"}` }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>Triaging</span>
              <div className="text-[26px] sm:text-3xl font-black leading-none mt-1" style={{ color: untriaged > 0 ? "#ef4444" : "#e6edf3" }}>{untriaged}</div>
              <div className="text-[11px] mt-1" style={{ color: "#484f58" }}>need pipeline stage</div>
            </Link>
            {/* New Leads */}
            <Link
              href={`/${params.companyId}/leads`}
              className="flex flex-col gap-1 p-3 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "#0d1117", border: "1px solid #30373f" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>New leads</span>
                {todayLeads.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#C9A84C", color: "#0d1117" }}>
                    {todayLeads.length} today
                  </span>
                )}
              </div>
              <div className="text-[26px] sm:text-3xl font-black leading-none mt-1" style={{ color: todayLeads.length === 0 ? "#484f58" : "#e6edf3" }}>{todayLeads.length === 0 ? "—" : todayLeads.length}</div>
              <div className="text-[11px] mt-1" style={{ color: "#484f58" }}>{allLeadsCount} total all time</div>
              {todayLeads.length > 0 && (
                <ul className="space-y-1.5 mt-2">
                  {todayLeads.slice(0, 2).map((lead) => (
                    <TodayLeadCard key={lead.id} lead={lead} companyId={params.companyId} />
                  ))}
                </ul>
              )}
            </Link>
            {/* To Call ASAP */}
            <Link
              href={`/${params.companyId}/leads`}
              className="flex flex-col gap-1 p-3 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "#0d1117", border: `1px solid ${urgentLeads.length > 0 ? "#ef444433" : "#30373f"}` }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>To Call ASAP</span>
              <div className="text-[26px] sm:text-3xl font-black leading-none mt-1" style={{ color: urgentLeads.length === 0 ? "#484f58" : "#ef4444" }}>{urgentLeads.length === 0 ? "—" : urgentLeads.length}</div>
              <div className="text-[11px] mt-1" style={{ color: "#484f58" }}>in pipeline</div>
            </Link>
          </div>
        </div>

        {/* Estimates */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-2"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center justify-between gap-1">
            <Link href={`/${params.companyId}/estimates`} className="text-[26px] sm:text-3xl font-black leading-none hover:opacity-80 transition-opacity" style={{ color: "#C9A84C" }}>Estimates</Link>
            <div className="flex items-center gap-2 shrink-0">
              {estimatesToSend.length > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#C9A84C", color: "#0d1117" }}>
                  {estimatesToSend.length}
                </span>
              )}
              <Link
                href={`/${params.companyId}/estimates`}
                className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
                style={{ border: "1px solid #C9A84C66", color: "#C9A84C" }}
              >
                + Add
              </Link>
            </div>
          </div>
          <div className="text-[11px] mt-1" style={{ color: "#484f58" }}>to send today</div>
          {estimatesToSend.length > 0 && (
            <ul className="space-y-1.5 mt-1">
              {estimatesToSend.map((est) => (
                <li key={est.id}>
                  <span className="text-xs font-medium" style={{ color: "#58a6ff" }}>{est.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Card 3 — Today's Tasks */}
        <TodayTaskCard
          companyId={params.companyId}
          category="TASK"
          label="Today's tasks"
          initialItems={toItems("TASK")}
          clients={clients}
        />

        {/* Card 4 — Follow-ups */}
        <TodayTaskCard
          companyId={params.companyId}
          category="FOLLOW_UP"
          label="Follow-ups"

          initialItems={toItems("FOLLOW_UP")}
          clients={clients}
        />

        {/* Card 5 — Pending Countersignatures (interactive) */}
        <PendingCountersignsCard
          companyId={params.companyId}
          initialEstimates={pendingCountersigns.map(est => ({
            id: est.id,
            name: est.name,
            estimateNumber: est.estimateNumber ?? null,
            signedAt: est.signedAt!.toISOString(),
            signedByName: est.signedByName ?? null,
            clientName: est.client?.name ?? null,
            clientId: est.client?.id ?? null,
          }))}
        />

        {/* Card 6 — Estimate Notes */}
        <TodayTaskCard
          companyId={params.companyId}
          category="ESTIMATE"
          label="Estimate notes"
          initialItems={toItems("ESTIMATE")}
          clients={clients}
        />

        {/* Card 7 — Sub Database */}
        <Link
          href={`/${params.companyId}/subs`}
          className="rounded-2xl p-4 flex flex-col gap-2 transition-all active:scale-[0.98]"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <span className="text-[26px] sm:text-3xl font-black leading-none" style={{ color: "#C9A84C" }}>Sub database</span>
          <div className="text-[11px]" style={{ color: "#484f58" }}>By division · copy emails</div>
          <div className="mt-auto pt-2 flex items-center gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#1e2736", color: "#58a6ff", border: "1px solid #58a6ff33" }}>Divisions</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#1e2736", color: "#22c55e", border: "1px solid #22c55e33" }}>Emails</span>
          </div>
        </Link>

      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TbdCard({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-[#C9A84C33] hover:scale-[1.01] cursor-default"
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
