import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — list all pipeline cards for a company
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify company ownership
  const company = await prisma.company.findFirst({
    where: { id: params.companyId },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cards = await prisma.pipelineCard.findMany({
    where: { companyId: params.companyId },
    orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(cards);
}

// POST — create a new pipeline card
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify company ownership
  const company = await prisma.company.findFirst({
    where: { id: params.companyId },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { displayName, clientId, stage, estimateValue, notes } = body;

  if (!displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  const card = await prisma.pipelineCard.create({
    data: {
      companyId: params.companyId,
      displayName,
      clientId: clientId || null,
      stage: stage || "NEW_LEAD",
      estimateValue: estimateValue != null ? estimateValue : null,
      notes: notes || null,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(card);
}
