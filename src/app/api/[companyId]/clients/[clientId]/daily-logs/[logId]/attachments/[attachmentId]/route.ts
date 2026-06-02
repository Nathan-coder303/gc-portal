import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Attachment = { id: string; name: string; url: string; size: number; mimeType: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string; attachmentId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    select: { attachments: true },
  });
  if (!log) return new NextResponse("Not found", { status: 404 });

  let attachments: Attachment[] = [];
  try { attachments = log.attachments ? JSON.parse(log.attachments) : []; } catch { /* */ }

  const attachment = attachments.find(a => a.id === params.attachmentId);
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(attachment.url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Failed to fetch file", { status: 502 });

  const contentType = attachment.mimeType || res.headers.get("content-type") || "application/octet-stream";
  const inline = contentType.startsWith("image/") || contentType.includes("pdf");

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
