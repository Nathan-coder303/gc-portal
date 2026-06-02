import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const log = await prisma.dailyLog.update({
    where: { id: params.logId },
    data: {
      arrivalDate: body.arrivalDate ? new Date(body.arrivalDate) : undefined,
      departureTime: body.departureTime ?? null,
      status: body.status ?? undefined,
      siteCondition: body.siteCondition ?? null,
      weatherCondition: body.weatherCondition ?? null,
      temperature: body.temperature ?? null,
      weatherNote: body.weatherNote ?? null,
      weatherDelay: body.weatherDelay ?? false,
      scheduleDelay: body.scheduleDelay ?? false,
      jobsiteConditionNotes: body.jobsiteConditionNotes ?? null,
      tasksPerformed: body.tasksPerformed ?? null,
      employeesOnSite: body.employeesOnSite ?? null,
      visitorsOnSite: body.visitorsOnSite ?? false,
      employeeWorkNotes: body.employeeWorkNotes ?? null,
      subsOnJobsite: body.subsOnJobsite ? JSON.stringify(body.subsOnJobsite) : null,
      materialNotes: body.materialNotes ?? null,
      materialDelivered: body.materialDelivered ? JSON.stringify(body.materialDelivered) : null,
      materialUsed: body.materialUsed ? JSON.stringify(body.materialUsed) : null,
      equipmentNotes: body.equipmentNotes ?? null,
      equipmentUsed: body.equipmentUsed ? JSON.stringify(body.equipmentUsed) : null,
      equipmentDelivered: body.equipmentDelivered ? JSON.stringify(body.equipmentDelivered) : null,
      projectNotes: body.projectNotes ? JSON.stringify(body.projectNotes) : null,
      inspections: body.inspections ? JSON.stringify(body.inspections) : null,
      safetyMeetings: body.safetyMeetings ? JSON.stringify(body.safetyMeetings) : null,
      siteAuditConducted: body.siteAuditConducted ?? false,
      areasOfConcern: body.areasOfConcern ?? null,
      workCompletedPct: body.workCompletedPct ?? null,
      estimatedCompletion: body.estimatedCompletion ?? null,
      groundConditions: body.groundConditions ?? null,
      crewsPresent: body.crewsPresent ? JSON.stringify(body.crewsPresent) : null,
      equipmentDamaged: body.equipmentDamaged ?? null,
      equipmentDamageNotes: body.equipmentDamageNotes ?? null,
      signatureData: body.signatureData ?? null,
    },
  });

  return NextResponse.json(log);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.dailyLog.delete({ where: { id: params.logId } });
  return NextResponse.json({ success: true });
}
