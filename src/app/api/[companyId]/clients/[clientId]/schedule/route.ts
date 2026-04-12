import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await prisma.clientTask.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: [{ phase: "asc" }, { startDate: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { phase, name, durationDays, startDate, endDate, predecessorIds, parentId, trade, assignee, isMilestone, notes } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const task = await prisma.clientTask.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      phase: phase ?? "General",
      name,
      durationDays: durationDays ?? 1,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      predecessorIds: predecessorIds ?? [],
      parentId: parentId ?? null,
      trade: trade ?? null,
      assignee: assignee ?? null,
      isMilestone: isMilestone ?? false,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(task);
}
