import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

// GET — list all custom cover photos uploaded for this client
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { blobs } = await list({
      prefix: `client-covers/${params.clientId}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const covers = blobs
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map((blob) => ({
        blobUrl: blob.url,
        proxyUrl: `/api/${params.companyId}/clients/${params.clientId}/cover?b=${encodeURIComponent(blob.url)}`,
        uploadedAt: blob.uploadedAt,
        filename: blob.pathname.split("/").pop() ?? blob.pathname,
      }));

    return NextResponse.json({ covers });
  } catch (err) {
    console.error("Failed to list covers:", err);
    return NextResponse.json({ covers: [] });
  }
}
