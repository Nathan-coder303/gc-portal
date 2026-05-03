import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";

function parseApptText(text: string) {
  const clean = text.replace(/^📅 Appointment\s*[–-]\s*/, "");
  const newlineIdx = clean.indexOf("\n");
  const mainLine = newlineIdx >= 0 ? clean.slice(0, newlineIdx) : clean;
  const notes = newlineIdx >= 0 ? clean.slice(newlineIdx + 1).trim() : "";
  const parts = mainLine.split(" · ");
  const name = parts[0]?.trim() ?? "";
  const time = parts[1]?.trim() ?? "";
  let address = "";
  if (parts.length >= 4) address = parts.slice(3).join(" · ").trim();
  else if (parts.length === 3) {
    const p2 = parts[2]?.trim() ?? "";
    if (!/^[\d\s\-()+.]{7,}$/.test(p2)) address = p2;
  }
  return { name, time, address, notes };
}

export const runtime = "nodejs";

// PATCH — mark complete/incomplete or update text
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; followUpId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.followUp.findFirst({
    where: { id: params.followUpId, companyId: params.companyId },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const newText = body.text !== undefined ? body.text : item.text;
  const newDueDate = body.dueDate !== undefined
    ? (body.dueDate ? new Date(body.dueDate) : null)
    : item.dueDate;

  let gcalEventId = item.googleCalendarEventId;

  if (newText.startsWith("📅 Appointment")) {
    const { name, time, address, notes: apptNotes } = parseApptText(newText);
    const eventDate = newDueDate ?? new Date();
    if (gcalEventId) {
      await updateCalendarEvent(params.companyId, gcalEventId, {
        title: `Appointment – ${name}`,
        date: eventDate,
        timeStr: time || null,
        address: address || null,
        notes: apptNotes || null,
      });
    } else {
      const eventId = await createCalendarEvent(params.companyId, {
        title: `Appointment – ${name}`,
        date: eventDate,
        timeStr: time || null,
        address: address || null,
        notes: apptNotes || null,
      });
      gcalEventId = eventId;
    }
  } else if (gcalEventId) {
    await deleteCalendarEvent(params.companyId, gcalEventId);
    gcalEventId = null;
  }

  const updated = await prisma.followUp.update({
    where: { id: params.followUpId },
    data: {
      ...(body.completedAt !== undefined ? { completedAt: body.completedAt ? new Date(body.completedAt) : null } : {}),
      ...(body.text !== undefined ? { text: body.text } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      ...(body.leadId !== undefined ? { leadId: body.leadId || null, clientId: null } : {}),
      ...(body.clientId !== undefined ? { clientId: body.clientId || null, leadId: null } : {}),
      googleCalendarEventId: gcalEventId,
    },
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE — delete follow-up and its audio blob if present
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; followUpId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.followUp.findFirst({
    where: { id: params.followUpId, companyId: params.companyId },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.audioUrl) {
    try { await del(item.audioUrl); } catch { /* non-fatal */ }
  }

  if (item.googleCalendarEventId) {
    await deleteCalendarEvent(params.companyId, item.googleCalendarEventId);
  }

  await prisma.followUp.delete({ where: { id: params.followUpId } });

  return NextResponse.json({ success: true });
}
