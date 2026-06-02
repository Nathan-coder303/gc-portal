import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const attachmentId = req.nextUrl.searchParams.get("attachment");
  if (!attachmentId) return new NextResponse("attachment param required", { status: 400 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId },
    select: { attachments: true },
  });
  if (!log) return new NextResponse("Not found", { status: 404 });

  type A = { id: string; name: string; url: string; mimeType: string };
  const atts: A[] = log.attachments ? JSON.parse(log.attachments) : [];
  const att = atts.find(a => a.id === attachmentId);
  if (!att) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(att.url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Failed", { status: 502 });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": att.mimeType || "image/jpeg",
      "Content-Disposition": `inline; filename="${encodeURIComponent(att.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
