import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import Link from "next/link";
import NewProjectForm from "./NewProjectForm";

export default async function NewProjectPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user.role, "project:edit")) redirect(`/${params.companyId}/projects`);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center h-14 gap-3">
          <span className="font-bold text-slate-900">GC Portal</span>
          <span className="text-slate-300">|</span>
          <Link href={`/${params.companyId}/projects`} className="text-sm text-slate-500 hover:text-slate-900">
            Projects
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-700 font-medium">New Project</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">Create New Project</h1>
          <p className="text-sm text-slate-500 mt-0.5">Default ledger accounts will be created automatically.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <NewProjectForm companyId={params.companyId} />
        </div>
      </main>
    </div>
  );
}
