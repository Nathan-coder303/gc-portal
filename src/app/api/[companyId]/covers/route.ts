import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { list, del } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    where: { companyId: params.companyId },
    select: { id: true, coverPhotoUrl: true, coverPhotoType: true },
  });

  const clientIdSet = new Set(clients.map((c) => c.id));

  try {
    const { blobs } = await list({
      prefix: "client-covers/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const seenUrls = new Set<string>();

    // Filter blobs to only this company's clients (pathname: client-covers/${clientId}/filename)
    const covers = blobs
      .filter((blob) => {
        const clientId = blob.pathname.split("/")[1];
        return clientId && clientIdSet.has(clientId);
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map((blob) => {
        seenUrls.add(blob.url);
        return {
          blobUrl: blob.url,
          proxyUrl: `/api/${params.companyId}/cover-proxy?b=${encodeURIComponent(blob.url)}`,
          filename: blob.pathname.split("/").pop() ?? blob.pathname,
        };
      });

    // Also surface any stored coverPhotoUrl values that didn't appear in the blob list
    for (const client of clients) {
      if (client.coverPhotoType === "CUSTOM" && client.coverPhotoUrl && !seenUrls.has(client.coverPhotoUrl)) {
        covers.unshift({
          blobUrl: client.coverPhotoUrl,
          proxyUrl: `/api/${params.companyId}/cover-proxy?b=${encodeURIComponent(client.coverPhotoUrl)}`,
          filename: "cover",
        });
        seenUrls.add(client.coverPhotoUrl);
      }
    }

    return NextResponse.json({ covers });
  } catch (err) {
    console.error("Failed to list company covers:", err);
    // Fallback: return whatever is stored in the DB
    const fallback = clients
      .filter((c) => c.coverPhotoType === "CUSTOM" && c.coverPhotoUrl)
      .map((c) => ({
        blobUrl: c.coverPhotoUrl!,
        proxyUrl: `/api/${params.companyId}/cover-proxy?b=${encodeURIComponent(c.coverPhotoUrl!)}`,
        filename: "cover",
      }));
    return NextResponse.json({ covers: fallback });
  }
}

// DELETE ?b=encodedBlobUrl — remove a cover blob
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bParam = req.nextUrl.searchParams.get("b");
  if (!bParam) return NextResponse.json({ error: "Missing b param" }, { status: 400 });

  const blobUrl = decodeURIComponent(bParam);
  if (!blobUrl.includes("vercel-storage.com"))
    return NextResponse.json({ error: "Invalid blob URL" }, { status: 400 });

  try {
    await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    // Clear coverPhotoUrl on any client that references this blob
    await prisma.client.updateMany({
      where: { companyId: params.companyId, coverPhotoUrl: blobUrl },
      data: { coverPhotoUrl: null, coverPhotoType: "NONE" },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 502 });
  }
}
