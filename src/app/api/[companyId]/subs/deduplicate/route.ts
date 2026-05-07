import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function richness(sub: {
  phone: string | null;
  email: string | null;
  address: string | null;
  contactName: string | null;
  licenseNumber: string | null;
  isFavorite: boolean;
  notes: string | null;
}): number {
  let s = 0;
  if (sub.phone?.trim()) s += 3;
  if (sub.email?.trim()) s += 3;
  if (sub.address?.trim()) s += 2;
  if (sub.contactName?.trim()) s += 2;
  if (sub.licenseNumber?.trim()) s += 1;
  if (sub.isFavorite) s += 4;
  if (sub.notes) {
    try {
      const n = JSON.parse(sub.notes);
      if (n.src) s += 1;
      if (n.text?.trim()) s += 1;
      if (Array.isArray(n.t) && n.t.length > 0) s += 1;
    } catch {}
  }
  return s;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preview = req.nextUrl.searchParams.get("preview") === "1";

  const all = await prisma.subContractor.findMany({
    where: { companyId: params.companyId },
    orderBy: { createdAt: "asc" },
  });

  // Group by lowercase name
  const byName = new Map<string, typeof all>();
  for (const sub of all) {
    const key = sub.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(sub);
  }

  const toDelete: string[] = [];
  const groups: { name: string; kept: string; removed: string[] }[] = [];

  for (const [, group] of Array.from(byName.entries())) {
    if (group.length < 2) continue;

    // Sort by richness descending; break ties by preferring isFavorite, then older record
    group.sort((a, b) => {
      const diff = richness(b) - richness(a);
      if (diff !== 0) return diff;
      if (b.isFavorite !== a.isFavorite) return b.isFavorite ? 1 : -1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const [winner, ...losers] = group;
    const loserIds = losers.map(l => l.id);
    toDelete.push(...loserIds);
    groups.push({ name: winner.name, kept: winner.id, removed: loserIds });
  }

  if (preview) {
    return NextResponse.json({ duplicateGroups: groups.length, wouldRemove: toDelete.length, groups });
  }

  if (toDelete.length > 0) {
    await prisma.subContractor.deleteMany({
      where: { id: { in: toDelete }, companyId: params.companyId },
    });
  }

  return NextResponse.json({ removed: toDelete.length, groups: groups.length });
}
