import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

export default async function ClientDetailPage({ params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const [client] = await Promise.all([
    prisma.client.findFirst({
      where: { id: params.clientId, companyId: params.companyId },
      include: {
        templates: {
          where: { type: "CLIENT_ESTIMATE", archivedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            divisions: {
              where: { archivedAt: null },
              include: {
                items: { where: { archivedAt: null } },
                groups: { where: { archivedAt: null }, include: { items: { where: { archivedAt: null } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!client) redirect(`/${params.companyId}/clients`);

  const safeClient = client!;

  function calcEstimateTotal(divisions: typeof safeClient.templates[0]["divisions"]): number {
    return divisions.reduce((sum, div) => {
      const allItems = [...div.items, ...div.groups.flatMap(g => g.items)];
      return sum + allItems.reduce((s, i) => {
        const qty = i.defaultQty ? Number(i.defaultQty) : 0;
        const cost = i.defaultUnitCost ? Number(i.defaultUnitCost) : 0;
        const markup = i.defaultMarkupPct ? Number(i.defaultMarkupPct) : 0;
        return s + qty * cost * (1 + markup / 100);
      }, 0);
    }, 0);
  }

  function fmt(n: number) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <a href={`/${params.companyId}`} className="font-bold text-slate-900 hover:text-blue-600">GC Portal</a>
            <span className="text-slate-300">|</span>
            <a href={`/${params.companyId}/clients`} className="text-sm text-slate-600 hover:text-blue-600">Clients</a>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-800 font-medium">{safeClient.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={`/${params.companyId}/clients`} className="text-sm text-slate-500 hover:text-slate-900">← Clients</a>
            <span className="text-sm text-slate-600">{session.user.name}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Client info */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h1 className="text-xl font-bold text-slate-900">{safeClient.name}</h1>
          <div className="flex gap-6 mt-2">
            {safeClient.address && <span className="text-sm text-slate-500">{safeClient.address}</span>}
            {safeClient.email && <span className="text-sm text-slate-500">{safeClient.email}</span>}
            {safeClient.phone && <span className="text-sm text-slate-500">{safeClient.phone}</span>}
          </div>
        </div>

        {/* Estimates */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-700">Estimates</h2>
            <span className="text-sm text-slate-400">{safeClient.templates.length} estimate{safeClient.templates.length !== 1 ? "s" : ""}</span>
          </div>

          {safeClient.templates.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">No estimates yet.</p>
              <p className="text-slate-400 text-xs mt-1">Open a template and use &quot;Save to Client&quot; to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeClient.templates.map((est) => {
                const total = calcEstimateTotal(est.divisions);
                return (
                  <Link
                    key={est.id}
                    href={`/${params.companyId}/estimates/${est.id}`}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-blue-300 hover:shadow-sm transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-blue-600">{est.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Created {format(est.createdAt, "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-slate-900">${fmt(total)}</span>
                      <span className="text-slate-300 group-hover:text-blue-400 text-lg">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
