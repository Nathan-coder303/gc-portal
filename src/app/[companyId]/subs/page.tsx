import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SubsPageClient from "@/components/subs/SubsPageClient";

export const dynamic = "force-dynamic";

export default async function SubsDatabasePage({ params, searchParams }: { params: { companyId: string }; searchParams?: { gmail?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}/subs`);

  const [subs, clients, leads, projects] = await Promise.all([
    prisma.subContractor.findMany({
      where: { companyId: params.companyId },
      orderBy: [{ divisionCode: "asc" }, { name: "asc" }],
      select: { id: true, name: true, contactName: true, address: true, email: true, phone: true, divisionCode: true, divisionName: true, notes: true, isFavorite: true, createdAt: true },
    }),
    prisma.client.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.lead.findMany({
      where: { companyId: params.companyId },
      orderBy: { receivedAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="w-full px-4 md:px-8 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href={`/${params.companyId}/today`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "#1e2736", border: "1px solid #30373f", color: "#C9A84C" }}
        >
          <span style={{ fontSize: 16 }}>←</span> Today
        </Link>
        <Link
          href={`/api/google-oauth?companyId=${params.companyId}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
          style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
          title="Re-authorize Gmail access — fixes 'invalid grant' PDF errors"
        >
          📧 Reconnect Gmail
        </Link>
        {searchParams?.gmail === "connected" && (
          <span className="text-xs font-semibold" style={{ color: "#3fb950" }}>✓ Gmail reconnected</span>
        )}
      </div>

      <SubsPageClient
        companyId={params.companyId}
        clients={clients.map(c => ({ id: c.id, name: c.name }))}
        leads={leads.map(l => ({ id: l.id, name: l.name ?? "Unnamed Lead" }))}
        projects={projects.map(p => ({ id: p.id, name: p.name }))}
        initialSubs={subs.map(s => ({
          id: s.id,
          name: s.name,
          contactName: s.contactName ?? null,
          address: s.address ?? null,
          email: s.email ?? null,
          phone: s.phone ?? null,
          divisionCode: s.divisionCode,
          divisionName: s.divisionName,
          notes: s.notes ?? null,
          isFavorite: s.isFavorite,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
