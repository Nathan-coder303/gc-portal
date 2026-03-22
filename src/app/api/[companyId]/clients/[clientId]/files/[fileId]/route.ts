import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — proxy a private blob file to an authenticated user
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; fileId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const file = await prisma.clientFile.findFirst({
    where: { id: params.fileId, clientId: params.clientId, companyId: params.companyId },
  });
  if (!file) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(file.fileUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Failed to fetch file", { status: 502 });

  const contentType = file.mimeType || res.headers.get("content-type") || "application/octet-stream";
  const inline = contentType.startsWith("image/") || contentType.includes("pdf");

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
