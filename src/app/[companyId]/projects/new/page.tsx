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
    <div className="max-w-lg mx-auto px-6 py-10">
        {/* Back link */}
        <Link
          href={`/${params.companyId}/projects`}
          className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
          style={{ color: "#8b949e" }}
        >
          <span>←</span>
          <span>Projects</span>
        </Link>

        {/* Heading */}
        <h1 className="text-3xl font-bold mb-1" style={{ color: "#e6edf3" }}>New project</h1>
        <p className="text-sm mb-8" style={{ color: "#8b949e" }}>
          Set up a project to track budget, expenses, schedule, and team collaboration.
        </p>

        <NewProjectForm companyId={params.companyId} />
    </div>
  );
}
