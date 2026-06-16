import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import ProjectsGrid from "./ProjectsGrid";
import MobileProjectList from "@/components/projects/MobileProjectList";

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
      orderBy: { sortOrder: "asc" },
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

  const projectItems = projects.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    startDate: p.startDate,
    budget: Number(p.budget),
    status: p.status,
    photoUrl: (p as { photoUrl?: string | null }).photoUrl ?? null,
    partners: p.userAccess.map(a => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
    })),
  }));

  return (
    <>
      {/* Mobile view */}
      <div className="md:hidden w-full max-w-full overflow-x-hidden px-4 py-4 pb-24">
        <MobileProjectList
          projects={projectItems}
          companyId={params.companyId}
          isAdmin={isAdmin}
          isPartner={isPartner}
        />
      </div>

      {/* Desktop view */}
      <div className="hidden md:block w-full px-8 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Projects</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <ProjectsGrid
          initialProjects={projectItems}
          companyId={params.companyId}
          isAdmin={isAdmin}
          isPartner={isPartner}
          partnerUsers={partnerUsers}
        />
      </div>
    </>
  );
}
