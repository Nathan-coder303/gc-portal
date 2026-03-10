import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { initClientSubBids } from "@/app/[companyId]/clients/actions";
import SubsBidsTab, { SubBidRow } from "@/components/clients/SubsBidsTab";
import { can } from "@/lib/auth/permissions";

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

  // Find client linked to this project by matching address
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
    where: { clientId: client.id },
    orderBy: { divisionCode: "asc" },
  });

  const subBids: SubBidRow[] = raw.map((b) => ({
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

  const canEdit = can(session.user.role, "estimate:create");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#e6edf3" }}>Subs Bids</h2>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>Client: {client.name}</p>
        </div>
      </div>
      <SubsBidsTab clientId={client.id} companyId={params.companyId} subBids={subBids} canEdit={canEdit} />
    </div>
  );
}
