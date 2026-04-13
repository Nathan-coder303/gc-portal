import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SubsDatabase from "@/components/subs/SubsDatabase";

export const dynamic = "force-dynamic";

export default async function SubsDatabasePage({ params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId !== params.companyId) redirect(`/${session.user.companyId}/subs`);

  const subs = await prisma.subContractor.findMany({
    where: { companyId: params.companyId },
    orderBy: [{ divisionCode: "asc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link
        href={`/${params.companyId}/today`}
        className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
        style={{ background: "#1e2736", border: "1px solid #30373f", color: "#C9A84C" }}
      >
        <span style={{ fontSize: 16 }}>←</span> Today
      </Link>
      <SubsDatabase
        companyId={params.companyId}
        initialSubs={subs.map(s => ({
          id: s.id,
          name: s.name,
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
