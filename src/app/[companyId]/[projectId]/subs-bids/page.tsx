import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { initClientSubBids } from "@/app/[companyId]/clients/actions";
import SubsBidsTab, { SubBidRow } from "@/components/clients/SubsBidsTab";
import SyncLabelBidsButton from "@/components/clients/SyncLabelBidsButton";
import { can } from "@/lib/auth/permissions";

function groupBids(raw: { id: string; divisionCode: string; divisionName: string; contractorName: string | null; amount: unknown; notes: string | null; fileUrl: string | null; fileName: string | null; status: string; isPlaceholder: boolean }[]): SubBidRow[] {
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
  return Array.from(map.values()).sort((a, b) => a.divisionCode.localeCompare(b.divisionCode));
}

export default async function ProjectSubsBidsPage({
  params,
}: {
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, companyId: params.companyId },
  });
  if (!project) redirect(`/${params.companyId}/projects`);

  const client = await prisma.client.findFirst({
    where: {
      companyId: params.companyId,
      address: { contains: (project.address ?? "").split(" ").slice(0, 3).join(" "), mode: "insensitive" },
    },
  });

  if (!client) {
    return (
      <div className="rounded-xl p-10 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
        <p className="text-sm font-semibold" style={{ color: "#e6edf3" }}>No client linked to this project.</p>
        <p className="text-xs mt-2" style={{ color: "#8b949e" }}>
          Create a client with address <strong style={{ color: "#C9A84C" }}>{project.address}</strong> to track sub bids.
        </p>
      </div>
    );
  }

  await initClientSubBids(client.id, params.companyId);

  const raw = await prisma.subBid.findMany({
    where: { clientId: client.id, status: { not: "EXCLUDED" } },
    orderBy: { createdAt: "asc" },
  });

  const subBids = groupBids(raw);
  const canEdit = can(session.user.role, "estimate:create");
  const canDelete = session.user.role === "ADMIN";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#e6edf3" }}>Subs Bids</h2>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>Client: {client.name}</p>
        </div>
        <SyncLabelBidsButton companyId={params.companyId} clientId={client.id} />
      </div>
      <SubsBidsTab
        clientId={client.id}
        companyId={params.companyId}
        clientName={client.name}
        clientAddress={[client.address, client.city, client.state].filter(Boolean).join(", ")}
        subBids={subBids}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
