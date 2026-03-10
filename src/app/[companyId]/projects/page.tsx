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

      <div className="grid grid-cols-2 gap-6">
        {/* Existing project cards */}
        {projects.map((p) => (
          <div key={p.id} className="relative group">
            <Link
              href={`/${params.companyId}/${p.id}/dashboard`}
              className="flex flex-col items-center justify-center rounded-2xl py-16 px-10 text-center transition-all hover:border-[#C9A84C88]"
              style={{ background: "#0d1117", border: "1px solid #C9A84C44", minHeight: "340px" }}
            >
              {/* Initials */}
              <div
                className="text-8xl font-bold leading-none mb-6"
                style={{ color: "#C9A84C" }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Project name */}
              <div className="font-bold text-xl mb-5 leading-tight" style={{ color: "#e6edf3" }}>
                {p.name}
              </div>

              {/* Status badge */}
              <span
                className="inline-block text-sm px-4 py-1 rounded-full font-semibold mb-5"
                style={statusStyle[p.status] ?? { background: "#1e2736", color: "#8b949e", border: "1px solid #30373f" }}
              >
                {p.status}
              </span>

              {/* Budget */}
              <div className="text-base font-semibold" style={{ color: "#8b949e" }}>
                ${Number(p.budget).toLocaleString()}
              </div>
              <div className="text-sm mt-1" style={{ color: "#8b949e" }}>
                {format(p.startDate, "MMM d, yyyy")}
              </div>
            </Link>

            {/* Delete button — top-right corner, shows on hover */}
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
            className="flex flex-col items-center justify-center rounded-2xl py-16 px-10 text-center transition-all hover:border-[#C9A84C88]"
            style={{ background: "#0d1117", border: "1px dashed #C9A84C66", minHeight: "340px" }}
          >
            <div
              className="text-8xl font-bold leading-none mb-6"
              style={{ color: "#C9A84C55" }}
            >
              +
            </div>
            <div className="text-xl font-semibold" style={{ color: "#C9A84C88" }}>
              New Project
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
