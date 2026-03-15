import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SyncLeadsButton from "@/components/today/SyncLeadsButton";
import LeadCard from "@/components/leads/LeadCard";

export default async function LeadsPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const leads = await prisma.lead.findMany({
    where: { companyId: params.companyId },
    orderBy: { receivedAt: "desc" },
  });

  const newCount = leads.filter(l => l.status === "NEW").length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#e6edf3" }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
            {leads.length} total · {newCount} new
          </p>
        </div>
        <SyncLeadsButton companyId={params.companyId} />
      </div>

      {leads.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-4xl mb-4">🎯</p>
          <p className="text-sm" style={{ color: "#8b949e" }}>
            No leads yet. Click &quot;Backfill All&quot; to import from Gmail.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} companyId={params.companyId} />
          ))}
        </div>
      )}
    </div>
  );
}
