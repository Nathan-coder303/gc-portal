import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type StoredAttachment = { id: string; name: string; url: string; size: number; mimeType: string };

/**
 * GET /api/co-attachment/[changeOrderId]/[attachmentId]
 *
 * Public proxy for Change Order attachments — no session required so the
 * URL works when embedded in a Change Order PDF that's emailed to a client.
 * Access control is by knowing the (random) attachmentId + changeOrderId
 * pair; both must match an existing attachment on that CO.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { changeOrderId: string; attachmentId: string } }
) {
  const co = await prisma.changeOrder.findUnique({
    where: { id: params.changeOrderId },
    select: { attachments: true },
  });
  if (!co?.attachments) return new NextResponse("Not found", { status: 404 });

  let attachments: StoredAttachment[];
  try {
    attachments = JSON.parse(co.attachments);
    if (!Array.isArray(attachments)) return new NextResponse("Not found", { status: 404 });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const att = attachments.find(a => a.id === params.attachmentId);
  if (!att) return new NextResponse("Not found", { status: 404 });

  try {
    const upstream = await fetch(att.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok) {
      return new NextResponse(`Blob fetch failed: ${upstream.status}`, { status: upstream.status });
    }
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": att.mimeType || upstream.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `inline; filename="${att.name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return new NextResponse(String(err), { status: 500 });
  }
}
