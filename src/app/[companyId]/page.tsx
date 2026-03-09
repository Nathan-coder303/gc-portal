import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import { format } from "date-fns";

export default async function HubPage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect("/");

  const isAdmin = can(session.user.role, "project:edit");

  const [projects, company, templateCount, clientCount] = await Promise.all([
    prisma.project.findMany({
      where: { companyId: params.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        estimates: { where: { archivedAt: null }, select: { id: true } },
      },
    }),
    prisma.company.findUnique({ where: { id: params.companyId } }),
    prisma.estimateTemplate.count({ where: { companyId: params.companyId, archivedAt: null } }),
    prisma.client.count({ where: { companyId: params.companyId } }),
  ]);

  const statusColors: Record<string, string> = {
    ACTIVE:   "bg-green-100 text-green-700",
    ON_HOLD:  "bg-amber-100 text-amber-700",
    COMPLETE: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">GC Portal</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-600 font-medium">{company?.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{session.user.name}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
              {session.user.role}
            </span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Action cards */}
        <div className="grid grid-cols-4 gap-4">
          {/* Existing Projects */}
          <Link
            href={`/${params.companyId}/projects`}
            className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="text-3xl mb-3">🏗️</div>
            <div className="font-bold text-slate-900 text-lg group-hover:text-blue-600">Existing Projects</div>
            <div className="text-sm text-slate-500 mt-1">{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
          </Link>

          {/* New Project */}
          {isAdmin ? (
            <Link
              href={`/${params.companyId}/projects/new`}
              className="bg-blue-600 border border-blue-600 rounded-xl p-6 hover:bg-blue-700 transition-all group"
            >
              <div className="text-3xl mb-3">➕</div>
              <div className="font-bold text-white text-lg">New Project</div>
              <div className="text-sm text-blue-100 mt-1">Start a new project</div>
            </Link>
          ) : (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 opacity-50">
              <div className="text-3xl mb-3">➕</div>
              <div className="font-bold text-slate-500 text-lg">New Project</div>
              <div className="text-sm text-slate-400 mt-1">Admin only</div>
            </div>
          )}

          {/* Estimates & Templates */}
          <Link
            href={`/${params.companyId}/estimates`}
            className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="text-3xl mb-3">📋</div>
            <div className="font-bold text-slate-900 text-lg group-hover:text-blue-600">Estimates & Templates</div>
            <div className="text-sm text-slate-500 mt-1">{templateCount} template{templateCount !== 1 ? "s" : ""}</div>
          </Link>

          {/* Clients */}
          <Link
            href={`/${params.companyId}/clients`}
            className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="text-3xl mb-3">👥</div>
            <div className="font-bold text-slate-900 text-lg group-hover:text-blue-600">Clients</div>
            <div className="text-sm text-slate-500 mt-1">{clientCount} client{clientCount !== 1 ? "s" : ""}</div>
          </Link>
        </div>

        {/* Projects list */}
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3">Existing Projects</h2>
          {projects.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
              No projects yet.{" "}
              {isAdmin && (
                <Link href={`/${params.companyId}/projects/new`} className="text-blue-600 hover:underline">
                  Create your first project
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-blue-200 transition-colors">
                  <div className="bg-slate-100 text-slate-600 font-mono text-sm font-bold px-3 py-2 rounded-lg min-w-fit">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Started {format(p.startDate, "MMM d, yyyy")} · Budget ${Number(p.budget).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {p.status}
                    </span>
                    {p.estimates.length > 0 && (
                      <Link
                        href={`/${params.companyId}/${p.id}/estimates`}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-0.5 rounded"
                      >
                        {p.estimates.length} estimate{p.estimates.length !== 1 ? "s" : ""}
                      </Link>
                    )}
                    <Link
                      href={`/${params.companyId}/${p.id}/dashboard`}
                      className="text-sm text-slate-400 hover:text-blue-600"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
