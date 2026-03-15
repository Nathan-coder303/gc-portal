import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SyncLeadsButton from "@/components/today/SyncLeadsButton";
import LeadTime from "@/components/today/LeadTime";

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
          <p className="text-sm" style={{ color: "#8b949e" }}>No leads yet. Click &quot;Backfill All&quot; to import from Gmail.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {leads.map((lead) => {
            const isNew = lead.status === "NEW";
            return (
              <div
                key={lead.id}
                className="rounded-xl p-5 flex flex-col gap-3 relative"
                style={{
                  background: "#161b22",
                  border: isNew ? "1px solid #C9A84C55" : "1px solid #30373f",
                }}
              >
                {/* Status badge */}
                {isNew && (
                  <span
                    className="absolute top-4 right-4 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: "#C9A84C", color: "#0d1117" }}
                  >
                    New
                  </span>
                )}

                {/* Name */}
                <div>
                  <h3
                    className="text-lg font-bold leading-tight pr-12"
                    style={{ color: "#e6edf3", fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    {lead.name ?? "Unknown"}
                  </h3>
                  {lead.projectType && (
                    <span
                      className="inline-block mt-1 text-xs px-2 py-0.5 rounded"
                      style={{ background: "#1e2736", color: "#C9A84C", border: "1px solid #C9A84C33" }}
                    >
                      {lead.projectType}
                    </span>
                  )}
                </div>

                {/* Contact details */}
                <div className="space-y-1.5">
                  {lead.email && (
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#484f58" }}>✉</span>
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-sm hover:underline"
                        style={{ color: "#58a6ff" }}
                      >
                        {lead.email}
                      </a>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#484f58" }}>📞</span>
                      <a
                        href={`tel:${lead.phone}`}
                        className="text-sm hover:underline"
                        style={{ color: "#e6edf3" }}
                      >
                        {lead.phone}
                      </a>
                    </div>
                  )}
                  {(lead.address || lead.city || lead.state) && (
                    <div className="flex items-start gap-2">
                      <span style={{ color: "#484f58" }}>📍</span>
                      <span className="text-sm" style={{ color: "#8b949e" }}>
                        {[lead.address, lead.city, lead.state].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Message */}
                {lead.message && (
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "#8b949e", borderTop: "1px solid #21262d", paddingTop: "10px" }}
                  >
                    {lead.message.slice(0, 200)}{lead.message.length > 200 ? "…" : ""}
                  </p>
                )}

                {/* Date */}
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span className="text-xs" style={{ color: "#484f58" }}>
                    <LeadTime iso={lead.receivedAt.toISOString()} />
                  </span>
                  <span className="text-xs" style={{ color: "#484f58" }}>via email</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
