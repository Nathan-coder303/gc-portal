import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string; docId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const doc = await prisma.clientPortalDocument.findFirst({
    where: { id: params.docId, clientId: params.clientId },
  });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(doc.fileUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Blob fetch failed", { status: 502 });

  const buffer = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  const download = req.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.fileName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
