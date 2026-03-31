import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectPipeline from "@/components/leads/ProjectPipeline";

export default async function ProjectPipelinePage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const activeClients = await prisma.client.findMany({
    where: { companyId: params.companyId, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true },
  });

  const cards = await prisma.pipelineCard.findMany({
    where: { companyId: params.companyId, pipelineType: "project" },
    orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
    include: { client: { select: { id: true, name: true, email: true } } },
  });

  const initialCards = cards.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    stage: c.stage,
    source: c.source,
    estimateValue: c.estimateValue ? Number(c.estimateValue) : null,
    notes: c.notes,
    clientId: c.clientId,
    clientName: c.client?.name ?? null,
    clientEmail: c.client?.email ?? null,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Projects Pipeline</h1>
        <p className="text-sm mt-1" style={{ color: "#8b949e" }}>
          {cards.length} active project{cards.length !== 1 ? "s" : ""} · Notes notify clients by email
        </p>
      </div>
      <ProjectPipeline companyId={params.companyId} initialCards={initialCards} activeClients={activeClients} />
    </div>
  );
}
