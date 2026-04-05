import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import ProjectCard from "./ProjectCard";

export default async function ProjectsPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const isAdmin = can(session.user.role, "project:edit");
  const isPartner = session.user.role === "PARTNER";

  let projectFilter: { companyId: string; id?: { in: string[] } } = { companyId: params.companyId };
  if (isPartner) {
    const access = await prisma.userProjectAccess.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });
    projectFilter = { companyId: params.companyId, id: { in: access.map((a) => a.projectId) } };
  }

  const [projects, partnerUsers] = await Promise.all([
    prisma.project.findMany({
      where: projectFilter,
      orderBy: { createdAt: "desc" },
      include: {
        userAccess: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { companyId: params.companyId, role: "PARTNER", archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Bids</h1>
        <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
          {projects.length} bid{projects.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={{
              id: p.id,
              name: p.name,
              address: p.address,
              city: p.city,
              state: p.state,
              zip: p.zip,
              startDate: p.startDate,
              budget: Number(p.budget),
              status: p.status,
              partners: p.userAccess.map(a => ({
                id: a.user.id,
                name: a.user.name,
                email: a.user.email,
              })),
            }}
            companyId={params.companyId}
            isAdmin={isAdmin}
            isPartner={isPartner}
            partnerUsers={partnerUsers}
          />
        ))}

        {isAdmin && (
          <Link
            href={`/${params.companyId}/projects/new`}
            className="flex flex-col items-center justify-center rounded-2xl py-10 px-10 text-center transition-all hover:border-[#C9A84C88]"
            style={{ background: "#0d1117", border: "1px dashed #C9A84C66", minHeight: "220px" }}
          >
            <div className="text-6xl font-bold leading-none mb-4" style={{ color: "#C9A84C55" }}>+</div>
            <div className="text-xl font-semibold" style={{ color: "#C9A84C88" }}>New Project</div>
          </Link>
        )}
      </div>
    </div>
  );
}
