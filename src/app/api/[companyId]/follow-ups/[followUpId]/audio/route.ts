import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; followUpId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const item = await prisma.followUp.findFirst({
    where: { id: params.followUpId, companyId: params.companyId },
  });
  if (!item || !item.audioUrl) return new NextResponse("Not found", { status: 404 });

  const res = await fetch(item.audioUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Failed to fetch audio", { status: 502 });

  const contentType = item.audioMimeType || res.headers.get("content-type") || "audio/webm";

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
