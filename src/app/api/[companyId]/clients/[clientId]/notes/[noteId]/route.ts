import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// PATCH — edit a note's transcription text
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; noteId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { transcription } = body;
  if (transcription === undefined) return NextResponse.json({ error: "transcription required" }, { status: 400 });

  await prisma.clientNote.updateMany({
    where: { id: params.noteId, clientId: params.clientId, companyId: params.companyId },
    data: { transcription: transcription || null },
  });

  return NextResponse.json({ success: true });
}

// GET — proxy the private audio blob for a note
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; noteId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const note = await prisma.clientNote.findFirst({
    where: { id: params.noteId, clientId: params.clientId, companyId: params.companyId },
  });
  if (!note || !note.audioUrl) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(note.audioUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Failed to fetch audio", { status: 502 });

  // Prefer stored mimeType → blob Content-Type header → sniff from URL extension
  const urlExt = note.audioUrl?.split("?")[0].split(".").pop()?.toLowerCase();
  const extMime = urlExt === "m4a" || urlExt === "mp4" ? "audio/mp4" : "audio/webm";
  const contentType = note.audioMimeType || res.headers.get("content-type") || extMime;

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
