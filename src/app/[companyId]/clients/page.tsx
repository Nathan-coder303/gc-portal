import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <a href={`/${params.companyId}`} className="font-bold text-slate-900 hover:text-blue-600">GC Portal</a>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-600 font-medium">{company?.name}</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-800 font-medium">Clients</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={`/${params.companyId}`} className="text-sm text-slate-500 hover:text-slate-900">← Dashboard</a>
            <span className="text-sm text-slate-600">{session.user.name}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">{session.user.role}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
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
