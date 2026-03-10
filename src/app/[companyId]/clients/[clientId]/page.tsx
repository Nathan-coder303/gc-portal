import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { initClientSubBids } from "../actions";
import SubsBidsTab, { SubBidRow } from "@/components/clients/SubsBidsTab";
import ClientBidTab from "@/components/clients/ClientBidTab";
import { can } from "@/lib/auth/permissions";

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

  // Load sub bids for subs-bids and client-bid tabs
  let subBids: SubBidRow[] = [];
  if (activeTab === "subs-bids" || activeTab === "client-bid") {
    // Ensure all 14 division records exist
    await initClientSubBids(params.clientId, params.companyId);

    const raw = await prisma.subBid.findMany({
      where: { clientId: params.clientId },
      orderBy: { divisionCode: "asc" },
    });
    subBids = raw.map((b) => ({
      id: b.id,
      divisionCode: b.divisionCode,
      divisionName: b.divisionName,
      contractorName: b.contractorName,
      amount: b.amount !== null ? Number(b.amount) : null,
      notes: b.notes,
      fileUrl: b.fileUrl,
      fileName: b.fileName,
      status: b.status,
    }));
  }

  function calcEstimateTotal(divisions: typeof safeClient.templates[0]["divisions"]): number {
    return divisions.reduce((sum, div) => {
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
  }

  function fmt(n: number) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const tabs = [
    { key: "estimates", label: "Estimates" },
    { key: "subs-bids", label: "Subs Bids" },
    { key: "client-bid", label: "Client Bid" },
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
              {safeClient.address}
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
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>
              Estimates
            </h2>
            <span className="text-sm" style={{ color: "#8b949e" }}>
              {safeClient.templates.length} estimate{safeClient.templates.length !== 1 ? "s" : ""}
            </span>
          </div>

          {safeClient.templates.length === 0 ? (
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: "#1e2736", border: "1px solid #30373f" }}
            >
              <p className="text-sm" style={{ color: "#8b949e" }}>
                No estimates yet.
              </p>
              <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
                Open a template and use &quot;Save to Client&quot; to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeClient.templates.map((est) => {
                const total = calcEstimateTotal(est.divisions);
                return (
                  <Link
                    key={est.id}
                    href={`/${params.companyId}/estimates/${est.id}`}
                    className="rounded-xl p-4 flex items-center justify-between transition-all group block"
                    style={{ background: "#1e2736", border: "1px solid #30373f" }}
                  >
                    <div>
                      <div
                        className="font-semibold transition-colors group-hover:text-[#C9A84C]"
                        style={{ color: "#e6edf3" }}
                      >
                        {est.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                        Created {format(est.createdAt, "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>
                        ${fmt(total)}
                      </span>
                      <span className="text-lg transition-colors" style={{ color: "#8b949e" }}>
                        →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "subs-bids" && (
        <SubsBidsTab
          clientId={params.clientId}
          companyId={params.companyId}
          subBids={subBids}
          canEdit={canEdit}
        />
      )}

      {activeTab === "client-bid" && (
        <ClientBidTab subBids={subBids} clientName={safeClient.name} />
      )}
    </div>
  );
}
