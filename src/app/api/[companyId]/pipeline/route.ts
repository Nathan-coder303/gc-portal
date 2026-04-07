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

  const url = new URL(_req.url);
  const pipelineType = url.searchParams.get("type") ?? "sales";

  const cards = await prisma.pipelineCard.findMany({
    where: { companyId: params.companyId, pipelineType },
    orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
    include: {
      client: { select: { id: true, name: true, email: true } },
      lead: { select: { id: true, name: true, email: true, phone: true, projectType: true, receivedAt: true } },
    },
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
  const { displayName, clientId, leadId, stage, estimateValue, notes, source, pipelineType } = body;

  if (!displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  // If leadId provided and card already exists for it, update stage instead of creating
  if (leadId) {
    const existing = await prisma.pipelineCard.findUnique({ where: { leadId } });
    if (existing) {
      const updated = await prisma.pipelineCard.update({
        where: { id: existing.id },
        data: { stage: stage || existing.stage, source: source ?? existing.source },
        include: {
          client: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true, email: true, phone: true, projectType: true, receivedAt: true } },
        },
      });
      return NextResponse.json(updated);
    }
  }

  const card = await prisma.pipelineCard.create({
    data: {
      companyId: params.companyId,
      displayName,
      clientId: clientId || null,
      leadId: leadId || null,
      stage: stage || "NEW_LEAD",
      estimateValue: estimateValue != null ? estimateValue : null,
      notes: notes || null,
      source: source || null,
      pipelineType: pipelineType || "sales",
      stageChangedAt: new Date(),
    },
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, email: true, phone: true, projectType: true, receivedAt: true } },
    },
  });

  return NextResponse.json(card);
}
