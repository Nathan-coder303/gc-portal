import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

// GET — proxy a client's custom cover image (private blob)
// ?b=encodeURIComponent(blobUrl) → proxy that specific blob
// (no param) → proxy client.coverPhotoUrl
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  // Verify client belongs to company
  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: { coverPhotoType: true, coverPhotoUrl: true },
  });
  if (!client) return new NextResponse("Not found", { status: 404 });

  // Determine which blob to proxy
  const bParam = req.nextUrl.searchParams.get("b");
  let blobUrl: string | null = null;
  if (bParam) {
    blobUrl = decodeURIComponent(bParam);
  } else {
    if (!client.coverPhotoUrl || client.coverPhotoType !== "CUSTOM") {
      return new NextResponse("Not found", { status: 404 });
    }
    blobUrl = client.coverPhotoUrl;
  }

  const res = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new NextResponse("Blob not found", { status: 404 });

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// POST — upload a custom cover photo for a client
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  // Keep old covers — do NOT delete (user wants a gallery of past uploads)

  try {
    const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "_");
    const blob = await put(
      `client-covers/${params.clientId}/${Date.now()}-${safeName}`,
      file,
      { access: "private" }
    );

    await prisma.client.update({
      where: { id: params.clientId },
      data: { coverPhotoType: "CUSTOM", coverPhotoUrl: blob.url },
    });

    // Return proxy URL — the direct blob URL is private
    const proxyUrl = `/api/${params.companyId}/clients/${params.clientId}/cover`;
    return NextResponse.json({ url: proxyUrl });
  } catch (err) {
    console.error("Cover upload failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
