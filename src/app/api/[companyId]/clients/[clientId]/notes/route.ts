import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

// GET — list notes for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notes = await prisma.clientNote.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

// POST — create a note (multipart: optional audio file + transcription text)
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const transcription = formData.get("transcription") as string | null;
  const audio = formData.get("audio") as File | null;

  let audioUrl: string | null = null;
  let audioSize: number | null = null;
  let audioMimeType: string | null = null;

  if (audio && audio.size > 0) {
    const mime = audio.type || "audio/webm";
    const ext = mime.includes("mp4") || mime.includes("aac") ? "m4a" : "webm";
    const blob = await put(
      `client-notes/${params.clientId}/${Date.now()}.${ext}`,
      audio,
      { access: "private", contentType: mime }
    );
    audioUrl = blob.url;
    audioSize = audio.size;
    audioMimeType = mime;
  }

  const note = await prisma.clientNote.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      transcription: transcription || null,
      audioUrl,
      audioMimeType,
      audioSize,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(note);
}

// DELETE — remove a note by id (query param ?noteId=...)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const noteId = req.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  const note = await prisma.clientNote.findFirst({
    where: { id: noteId, clientId: params.clientId, companyId: params.companyId },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (note.audioUrl) {
    try { await del(note.audioUrl); } catch { /* non-fatal */ }
  }

  await prisma.clientNote.delete({ where: { id: noteId } });

  return NextResponse.json({ success: true });
}
