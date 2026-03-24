import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { initClientSubBids } from "../actions";
import SubsBidsTab, { SubBidRow } from "@/components/clients/SubsBidsTab";
import ClientBidTab from "@/components/clients/ClientBidTab";
import { can } from "@/lib/auth/permissions";
import SyncLabelBidsButton from "@/components/clients/SyncLabelBidsButton";
import ClientFilesTab from "@/components/clients/ClientFilesTab";
import CollapsibleEstimateList from "@/components/clients/CollapsibleEstimateList";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { companyId: string; clientId: string };
  searchParams: { tab?: string };
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

  // Load sub bids for subs-bids and client-bid tabs
  let subBids: SubBidRow[] = [];
  if (activeTab === "subs-bids" || activeTab === "client-bid") {
    await initClientSubBids(params.clientId, params.companyId);
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

  const tabs = [
    { key: "estimates", label: "Estimates" },
    { key: "subs-bids", label: "Subs Bids" },
    { key: "client-bid", label: "Client Bid" },
    { key: "files", label: `Files${clientFiles.length > 0 ? ` (${clientFiles.length})` : ""}` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      {/* Client info card */}
      <div className="rounded-xl p-5 mb-6" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>
          {safeClient.name}
        </h1>
        <div className="flex flex-wrap gap-3 mt-2">
          {safeClient.address && (
            <span className="text-sm" style={{ color: "#8b949e" }}>
              {[safeClient.address, safeClient.city, safeClient.state, safeClient.zip].filter(Boolean).join(", ")}
            </span>
          )}
          {safeClient.email && (
            <span className="text-sm" style={{ color: "#8b949e" }}>
              {safeClient.email}
            </span>
          )}
          {safeClient.phone && (
            <span className="text-sm" style={{ color: "#8b949e" }}>
              {safeClient.phone}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/${params.companyId}/clients/${params.clientId}?tab=${tab.key}`}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
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
        />
      )}

      {activeTab === "subs-bids" && (
        <div>
          <div className="flex justify-end mb-3">
            <SyncLabelBidsButton companyId={params.companyId} clientId={params.clientId} />
          </div>
          <SubsBidsTab
            clientId={params.clientId}
            companyId={params.companyId}
            subBids={subBids}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      )}

      {activeTab === "client-bid" && (
        <ClientBidTab subBids={subBids} clientName={safeClient.name} />
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
