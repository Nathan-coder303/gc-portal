import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import { format } from "date-fns";
import DeleteProjectButton from "./DeleteProjectButton";

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

  const statusStyle: Record<string, { background: string; color: string; border: string }> = {
    ACTIVE:   { background: "#0d2a1a", color: "#4ade80", border: "1px solid #166534" },
    ON_HOLD:  { background: "#2d2410", color: "#fbbf24", border: "1px solid #92400e" },
    COMPLETE: { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" },
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Existing Projects</h1>
            <p className="text-sm mt-0.5" style={{ color: "#8b949e" }}>
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isAdmin && (
            <Link
              href={`/${params.companyId}/projects/new`}
              className="px-4 py-2 text-sm rounded-lg font-medium transition-colors"
              style={{ background: "#C9A84C", color: "#0d1117" }}
            >
              + New Project
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "#1e2736", border: "1px solid #30373f" }}>
            <p className="mb-4" style={{ color: "#8b949e" }}>No projects yet.</p>
            {isAdmin && (
              <Link
                href={`/${params.companyId}/projects/new`}
                className="px-4 py-2 text-sm rounded-lg font-medium"
                style={{ background: "#C9A84C", color: "#0d1117" }}
              >
                Create your first project
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-xl p-5 flex items-center justify-between group transition-all"
                style={{ background: "#1e2736", border: "1px solid #30373f" }}
              >
                <Link
                  href={`/${params.companyId}/${p.id}/dashboard`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold"
                    style={{ background: "#C9A84C1a", color: "#C9A84C" }}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold" style={{ color: "#e6edf3" }}>{p.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
                      Started {format(p.startDate, "MMM d, yyyy")} · Budget ${Number(p.budget).toLocaleString()}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={statusStyle[p.status] ?? { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
                  >
                    {p.status}
                  </span>
                  {isAdmin && (
                    <DeleteProjectButton
                      projectId={p.id}
                      projectName={p.name}
                      companyId={params.companyId}
                    />
                  )}
                  <Link
                    href={`/${params.companyId}/${p.id}/dashboard`}
                    className="text-lg transition-colors"
                    style={{ color: "#8b949e" }}
                  >
                    →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
