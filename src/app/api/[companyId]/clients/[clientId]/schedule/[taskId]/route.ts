import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; taskId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { phase, name, durationDays, startDate, endDate, predecessorIds, parentId, trade, assignee, isMilestone, status, percentComplete, notes, priority, actualFinish, sortOrder } = body;

  const task = await prisma.clientTask.update({
    where: { id: params.taskId },
    data: {
      ...(phase !== undefined && { phase }),
      ...(name !== undefined && { name }),
      ...(durationDays !== undefined && { durationDays }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(predecessorIds !== undefined && { predecessorIds }),
      ...(parentId !== undefined && { parentId }),
      ...(trade !== undefined && { trade }),
      ...(assignee !== undefined && { assignee }),
      ...(isMilestone !== undefined && { isMilestone }),
      ...(status !== undefined && { status }),
      ...(percentComplete !== undefined && { percentComplete }),
      ...(notes !== undefined && { notes }),
      ...(priority !== undefined && { priority }),
      ...(actualFinish !== undefined && { actualFinish: actualFinish ? new Date(actualFinish) : null }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; taskId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.clientTask.delete({ where: { id: params.taskId } });
  return NextResponse.json({ success: true });
}
