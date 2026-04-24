import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string; photoId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  // CLIENT role can only access their own portal; ADMIN/PM/etc can access any
  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const photo = await prisma.clientPortalPhoto.findFirst({
    where: { id: params.photoId, clientId: params.clientId },
  });
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(photo.fileUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Blob fetch failed", { status: 502 });

  const buffer = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `inline; filename="${photo.fileName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
