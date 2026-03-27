import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/[companyId]/notes?leadId=...  OR  ?clientId=...
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  const clientId = req.nextUrl.searchParams.get("clientId");

  if (!leadId && !clientId) {
    return NextResponse.json({ error: "leadId or clientId required" }, { status: 400 });
  }

  const notes = await prisma.note.findMany({
    where: {
      companyId: params.companyId,
      ...(leadId ? { leadId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { noteDate: "desc" },
  });

  return NextResponse.json(notes);
}

// POST /api/[companyId]/notes
// body: { leadId?, clientId?, content, noteDate? }
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { leadId, clientId, content, noteDate } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (!leadId && !clientId) {
    return NextResponse.json({ error: "leadId or clientId required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      companyId: params.companyId,
      leadId: leadId || null,
      clientId: clientId || null,
      content: content.trim(),
      noteDate: noteDate ? new Date(noteDate) : new Date(),
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(note);
}

// DELETE /api/[companyId]/notes?noteId=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const noteId = req.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  await prisma.note.deleteMany({
    where: { id: noteId, companyId: params.companyId },
  });

  return NextResponse.json({ success: true });
}
