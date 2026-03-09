import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TabNav from "@/components/layout/TabNav";
import Image from "next/image";
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
    <div className="min-h-screen" style={{ background: "#0d1117" }}>
      <header style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href={`/${params.companyId}`} className="flex items-center gap-2">
              <Image src="/logo.png" alt="MIBH" width={28} height={28} className="rounded object-contain" />
            </Link>
            <span style={{ color: "#30373f" }}>|</span>
            <Link
              href={`/${params.companyId}/projects`}
              className="text-sm font-medium transition-colors"
              style={{ color: "#8b949e" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8b949e")}
            >
              Projects
            </Link>
            <span style={{ color: "#30373f" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{project.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: "#8b949e" }}>{session.user.name}</span>
            <span
              className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}
            >
              {session.user.role}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-sm transition-colors" style={{ color: "#8b949e" }}>
                Sign out →
              </button>
            </form>
          </div>
        </div>
        <TabNav companyId={params.companyId} projectId={params.projectId} isAdmin={isAdmin} />
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
