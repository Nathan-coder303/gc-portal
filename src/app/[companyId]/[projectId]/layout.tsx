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
  const isAdmin = session.user.role === "ADMIN";

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, companyId: params.companyId },
  });

  if (!project) redirect("/");

  return (
    <div>
      <div style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center h-10">
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
        <TabNav companyId={params.companyId} projectId={params.projectId} isAdmin={isAdmin} />
      </div>
      <main className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">{children}</main>
    </div>
  );
}
