import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SubsDatabase from "@/components/subs/SubsDatabase";
import BidTriage from "@/components/subs/BidTriage";

export const dynamic = "force-dynamic";

export default async function SubsDatabasePage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}/subs`);

  const [subs, clients, triageCount] = await Promise.all([
    prisma.subContractor.findMany({
      where: { companyId: params.companyId },
      orderBy: [{ divisionCode: "asc" }, { name: "asc" }],
    }),
    prisma.client.findMany({
      where: { companyId: params.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true },
    }),
    prisma.subBid.count({
      where: { companyId: params.companyId, status: "TRIAGE" },
    }),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link
        href={`/${params.companyId}/today`}
        className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
        style={{ background: "#1e2736", border: "1px solid #30373f", color: "#C9A84C" }}
      >
        <span style={{ fontSize: 16 }}>←</span> Today
      </Link>

      {/* Bid Triage */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#C9A84C" }}>
            Bid Inbox
          </h2>
          {triageCount > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#C9A84C22", color: "#C9A84C", border: "1px solid #C9A84C44" }}
            >
              {triageCount}
            </span>
          )}
        </div>
        <BidTriage
          companyId={params.companyId}
          clients={clients.map(c => ({ id: c.id, name: c.name, address: c.address ?? null }))}
        />
      </div>

      {/* Divider */}
      <div className="mb-8" style={{ borderTop: "1px solid #30373f" }} />

      <SubsDatabase
        companyId={params.companyId}
        initialSubs={subs.map(s => ({
          id: s.id,
          name: s.name,
          contactName: s.contactName ?? null,
          address: s.address ?? null,
          email: s.email ?? null,
          phone: s.phone ?? null,
          divisionCode: s.divisionCode,
          divisionName: s.divisionName,
          notes: s.notes ?? null,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
