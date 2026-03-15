/**
 * POST /api/[companyId]/dedup-leads
 * Merges existing duplicate leads that share the same name.
 * Keeps the oldest record, fills missing fields from newer ones,
 * collects all gmailMsgIds into linkedMsgIds, deletes duplicates.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leads = await prisma.lead.findMany({
    where: { companyId: params.companyId },
    orderBy: { receivedAt: "asc" }, // oldest first
  });

  // Group by normalized name
  const groups = new Map<string, typeof leads>();
  for (const lead of leads) {
    const key = lead.name?.toLowerCase().trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(lead);
  }

  let merged = 0;
  let deleted = 0;

  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;

    const [primary, ...duplicates] = group;

    // Collect all msgIds
    const allLinkedIds = [
      primary.gmailMsgId,
      ...(primary.linkedMsgIds ?? "").split(" ").filter(Boolean),
      ...duplicates.flatMap(d => [
        d.gmailMsgId,
        ...(d.linkedMsgIds ?? "").split(" ").filter(Boolean),
      ]),
    ].filter((id): id is string => Boolean(id) && id !== primary.gmailMsgId);

    // Merge missing fields from duplicates into primary
    let email = primary.email;
    let phone = primary.phone;
    let address = primary.address;
    let city = primary.city;
    let state = primary.state;
    let projectType = primary.projectType;
    let message = primary.message;

    for (const dup of duplicates) {
      email = email ?? dup.email;
      phone = phone ?? dup.phone;
      address = address ?? dup.address;
      city = city ?? dup.city;
      state = state ?? dup.state;
      projectType = projectType ?? dup.projectType;
      message = message ?? dup.message;
    }

    await prisma.lead.update({
      where: { id: primary.id },
      data: {
        email, phone, address, city, state, projectType, message,
        linkedMsgIds: allLinkedIds.join(" ") || null,
      },
    });

    await prisma.lead.deleteMany({
      where: { id: { in: duplicates.map(d => d.id) } },
    });

    merged++;
    deleted += duplicates.length;
  }

  return NextResponse.json({ merged, deleted });
}
