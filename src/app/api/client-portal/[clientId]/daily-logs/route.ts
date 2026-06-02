import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.dailyLog.findMany({
    where: { clientId: params.clientId },
    orderBy: { arrivalDate: "desc" },
    select: {
      id: true,
      arrivalDate: true,
      departureTime: true,
      status: true,
      weatherCondition: true,
      temperature: true,
      siteCondition: true,
      weatherDelay: true,
      scheduleDelay: true,
      tasksPerformed: true,
      employeesOnSite: true,
      visitorsOnSite: true,
      jobsiteConditionNotes: true,
      materialNotes: true,
      equipmentNotes: true,
      projectNotes: true,
      workCompletedPct: true,
      createdBy: true,
      attachments: true,
    },
  });

  return NextResponse.json(logs.map(l => ({
    ...l,
    arrivalDate: l.arrivalDate.toISOString(),
    attachmentCount: (() => {
      if (!l.attachments) return 0;
      try { return (JSON.parse(l.attachments) as unknown[]).length; } catch { return 0; }
    })(),
    attachments: undefined,
  })));
}
