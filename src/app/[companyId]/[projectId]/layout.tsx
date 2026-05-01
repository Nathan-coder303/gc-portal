import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TabNav from "@/components/layout/TabNav";
import Link from "next/link";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { companyId: string; projectId: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;

  // PARTNER: verify they have access to this specific project
  if (role === "PARTNER") {
    const access = await prisma.userProjectAccess.findFirst({
      where: { userId: session.user.id, projectId: params.projectId },
    });
    if (!access) redirect(`/${params.companyId}/projects`);
  }

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, companyId: params.companyId },
  });

  if (!project) redirect("/");

  return (
    <div>
      <div style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
        <div className="w-full px-4 flex items-center h-10">
          <Link
            href={`/${params.companyId}/projects`}
            className="text-sm font-medium transition-colors"
            style={{ color: "#8b949e" }}
          >
            Projects
          </Link>
          <span className="mx-2" style={{ color: "#30373f" }}>/</span>
          <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{project.name}</span>
        </div>
        <TabNav companyId={params.companyId} projectId={params.projectId} role={role} />
      </div>
      <main className="w-full px-3 md:px-4 py-4 md:py-6">{children}</main>
    </div>
  );
}
