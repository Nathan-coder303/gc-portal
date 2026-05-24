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

type DivisionLike = { manualTotal?: unknown; items: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }[]; groups: { items: { defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown }[] }[] };

function divisionRaw(div: DivisionLike): number {
  if (div.manualTotal != null) return Number(div.manualTotal);
  const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
  return allItems.reduce((s, i) => {
    const qty = i.defaultQty ? Number(i.defaultQty) : 0;
    const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
    const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
    return s + qty * cost * (1 + markup / 100);
  }, 0);
}

function calcRaw(divisions: DivisionLike[]): number {
  return divisions.reduce((sum, div) => sum + divisionRaw(div), 0);
}

function calcMarkupTotal(divisions: DivisionLike[]): number {
  return divisions.reduce((sum, div) => {
    if (div.manualTotal != null) return sum;
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

  const [todayLeads, allLeadsCount, followUps, clients, leads, urgentLeads, untriaged, pendingCountersigns, todayAppointments, upcomingAppointments, pastAppointments, activeClients, upcomingTasks, activeClientCount, prospectCount, allClientSubs, allClientInvoices] = await Promise.all([
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
    // All follow-ups: no due date, due today/earlier (overdue+today), OR completed (any date); never appointments
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        NOT: { text: { startsWith: "📅 Appointment" } },
        OR: [
          { dueDate: null },
          { dueDate: { lte: new Date(Date.UTC(etY, etM - 1, etD + 1) - 1) } },
          { completedAt: { not: null } },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: { client: { select: { id: true, name: true } }, lead: { select: { id: true, name: true } } },
    }),
    // Clients list for assignment dropdowns
    prisma.client.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Leads list for assignment dropdowns
    prisma.lead.findMany({
      where: { companyId: params.companyId },
      orderBy: { receivedAt: "desc" },
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
    // Today's appointments — compare DATE column by exact calendar day (UTC midnight bounds)
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        category: "TASK",
        text: { startsWith: "📅 Appointment" },
        completedAt: null,
        dueDate: {
          gte: new Date(Date.UTC(etY, etM - 1, etD)),
          lt:  new Date(Date.UTC(etY, etM - 1, etD + 1)),
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Upcoming appointments (future calendar days, ET)
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        category: "TASK",
        text: { startsWith: "📅 Appointment" },
        completedAt: null,
        dueDate: { gte: new Date(Date.UTC(etY, etM - 1, etD + 1)) },
      },
      orderBy: { dueDate: "asc" },
    }),
    // Past appointments (before today)
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        category: "TASK",
        text: { startsWith: "📅 Appointment" },
        dueDate: { lt: new Date(Date.UTC(etY, etM - 1, etD)) },
      },
      orderBy: { dueDate: "desc" },
      take: 30,
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
                manualTotal: true,
                items: { where: { archivedAt: null, groupId: null }, select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true } },
                groups: { where: { archivedAt: null }, select: { items: { where: { archivedAt: null }, select: { defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true } } } },
              },
            },
          },
        },
      },
    }),
    // Upcoming tasks (future dates, TASK category, not appointments)
    prisma.followUp.findMany({
      where: {
        companyId: params.companyId,
        category: "TASK",
        completedAt: null,
        dueDate: { gte: new Date(Date.UTC(etY, etM - 1, etD + 1)) },
        NOT: { text: { startsWith: "📅 Appointment" } },
      },
      orderBy: { dueDate: "asc" },
      include: { client: { select: { id: true, name: true } }, lead: { select: { id: true, name: true } } },
    }),
    prisma.client.count({ where: { companyId: params.companyId, status: "ACTIVE" } }),
    prisma.client.count({ where: { companyId: params.companyId, status: "PROSPECT" } }),
    prisma.clientSub.findMany({
      where: { client: { companyId: params.companyId, status: { in: ["ACTIVE"] } } },
      select: { contractAmount: true, scopeItems: { select: { amount: true } }, payments: { select: { amount: true } } },
    }),
    prisma.invoice.findMany({
      where: { companyId: params.companyId, client: { status: "ACTIVE" } },
      select: { amount: true, payments: { select: { amount: true } } },
    }),
  ]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // MIBH Income = sum of (internalProfit + gcFee) across active + completed clients
  const clientIncomeSummaries: ClientIncomeSummary[] = activeClients.map(c => {
    const internalProfit = c.templates.reduce((s, t) => {
      if (t.internalProfitOverride != null) return s + Number(t.internalProfitOverride);
      return s + calcMarkupTotal(t.divisions);
    }, 0);
    const gcFee = c.templates.reduce((s, t) => s + calcGcFeeAmt(t.divisions, t.gcFeePercent), 0);
    const estimateTotal = c.templates.reduce((s, t) => s + calcEstimateTotal(t.divisions, t.gcFeePercent), 0);
    return { id: c.id, name: c.name, status: c.status, estimateTotal, internalProfit, gcFee, mibhIncome: internalProfit + gcFee, companyId: params.companyId };
  });
  const mibhIncome = clientIncomeSummaries.filter(c => c.status === "ACTIVE").reduce((s, c) => s + c.mibhIncome, 0);

  const totalSubsOwed = allClientSubs.reduce((s, sub) => {
    const contractAmt = sub.scopeItems.length > 0
      ? sub.scopeItems.reduce((ss, i) => ss + Number(i.amount), 0)
      : Number(sub.contractAmount);
    const paid = sub.payments.reduce((ps, p) => ps + Number(p.amount), 0);
    return s + Math.max(0, contractAmt - paid);
  }, 0);
  const totalMibhOwed = allClientInvoices.reduce((s, inv) => {
    const paid = inv.payments.reduce((ps, p) => ps + p.amount, 0);
    return s + Math.max(0, inv.amount - paid);
  }, 0);
  const cashFlowWarning = totalSubsOwed > totalMibhOwed;

  // Today's appointments come from the dedicated query (exact date match, works for future dates too)
  const appointments = todayAppointments;

  // Map follow-ups to FollowUpItem shape for each category
  function toItem(f: typeof followUps[number]): FollowUpItem {
    return {
      id: f.id,
      text: f.text,
      audioUrl: f.audioUrl,
      audioMimeType: f.audioMimeType,
      audioSize: f.audioSize,
      clientId: f.clientId,
      clientName: f.client?.name ?? null,
      leadId: f.leadId ?? null,
      leadName: f.lead?.name ?? null,
      completedAt: f.completedAt ? f.completedAt.toISOString() : null,
      createdAt: f.createdAt.toISOString(),
      dueDate: f.dueDate ? f.dueDate.toISOString() : null,
    };
  }

  function toItems(category: "TASK" | "FOLLOW_UP" | "ESTIMATE"): FollowUpItem[] {
    return followUps.filter(f => f.category === category).map(toItem);
  }

  const upcomingTaskItems: FollowUpItem[] = upcomingTasks.map(f => ({
    id: f.id,
    text: f.text,
    audioUrl: f.audioUrl,
    audioMimeType: f.audioMimeType,
    audioSize: f.audioSize,
    clientId: f.clientId,
    clientName: f.client?.name ?? null,
    leadId: f.leadId ?? null,
    leadName: f.lead?.name ?? null,
    completedAt: null,
    createdAt: f.createdAt.toISOString(),
    dueDate: f.dueDate ? f.dueDate.toISOString() : null,
  }));

  return (
    <div className="w-full px-3 sm:px-4 py-2 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between mb-1 gap-1">
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

      {/* Cash flow warning */}
      {cashFlowWarning && (
        <div className="mb-4 rounded-2xl p-5 flex items-start gap-4" style={{ background: "#1a0505", border: "2px solid #dc2626" }}>
          <div className="text-5xl shrink-0 leading-none">🛑</div>
          <div>
            <div className="text-base font-black mb-1 uppercase tracking-wide" style={{ color: "#ef4444" }}>Cash Flow Alert</div>
            <div className="text-sm leading-relaxed" style={{ color: "#fca5a5" }}>
              Your outstanding obligations to subcontractors{" "}
              <strong style={{ color: "#fff" }}>(${totalSubsOwed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</strong>{" "}
              currently exceed what active clients owe MIBH{" "}
              <strong style={{ color: "#fff" }}>(${totalMibhOwed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</strong>.{" "}
              Review your financials and ensure sufficient cash reserves before releasing sub payments.
            </div>
          </div>
        </div>
      )}

      {/* MIBH Income 2026 Barometer */}
      <BarometerSection mibhIncome={mibhIncome} clients={clientIncomeSummaries} />

      {/* Today's Appointments */}
      <AppointmentsCard
        companyId={params.companyId}
        initialAppointments={appointments.map(a => ({ id: a.id, text: a.text, dueDate: a.dueDate ? a.dueDate.toISOString() : null }))}
        initialUpcoming={upcomingAppointments.map(a => ({ id: a.id, text: a.text, dueDate: a.dueDate ? a.dueDate.toISOString() : null }))}
        initialPast={pastAppointments.map(a => ({ id: a.id, text: a.text, dueDate: a.dueDate ? a.dueDate.toISOString() : null }))}
        todayDateStr={etDateStr}
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">

        {/* CLIENTS card — full width, before Leads */}
        <div
          className="col-span-2 lg:col-span-3 rounded-2xl p-3 sm:p-5"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center gap-3">
            <Link href={`/${params.companyId}/clients`} className="flex-1 text-center text-[22px] sm:text-6xl font-black leading-none tracking-tight hover:opacity-80 transition-opacity" style={{ color: "#C9A84C" }}>Clients</Link>
            <Link href={`/${params.companyId}/clients`} className="text-xs px-2 py-0.5 rounded font-medium shrink-0" style={{ border: "1px solid #C9A84C66", color: "#C9A84C" }}>+</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Link
              href={`/${params.companyId}/clients`}
              className="flex flex-col gap-1 p-3 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "#0d1117", border: "1px solid #30373f" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>Active Clients</span>
              <div className="text-[26px] sm:text-3xl font-black leading-none mt-1" style={{ color: activeClientCount > 0 ? "#C9A84C" : "#484f58" }}>{activeClientCount || "—"}</div>
              <div className="text-[11px] mt-1" style={{ color: "#484f58" }}>in production</div>
            </Link>
            <Link
              href={`/${params.companyId}/clients`}
              className="flex flex-col gap-1 p-3 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "#0d1117", border: "1px solid #30373f" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>Prospects</span>
              <div className="text-[26px] sm:text-3xl font-black leading-none mt-1" style={{ color: prospectCount > 0 ? "#58a6ff" : "#484f58" }}>{prospectCount || "—"}</div>
              <div className="text-[11px] mt-1" style={{ color: "#484f58" }}>in pipeline</div>
            </Link>
          </div>
        </div>

        {/* LEADS card — full width */}
        <div
          className="col-span-2 lg:col-span-3 rounded-2xl p-4 sm:p-5"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center text-[52px] sm:text-6xl font-black leading-none tracking-tight" style={{ color: "#C9A84C" }}>Leads</div>
            <AddLeadButton companyId={params.companyId} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <Link
              href={`/${params.companyId}/leads`}
              className="flex flex-col gap-1 p-3 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "#0d1117", border: `1px solid ${untriaged > 0 ? "#ef444433" : "#30373f"}` }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>Triaging</span>
              <div className="text-[26px] sm:text-3xl font-black leading-none mt-1" style={{ color: untriaged > 0 ? "#ef4444" : "#e6edf3" }}>{untriaged}</div>
              <div className="text-[11px] mt-1" style={{ color: "#484f58" }}>need pipeline stage</div>
            </Link>
            <Link
              href={`/${params.companyId}/leads`}
              className="flex flex-col gap-1 p-3 rounded-xl transition-opacity hover:opacity-80"
              style={{ background: "#0d1117", border: "1px solid #30373f" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>New leads</span>
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

        {/* SUBS card — full width, after Leads */}
        <Link
          href={`/${params.companyId}/subs`}
          className="col-span-2 lg:col-span-3 rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.99]"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="flex-1 text-center text-[52px] sm:text-6xl font-black leading-none tracking-tight" style={{ color: "#C9A84C" }}>Subcontractors</span>
            <span className="text-xs px-2 py-0.5 rounded font-medium shrink-0" style={{ border: "1px solid #C9A84C66", color: "#C9A84C" }}>+</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span className="text-[11px]" style={{ color: "#484f58" }}>By division · copy emails</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#1e2736", color: "#58a6ff", border: "1px solid #58a6ff33" }}>Divisions</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#1e2736", color: "#22c55e", border: "1px solid #22c55e33" }}>Emails</span>
          </div>
        </Link>

        {/* Today's Tasks */}
        <TodayTaskCard
          companyId={params.companyId}
          category="TASK"
          label="Mike's tasks"
          initialItems={toItems("TASK")}
          initialUpcoming={upcomingTaskItems}
          clients={clients}
          leads={leads}
        />

        {/* Pending Countersignatures */}
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
