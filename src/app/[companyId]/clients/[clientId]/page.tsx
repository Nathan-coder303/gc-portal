import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { initClientSubBids } from "../actions";
import SubsBidsTab, { SubBidRow } from "@/components/clients/SubsBidsTab";
import ClientBidTab from "@/components/clients/ClientBidTab";
import { can } from "@/lib/auth/permissions";
import ClientFilesTab from "@/components/clients/ClientFilesTab";
import CollapsibleEstimateList from "@/components/clients/CollapsibleEstimateList";
import ClientDetailHeader from "@/components/clients/ClientDetailHeader";
import ClientNotesTab from "@/components/clients/ClientNotesTab";
import ClientTextNotes from "@/components/clients/ClientTextNotes";
import ClientInvoicesTab from "@/components/clients/ClientInvoicesTab";
import NurturingEmailTab from "@/components/clients/NurturingEmailTab";
import ChangeOrdersTab from "@/components/clients/ChangeOrdersTab";
import ClientScheduleTab from "@/components/clients/ClientScheduleTab";
import TodayTaskCard, { FollowUpItem } from "@/components/today/TodayTaskCard";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { companyId: string; clientId: string };
  searchParams: { tab?: string; commercial?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const activeTab = searchParams.tab ?? "estimates";

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    include: {
      templates: {
        where: { type: "CLIENT_ESTIMATE", archivedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          divisions: {
            where: { archivedAt: null },
            include: {
              items: { where: { archivedAt: null, groupId: null } },
              groups: { where: { archivedAt: null }, include: { items: { where: { archivedAt: null } } } },
            },
          },
        },
      },
    },
  });

  if (!client) redirect(`/${params.companyId}/clients`);

  const safeClient = client!;
  const canEdit = can(session.user.role, "estimate:create");
  const canDelete = session.user.role === "ADMIN";

  const isCommercial = safeClient.isCommercial;

  // Load sub bids for subs-bids and client-bid tabs
  let subBids: SubBidRow[] = [];
  if (activeTab === "subs-bids" || activeTab === "client-bid") {
    await initClientSubBids(params.clientId, params.companyId, isCommercial);
    const raw = await prisma.subBid.findMany({
      where: { clientId: params.clientId, status: { not: "EXCLUDED" } },
      orderBy: { createdAt: "asc" },
    });
    const map = new Map<string, SubBidRow>();
    for (const b of raw) {
      if (!map.has(b.divisionCode)) {
        map.set(b.divisionCode, { divisionCode: b.divisionCode, divisionName: b.divisionName, offers: [] });
      }
      map.get(b.divisionCode)!.offers.push({
        id: b.id,
        contractorName: b.contractorName,
        amount: b.amount !== null ? Number(b.amount) : null,
        notes: b.notes,
        fileUrl: b.fileUrl,
        fileName: b.fileName,
        status: b.status,
        isPlaceholder: b.isPlaceholder,
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : new Date(0).toISOString(),
        bidDate: b.bidDate ?? null,
        emailSource: b.emailSource ?? null,
      });
    }
    subBids = Array.from(map.values()).sort((a, b) => a.divisionCode.localeCompare(b.divisionCode));
  }

  function calcEstimateTotal(divisions: typeof safeClient.templates[0]["divisions"], gcFeePercent: typeof safeClient.templates[0]["gcFeePercent"]): number {
    const raw = divisions.reduce((sum, div) => {
      const allItems = [...div.items, ...div.groups.flatMap((g) => g.items)];
      return (
        sum +
        allItems.reduce((s, i) => {
          const qty = i.defaultQty ? Number(i.defaultQty) : 0;
          const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
          const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
          return s + qty * cost * (1 + markup / 100);
        }, 0)
      );
    }, 0);
    const fee = gcFeePercent ? raw * Number(gcFeePercent) / 100 : 0;
    return raw + fee;
  }

  const clientFiles = await prisma.clientFile.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { uploadedAt: "desc" },
  });
  const hasInsertFile = clientFiles.some(f => f.useInEstimate);

  const clientNotes = await prisma.clientNote.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { createdAt: "desc" },
  });

  const [clientFollowUps, clientInvoices, changeOrders, clientScheduleTasks] = await Promise.all([
    prisma.followUp.findMany({
      where: { clientId: params.clientId, companyId: params.companyId },
      orderBy: { createdAt: "asc" },
      include: { client: { select: { id: true, name: true } }, lead: { select: { id: true, name: true } } },
    }),
    prisma.invoice.findMany({
      where: { clientId: params.clientId, companyId: params.companyId },
      orderBy: { createdAt: "asc" },
      include: { payments: { orderBy: { paidDate: "asc" } } },
    }),
    prisma.changeOrder.findMany({
      where: { clientId: params.clientId, companyId: params.companyId },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.clientTask.findMany({
      where: { clientId: params.clientId, companyId: params.companyId },
      orderBy: [{ phase: "asc" }, { startDate: "asc" }],
    }),
  ]);

  const followUpCount = clientFollowUps.length;
  const tabs = [
    { key: "estimates", label: "Estimates" },
    { key: "tasks", label: `Tasks${followUpCount > 0 ? ` (${followUpCount})` : ""}` },
    { key: "schedule", label: `Schedule${clientScheduleTasks.length > 0 ? ` (${clientScheduleTasks.length})` : ""}` },
    { key: "change-orders", label: `Change Orders${changeOrders.length > 0 ? ` (${changeOrders.length})` : ""}` },
    { key: "invoices", label: `Invoices${clientInvoices.length > 0 ? ` (${clientInvoices.length})` : ""}` },
    { key: "notes", label: `Notes${clientNotes.length > 0 ? ` (${clientNotes.length})` : ""}` },
    // { key: "subs-bids", label: "Build an Estimate" },  // hidden per user request
    // { key: "client-bid", label: "Client Bid" },        // hidden per user request
    { key: "files", label: `Files${clientFiles.length > 0 ? ` (${clientFiles.length})` : ""}` },
    { key: "nurturing", label: "Nurturing" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <a
        href={`/${params.companyId}/clients`}
        className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
        style={{ background: "#1e2736", border: "1px solid #30373f", color: "#C9A84C" }}
      >
        <span style={{ fontSize: 16 }}>←</span> Clients
      </a>
      <ClientDetailHeader
        client={{
          id: safeClient.id,
          name: safeClient.name,
          address: safeClient.address ?? null,
          city: safeClient.city ?? null,
          state: safeClient.state ?? null,
          zip: safeClient.zip ?? null,
          email: safeClient.email ?? null,
          phone: safeClient.phone ?? null,
        }}
        estimateCount={safeClient.templates.length}
        estimateTotal={safeClient.templates.reduce((sum, est) => sum + calcEstimateTotal(est.divisions, est.gcFeePercent), 0)}
        canEdit={canEdit}
        paymentSummary={(() => {
          const totalInvoiced = clientInvoices.reduce((s, inv) => s + inv.amount, 0);
          const totalPaid = clientInvoices.reduce((s, inv) => s + inv.payments.reduce((ps, p) => ps + p.amount, 0), 0);
          return totalInvoiced > 0 ? { totalInvoiced, totalPaid, balance: totalInvoiced - totalPaid } : null;
        })()}
      />

      {/* PDF Cover Photo selector hidden — covered by PDF options modal */}
      {/* <ClientCoverPhotoSelector
        clientId={safeClient.id}
        companyId={params.companyId}
        initialType={safeClient.coverPhotoType ?? null}
        initialUrl={safeClient.coverPhotoUrl ?? null}
        initialTitle={safeClient.coverTitle ?? null}
      /> */}


      {/* Tab bar — wraps on mobile so all tabs are visible without scrolling */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/${params.companyId}/clients/${params.clientId}?tab=${tab.key}`}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
              style={
                isActive
                  ? { background: "#C9A84C", color: "#0d1117" }
                  : { background: "transparent", color: "#8b949e", border: "1px solid #30373f" }
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "tasks" && (() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const toItem = (f: typeof clientFollowUps[0]): FollowUpItem => ({
          id: f.id,
          text: f.text,
          audioUrl: f.audioUrl,
          audioMimeType: f.audioMimeType,
          audioSize: f.audioSize,
          clientId: f.clientId,
          clientName: f.client?.name ?? null,
          leadId: f.leadId,
          leadName: f.lead?.name ?? null,
          completedAt: f.completedAt ? f.completedAt.toISOString() : null,
          createdAt: f.createdAt.toISOString(),
          dueDate: f.dueDate ? f.dueDate.toISOString().slice(0, 10) : null,
        });
        const todayItems = clientFollowUps.filter(f => !f.dueDate || f.dueDate.toISOString().slice(0, 10) <= todayStr).map(toItem);
        const upcomingItems = clientFollowUps.filter(f => f.dueDate && f.dueDate.toISOString().slice(0, 10) > todayStr).map(toItem);
        return (
          <TodayTaskCard
            companyId={params.companyId}
            category="TASK"
            label="Tasks"
            initialItems={todayItems}
            initialUpcoming={upcomingItems}
            clients={[{ id: safeClient.id, name: safeClient.name }]}
            leads={[]}
          />
        );
      })()}

      {activeTab === "estimates" && (
        <CollapsibleEstimateList
          estimates={safeClient.templates.map(est => ({
            id: est.id,
            name: est.name,
            estimateNumber: est.estimateNumber ?? null,
            description: est.description ?? null,
            estimateDate: est.estimateDate ?? null,
            sqFt: est.sqFt ? Number(est.sqFt) : null,
            durationMonths: est.durationMonths ? Number(est.durationMonths) : null,
            hasSkylights: est.hasSkylights,
            hasRoofDrains: est.hasRoofDrains,
            createdAt: est.createdAt.toISOString(),
            lastSentAt: est.lastSentAt?.toISOString() ?? null,
            signedAt: est.signedAt?.toISOString() ?? null,
            signedByName: est.signedByName ?? null,
            counterSignedAt: est.counterSignedAt?.toISOString() ?? null,
            total: calcEstimateTotal(est.divisions, est.gcFeePercent),
          }))}
          companyId={params.companyId}
          clientId={params.clientId}
          clientName={safeClient.name}
          clientEmail={safeClient.email}
          clientAddress={safeClient.address ?? null}
          canEdit={canEdit}
          canDelete={canDelete}
          isCommercial={isCommercial}
          clientCoverPhotoType={safeClient.coverPhotoType ?? null}
          clientCoverPhotoUrl={safeClient.coverPhotoType === "CUSTOM" ? `/api/${params.companyId}/clients/${params.clientId}/cover` : null}
          hasInsertFile={hasInsertFile}
        />
      )}

      {activeTab === "schedule" && (
        <ClientScheduleTab
          companyId={params.companyId}
          clientId={params.clientId}
          canEdit={canEdit}
          initialTasks={clientScheduleTasks.map(t => ({
            id: t.id,
            phase: t.phase,
            name: t.name,
            durationDays: t.durationDays,
            startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
            endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
            predecessorIds: t.predecessorIds,
            parentId: t.parentId,
            trade: t.trade,
            assignee: t.assignee,
            isMilestone: t.isMilestone,
            status: t.status,
            percentComplete: t.percentComplete,
            notes: t.notes,
          }))}
        />
      )}

      {activeTab === "change-orders" && (
        <ChangeOrdersTab
          companyId={params.companyId}
          clientId={params.clientId}
          canEdit={canEdit}
          initialOrders={changeOrders.map(co => ({
            id: co.id,
            title: co.title,
            orderNumber: co.orderNumber,
            status: co.status,
            notes: co.notes,
            createdAt: co.createdAt.toISOString(),
            items: co.items.map(it => ({
              id: it.id,
              csiCode: it.csiCode,
              divisionName: it.divisionName,
              name: it.name,
              description: it.description,
              qty: it.qty != null ? String(it.qty) : null,
              unit: it.unit,
              unitCost: it.unitCost != null ? String(it.unitCost) : null,
              markupPct: it.markupPct != null ? String(it.markupPct) : null,
              sortOrder: it.sortOrder,
            })),
          }))}
        />
      )}

      {activeTab === "invoices" && (
        <ClientInvoicesTab
          companyId={params.companyId}
          clientId={params.clientId}
          clientName={safeClient.name}
          clientEmail={safeClient.email ?? null}
          estimates={safeClient.templates.map((est) => ({
            id: est.id,
            name: est.name,
            estimateNumber: est.estimateNumber ?? null,
            paymentSchedule: est.paymentSchedule as { payment: string; trigger: string; pct: number }[] | null,
            total: calcEstimateTotal(est.divisions, est.gcFeePercent),
          }))}
          initialInvoices={clientInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            estimateId: inv.estimateId,
            phase: inv.phase,
            trigger: inv.trigger,
            pct: inv.pct,
            amount: inv.amount,
            status: inv.status,
            dueDate: inv.dueDate?.toISOString() ?? null,
            notes: inv.notes,
            sentAt: inv.sentAt?.toISOString() ?? null,
            paidAt: inv.paidAt?.toISOString() ?? null,
            createdAt: inv.createdAt.toISOString(),
            payments: inv.payments.map(p => ({
              id: p.id,
              amount: p.amount,
              method: p.method,
              paidDate: p.paidDate.toISOString(),
              notes: p.notes,
            })),
          }))}
        />
      )}

      {activeTab === "notes" && (
        <>
        <ClientTextNotes
          companyId={params.companyId}
          clientId={params.clientId}
          clientName={safeClient.name}
          clientAddress={safeClient.address ?? null}
          clientEmail={safeClient.email ?? null}
        />
        <ClientNotesTab
          companyId={params.companyId}
          clientId={params.clientId}
          initialNotes={clientNotes.map(n => ({
            id: n.id,
            transcription: n.transcription,
            audioUrl: n.audioUrl,
            audioMimeType: n.audioMimeType,
            audioSize: n.audioSize,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
        </>
      )}

      {activeTab === "subs-bids" && (
        <div>
          <SubsBidsTab
            key={isCommercial ? "commercial" : "residential"}
            clientId={params.clientId}
            companyId={params.companyId}
            subBids={subBids}
            canEdit={canEdit}
            canDelete={canDelete}
            isCommercial={isCommercial}

          />
        </div>
      )}

      {activeTab === "client-bid" && (
        <ClientBidTab subBids={subBids} clientName={safeClient.name} />
      )}

      {activeTab === "nurturing" && (
        <NurturingEmailTab
          companyId={params.companyId}
          clientId={params.clientId}
          clientName={safeClient.name}
          clientEmail={safeClient.email ?? null}
        />
      )}

      {activeTab === "files" && (
        <ClientFilesTab
          companyId={params.companyId}
          clientId={params.clientId}
          initialFiles={clientFiles.map(f => ({
            id: f.id,
            fileName: f.fileName,
            fileUrl: `/api/${params.companyId}/clients/${params.clientId}/files/${f.id}`,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
            uploadedAt: f.uploadedAt.toISOString(),
            useInEstimate: f.useInEstimate,
          }))}
        />
      )}
    </div>
  );
}
