import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import Image from "next/image";
import Link from "next/link";
import ClientsManager from "./ClientsManager";

export default async function ClientsPage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}`);

  const [clients, company] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { templates: { where: { type: "CLIENT_ESTIMATE", archivedAt: null } } } },
      },
    }),
    prisma.company.findUnique({ where: { id: params.companyId } }),
  ]);

  const isAdmin = can(session.user.role, "estimateTemplate:edit");

  return (
    <div className="min-h-screen" style={{ background: "#0d1117" }}>
      <header style={{ background: "#161b22", borderBottom: "1px solid #30373f" }}>
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href={`/${params.companyId}`}>
              <Image src="/logo.png" alt="MIBH" width={28} height={28} className="rounded object-contain" />
            </Link>
            <span style={{ color: "#30373f" }}>|</span>
            <Link href={`/${params.companyId}`} className="text-sm font-medium" style={{ color: "#8b949e" }}>
              Dashboard
            </Link>
            <span style={{ color: "#30373f" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>Clients</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/${params.companyId}`} className="text-sm transition-colors" style={{ color: "#8b949e" }}>
              ← Dashboard
            </Link>
            <span className="text-sm" style={{ color: "#8b949e" }}>{session.user.name}</span>
            <span className="text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C55" }}>
              {session.user.role}
            </span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="text-sm transition-colors" style={{ color: "#8b949e" }}>Sign out →</button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <ClientsManager
          companyId={params.companyId}
          clients={clients.map(c => ({
            id: c.id,
            name: c.name,
            address: c.address,
            city: c.city,
            state: c.state,
            zip: c.zip,
            email: c.email,
            phone: c.phone,
            estimateCount: c._count.templates,
          }))}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
}
