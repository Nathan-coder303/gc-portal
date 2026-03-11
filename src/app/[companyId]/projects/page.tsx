import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import { format } from "date-fns";
import DeleteProjectButton from "./DeleteProjectButton";

const statusStyle: Record<string, { background: string; color: string; border: string }> = {
  ACTIVE:   { background: "#0d2a1a", color: "#4ade80", border: "1px solid #166534" },
  ON_HOLD:  { background: "#2d2410", color: "#fbbf24", border: "1px solid #92400e" },
  COMPLETE: { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" },
};

export default async function ProjectsPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const isAdmin = can(session.user.role, "project:edit");

  // PARTNER users with explicit project access are restricted to those projects
  let projectFilter: { companyId: string; id?: { in: string[] } } = { companyId: params.companyId };
  if (session.user.role === "PARTNER") {
    const access = await prisma.userProjectAccess.findMany({
      where: { userId: session.user.id },
      select: { projectId: true },
    });
    if (access.length > 0) {
      projectFilter = { companyId: params.companyId, id: { in: access.map((a) => a.projectId) } };
    }
  }

  const projects = await prisma.project.findMany({
    where: projectFilter,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Projects</h1>
        <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        {/* Existing project cards */}
        {projects.map((p) => (
          <div key={p.id} className="relative group">
            <Link
              href={`/${params.companyId}/${p.id}/dashboard`}
              className="flex flex-col items-center justify-center rounded-2xl py-10 px-10 text-center transition-all hover:border-[#C9A84C88]"
              style={{ background: "#0d1117", border: "1px solid #C9A84C44", minHeight: "220px" }}
            >
              {/* Project name in big gold */}
              <div className="font-bold text-5xl mb-4 leading-tight" style={{ color: "#C9A84C" }}>
                {p.name}
              </div>

              {/* Status badge */}
              <span
                className="inline-block text-sm px-4 py-1 rounded-full font-semibold mb-4"
                style={statusStyle[p.status] ?? { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
              >
                {p.status}
              </span>

              {/* Budget + date */}
              <div className="text-base font-semibold" style={{ color: "#8b949e" }}>
                ${Number(p.budget).toLocaleString()}
              </div>
              <div className="text-sm mt-1" style={{ color: "#8b949e" }}>
                {format(p.startDate, "MMM d, yyyy")}
              </div>
            </Link>

            {isAdmin && (
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <DeleteProjectButton
                  projectId={p.id}
                  projectName={p.name}
                  companyId={params.companyId}
                />
              </div>
            )}
          </div>
        ))}

        {/* New Project card */}
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
