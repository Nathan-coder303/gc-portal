import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { FollowUpCategory } from "@prisma/client";

export const runtime = "nodejs";

// GET — list follow-ups for a company, optionally filtered by ?category=TASK
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const category = req.nextUrl.searchParams.get("category") as FollowUpCategory | null;

  const items = await prisma.followUp.findMany({
    where: {
      companyId: params.companyId,
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(items);
}

// POST — create a follow-up (multipart FormData)
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const category = (formData.get("category") as string | null) || "TASK";
  const text = (formData.get("text") as string | null) || "";
  const clientId = (formData.get("clientId") as string | null) || null;
  const leadId = (formData.get("leadId") as string | null) || null;
  const dueDate = (formData.get("dueDate") as string | null) || null;
  const audio = formData.get("audio") as File | null;

  let audioUrl: string | null = null;
  let audioSize: number | null = null;
  let audioMimeType: string | null = null;

  if (audio && audio.size > 0) {
    const mime = audio.type || "audio/webm";
    const ext = mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a") ? "m4a" : "webm";
    const blob = await put(
      `follow-ups/${params.companyId}/${Date.now()}.${ext}`,
      audio,
      { access: "private", contentType: mime }
    );
    audioUrl = blob.url;
    audioSize = audio.size;
    audioMimeType = mime;
  }

  if (!text && !audioUrl) {
    return NextResponse.json({ error: "text or audio required" }, { status: 400 });
  }

  // Validate clientId belongs to this company
  let validClientId: string | null = null;
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId: params.companyId },
    });
    validClientId = client ? clientId : null;
  }

  // Validate leadId belongs to this company
  let validLeadId: string | null = null;
  if (leadId && !validClientId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, companyId: params.companyId },
    });
    validLeadId = lead ? leadId : null;
  }

  const item = await prisma.followUp.create({
    data: {
      companyId: params.companyId,
      category: category as FollowUpCategory,
      text,
      audioUrl,
      audioMimeType,
      audioSize,
      clientId: validClientId,
      leadId: validLeadId,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: session.user.id,
    },
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(item);
}
