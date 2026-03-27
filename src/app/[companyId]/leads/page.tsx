import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SyncLeadsButton from "@/components/today/SyncLeadsButton";
import SyncFyrdButton from "@/components/leads/SyncFyrdButton";
import LeadsPipeline from "@/components/leads/LeadsPipeline";

export default async function LeadsPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const [leads, pipelineCards] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId: params.companyId },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.pipelineCard.findMany({
      where: { companyId: params.companyId },
      include: {
        lead: { select: { id: true } },
      },
    }),
  ]);

  // Set of lead IDs already in pipeline
  const inPipelineLeadIds = new Set(
    pipelineCards.filter((c) => c.leadId).map((c) => c.leadId as string)
  );

  const triageLeads = leads
    .filter((l) => !inPipelineLeadIds.has(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name ?? "Unknown",
      email: l.email,
      phone: l.phone,
      projectType: l.projectType,
      receivedAt: l.receivedAt.toISOString(),
      status: l.status,
    }));

  const stagedCards = pipelineCards
    .filter((c) => c.leadId)
    .map((c) => ({
      id: c.id,
      displayName: c.displayName,
      stage: c.stage,
      source: c.source,
      estimateValue: c.estimateValue ? Number(c.estimateValue) : null,
      notes: c.notes,
      leadId: c.leadId,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt.toISOString(),
    }));

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>
            Sales Pipeline
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8b949e" }}>
            {leads.length} total · {triageLeads.length} need triaging
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <SyncFyrdButton companyId={params.companyId} />
          <SyncLeadsButton companyId={params.companyId} />
        </div>
      </div>

      <LeadsPipeline
        companyId={params.companyId}
        triageLeads={triageLeads}
        stagedCards={stagedCards}
      />
    </div>
  );
}
