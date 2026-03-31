import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/[companyId]/blob-proxy?u=<encoded-blob-url>
 * Proxies a private Vercel Blob URL through an authenticated endpoint.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const blobUrl = req.nextUrl.searchParams.get("u");
  if (!blobUrl) return new NextResponse("Missing url", { status: 400 });

  // Safety: only proxy Vercel blob URLs
  if (!blobUrl.includes("vercel-storage.com") && !blobUrl.includes("blob.vercel")) {
    return new NextResponse("Invalid url", { status: 400 });
  }

  try {
    const res = await fetch(blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) {
      return new NextResponse(`Blob fetch failed: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": res.headers.get("content-disposition") ?? "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return new NextResponse(String(err), { status: 500 });
  }
}
