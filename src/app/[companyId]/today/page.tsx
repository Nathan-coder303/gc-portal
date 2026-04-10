import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SyncLeadsButton from "@/components/today/SyncLeadsButton";
import SyncBidsButton from "@/components/today/SyncBidsButton";
import TodayLeadCard from "@/components/leads/TodayLeadCard";
import TodayTaskCard, { FollowUpItem } from "@/components/today/TodayTaskCard";
import TodayCallsSection from "@/components/today/TodayCallsSection";
import PendingCountersignsCard from "@/components/today/PendingCountersignsCard";
import CountersignAlert from "@/components/today/CountersignAlert";

const GOAL_2026 = 5_000_000;

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

  const [todayLeads, allLeadsCount, estimatesToSend, followUps, clients, urgentLeads, untriaged, pendingCountersigns, activeClients] = await Promise.all([
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
    // Active clients with template data for MIBH Income barometer
    prisma.client.findMany({
      where: { companyId: params.companyId, status: "ACTIVE" },
      include: {
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

  // Compute MIBH Income barometer (use internalProfit: override if set, else auto markup total)
  const activeInternalProfitTotal = activeClients.reduce((sum, c) => sum + c.templates.reduce((s, t) => {
    if (t.internalProfitOverride != null) return s + Number(t.internalProfitOverride);
    return s + calcMarkupTotal(t.divisions);
  }, 0), 0);
  const activeTotalFallback = activeClients.reduce((sum, c) => sum + c.templates.reduce((s, t) => s + calcEstimateTotal(t.divisions, t.gcFeePercent), 0), 0);
  const mibhIncome = activeInternalProfitTotal > 0 ? activeInternalProfitTotal : activeTotalFallback;
  const goalPct = Math.min(100, (mibhIncome / GOAL_2026) * 100);

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>
            Today&apos;s Overview
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>
            {today}
          </p>
        </div>
        <div className="flex items-start gap-3 shrink-0">
          <SyncBidsButton companyId={params.companyId} />
          <SyncLeadsButton companyId={params.companyId} />
        </div>
      </div>

      {/* MIBH Income 2026 Barometer */}
      <div className="mt-6 mb-6 rounded-2xl px-6 py-5" style={{ background: "#0a1a0f", border: "1px solid #22c55e33" }}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#22c55e88" }}>MIBH Income 2026</div>
            <div className="text-5xl font-black leading-none" style={{ color: "#22c55e" }}>
              ${mibhIncome.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#8b949e" }}>Goal 2026</div>
            <div className="text-2xl font-bold" style={{ color: "#8b949e" }}>$5,000,000</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: "#22c55e" }}>{goalPct.toFixed(1)}% there</div>
          </div>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 18, background: "#1a2a1a", border: "1px solid #22c55e22" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(goalPct, 0.5)}%`,
              background: goalPct >= 100 ? "#C9A84C" : "linear-gradient(90deg, #16a34a, #22c55e)",
              minWidth: 4,
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs" style={{ color: "#22c55e88" }}>{activeClients.length} active client{activeClients.length !== 1 ? "s" : ""}</span>
          <span className="text-xs" style={{ color: "#8b949e" }}>${(GOAL_2026 - mibhIncome).toLocaleString("en-US", { maximumFractionDigits: 0 })} remaining</span>
        </div>
      </div>

      {/* Pending countersign alert — click to sign directly */}
      <CountersignAlert
        companyId={params.companyId}
        estimates={pendingCountersigns.map(est => ({
          id: est.id,
          name: est.name,
          estimateNumber: est.estimateNumber ?? null,
          signedAt: est.signedAt!.toISOString(),
          signedByName: est.signedByName ?? null,
          clientName: est.client?.name ?? null,
          clientId: est.client?.id ?? null,
        }))}
      />

      {/* Untriaged leads alert */}
      {untriaged > 0 && (
        <Link
          href={`/${params.companyId}/leads`}
          className="flex items-center justify-between gap-3 mb-5 px-4 py-3 rounded-xl transition-all hover:scale-[1.01]"
          style={{ background: "#2d1a1a", border: "1px solid #ef444455" }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 18 }}>🎯</span>
            <div>
              <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                {untriaged} lead{untriaged > 1 ? "s" : ""} need{untriaged === 1 ? "s" : ""} triaging
              </span>
              <span className="text-xs ml-2" style={{ color: "#8b949e" }}>
                Drag them into the pipeline stages
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>Go to Leads →</span>
        </Link>
      )}

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
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                {todayLeads.length} today
              </span>
              <Link
                href={`/${params.companyId}/leads`}
                className="text-xs font-medium hover:underline"
                style={{ color: "#58a6ff" }}
              >
                View →
              </Link>
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
        </div>

        {/* Card 2 — Estimates to be Sent Today */}
        <Link
          href={`/${params.companyId}/estimates`}
          className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-[#C9A84C55] hover:scale-[1.01] block"
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
                  <span className="text-sm font-medium" style={{ color: "#58a6ff" }}>{est.name}</span>
                  <div className="text-xs" style={{ color: "#8b949e" }}>{est.project.name}</div>
                </li>
              ))}
            </ul>
          )}
        </Link>

        {/* Card 3 — Today's Tasks */}
        <TodayTaskCard
          companyId={params.companyId}
          category="TASK"
          label="Today's Tasks"
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
          label="Estimate Notes"
          initialItems={toItems("ESTIMATE")}
          clients={clients}
        />

        {/* Card 7 — Sub Database */}
        <Link
          href={`/${params.companyId}/subs`}
          className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-[#C9A84C55] hover:scale-[1.01] block"
          style={{ background: "#161b22", border: "1px solid #30373f" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b949e" }}>
              Sub Database
            </span>
            <span className="text-xs" style={{ color: "#C9A84C" }}>Open →</span>
          </div>
          <div className="mt-1">
            <div className="text-2xl font-black" style={{ color: "#e6edf3" }}>Subs & Emails</div>
            <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
              All subcontractors by division. Click to view and copy emails for new projects.
            </p>
          </div>
          <div className="mt-auto pt-2 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1e2736", color: "#58a6ff", border: "1px solid #58a6ff33" }}>By Division</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1e2736", color: "#22c55e", border: "1px solid #22c55e33" }}>Copy Emails</span>
          </div>
        </Link>

        {/* Card 8 — To Call ASAP (full-width) */}
        <div className="sm:col-span-2 lg:col-span-3">
          <TodayCallsSection
            companyId={params.companyId}
            initialLeads={urgentLeads.map(c => ({
              id: c.id,
              displayName: c.displayName,
              estimateValue: c.estimateValue ? Number(c.estimateValue) : null,
              notes: c.notes,
              clientId: c.clientId,
              clientName: c.client?.name ?? null,
              phone: c.lead?.phone ?? c.client?.phone ?? null,
              createdAt: c.createdAt.toISOString(),
            }))}
          />
        </div>
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
