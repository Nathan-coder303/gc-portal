import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TabNav from "@/components/layout/TabNav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, companyId: params.companyId },
  });

  if (!project) redirect("/");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">GC Portal</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-600 font-medium">{project.name}</span>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{project.code}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{session.user.name}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
              {session.user.role}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
        <TabNav companyId={params.companyId} projectId={params.projectId} />
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
