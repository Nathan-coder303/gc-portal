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

  const projects = await prisma.project.findMany({
    where: { companyId: params.companyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Projects</h1>
        <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {/* Existing project cards */}
        {projects.map((p) => (
          <div key={p.id} className="relative group">
            <Link
              href={`/${params.companyId}/${p.id}/dashboard`}
              className="block rounded-xl p-6 text-center transition-all hover:border-[#C9A84C88]"
              style={{ background: "#0d1117", border: "1px solid #C9A84C44" }}
            >
              {/* Initials */}
              <div
                className="text-4xl font-bold leading-none mb-3"
                style={{ color: "#C9A84C" }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Project name */}
              <div className="font-semibold text-sm mb-3 leading-tight" style={{ color: "#e6edf3" }}>
                {p.name}
              </div>

              {/* Status badge */}
              <span
                className="inline-block text-xs px-2 py-0.5 rounded font-medium mb-3"
                style={statusStyle[p.status] ?? { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
              >
                {p.status}
              </span>

              {/* Budget */}
              <div className="text-xs" style={{ color: "#8b949e" }}>
                ${Number(p.budget).toLocaleString()}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                {format(p.startDate, "MMM d, yyyy")}
              </div>
            </Link>

            {/* Delete button — top-right corner, shows on hover */}
            {isAdmin && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
            className="block rounded-xl p-6 text-center transition-all hover:border-[#C9A84C88]"
            style={{ background: "#0d1117", border: "1px dashed #C9A84C66" }}
          >
            <div
              className="text-4xl font-bold leading-none mb-3"
              style={{ color: "#C9A84C66" }}
            >
              +
            </div>
            <div className="text-sm font-medium" style={{ color: "#C9A84C99" }}>
              New Project
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
