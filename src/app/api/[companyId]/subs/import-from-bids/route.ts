import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all non-placeholder sub bids with a contractor name for this company
  const bids = await prisma.subBid.findMany({
    where: {
      companyId: params.companyId,
      isPlaceholder: false,
      contractorName: { not: null },
    },
    select: { contractorName: true, divisionCode: true, divisionName: true, emailSource: true },
  });

  // Get existing subs to avoid duplicates
  const existing = await prisma.subContractor.findMany({
    where: { companyId: params.companyId },
    select: { name: true, divisionCode: true },
  });
  const existingSet = new Set(existing.map(s => `${s.name}||${s.divisionCode}`));

  // Deduplicate bids by contractorName + divisionCode
  const seen = new Set<string>();
  const toCreate: { name: string; email: string | null; divisionCode: string; divisionName: string }[] = [];

  for (const bid of bids) {
    if (!bid.contractorName) continue;
    const key = `${bid.contractorName}||${bid.divisionCode}`;
    if (seen.has(key) || existingSet.has(key)) continue;
    seen.add(key);
    toCreate.push({
      name: bid.contractorName,
      email: bid.emailSource ?? null,
      divisionCode: bid.divisionCode,
      divisionName: bid.divisionName,
    });
  }

  if (toCreate.length === 0) return NextResponse.json({ imported: 0 });

  await prisma.subContractor.createMany({
    data: toCreate.map(s => ({
      companyId: params.companyId,
      name: s.name,
      email: s.email,
      phone: null,
      divisionCode: s.divisionCode,
      divisionName: s.divisionName,
      notes: null,
    })),
  });

  return NextResponse.json({ imported: toCreate.length });
}
