import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Attachment = { id: string; name: string; url: string; size: number; mimeType: string };

export async function GET(
  req: NextRequest,
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

  // Forward a Range header so <video> can seek/scrub (Blob storage supports range requests).
  const range = req.headers.get("range");
  const res = await fetch(attachment.url, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      ...(range ? { Range: range } : {}),
    },
  });
  if (!res.ok && res.status !== 206) return new NextResponse("Failed to fetch file", { status: 502 });

  const contentType = attachment.mimeType || res.headers.get("content-type") || "application/octet-stream";
  const inline = contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.includes("pdf");

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.name)}"`,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  };
  const contentRange = res.headers.get("content-range");
  const contentLength = res.headers.get("content-length");
  if (contentRange) headers["Content-Range"] = contentRange;
  if (contentLength) headers["Content-Length"] = contentLength;

  return new NextResponse(res.body, { status: res.status === 206 ? 206 : 200, headers });
}
