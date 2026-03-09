import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import Image from "next/image";
import Link from "next/link";
import TemplateList from "@/components/estimates/TemplateList";

export default async function EstimatesPage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  if (!can(session.user.role, "estimate:read")) redirect(`/${params.companyId}/projects`);

  const templates = await prisma.estimateTemplate.findMany({
    where: { companyId: params.companyId, archivedAt: null, type: "TEMPLATE" },
    orderBy: { sortOrder: "asc" },
    include: {
      divisions: {
        where: { archivedAt: null },
        include: {
          items: { where: { archivedAt: null }, select: { id: true } },
          groups: {
            where: { archivedAt: null },
            include: { items: { where: { archivedAt: null }, select: { id: true } } },
          },
        },
      },
    },
  });

  const formatted = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    divisionCount: t.divisions.length,
    itemCount: t.divisions.reduce(
      (s, d) => s + d.items.length + d.groups.reduce((gs, g) => gs + g.items.length, 0),
      0
    ),
    createdAt: t.createdAt,
  }));

  return (
    <div className="min-h-screen" style={{ background: "#0d1117" }}>
      <header style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href={`/${params.companyId}`}>
              <Image src="/logo.png" alt="MIBH" width={28} height={28} className="rounded object-contain" />
            </Link>
            <span style={{ color: "#30373f" }}>|</span>
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Estimate Templates</span>
          </div>
          <Link href={`/${params.companyId}`} className="text-sm transition-colors" style={{ color: "#8b949e" }}>
            ← Dashboard
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <TemplateList
          companyId={params.companyId}
          templates={formatted}
          canEdit={can(session.user.role, "estimateTemplate:create")}
          canArchive={can(session.user.role, "estimateTemplate:archive")}
        />
      </main>
    </div>
  );
}
