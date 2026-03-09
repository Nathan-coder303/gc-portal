import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import { format } from "date-fns";

export default async function ProjectsPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const isAdmin = can(session.user.role, "project:edit");

  const [projects, company] = await Promise.all([
    prisma.project.findMany({
      where: { companyId: params.companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findUnique({ where: { id: params.companyId } }),
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

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Existing Projects</h1>
            <p className="text-sm text-slate-500 mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
          </div>
          {isAdmin && (
            <Link
              href={`/${params.companyId}/projects/new`}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
            >
              + New Project
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500 mb-4">No projects yet.</p>
            {isAdmin && (
              <Link
                href={`/${params.companyId}/projects/new`}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
              >
                Create your first project
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/${params.companyId}/${p.id}/dashboard`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-slate-100 text-slate-600 font-mono text-sm font-bold px-3 py-2 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                    {p.code}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Started {format(p.startDate, "MMM d, yyyy")} · Budget ${Number(p.budget).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {p.status}
                  </span>
                  <span className="text-slate-300 group-hover:text-blue-400 text-lg">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
