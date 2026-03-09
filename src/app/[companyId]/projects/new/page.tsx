import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
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
    <div className="min-h-screen bg-white">
      <main className="max-w-lg mx-auto px-6 py-10">
        {/* Back link */}
        <a
          href={`/${params.companyId}/projects`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8"
        >
          <span>←</span>
          <span>Projects</span>
        </a>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-slate-900 mb-1">New project</h1>
        <p className="text-sm text-slate-500 mb-8">
          Set up a project to track budget, expenses, schedule, and team collaboration.
        </p>

        <NewProjectForm companyId={params.companyId} />
      </main>
    </div>
  );
}
