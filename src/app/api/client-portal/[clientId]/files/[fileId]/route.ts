import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string; fileId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const file = await prisma.clientFile.findFirst({
    where: { id: params.fileId, clientId: params.clientId, clientVisible: true },
  });
  if (!file) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(file.fileUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Blob fetch failed", { status: 502 });

  const ct = file.mimeType ?? res.headers.get("content-type") ?? "application/octet-stream";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const inline = !download && (ct.startsWith("image/") || ct.includes("pdf"));

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
