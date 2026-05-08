import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Proxy any private Vercel Blob URL that belongs to this company.
// Used by the company-wide cover gallery in CoverPagePickerModal.
export async function GET(
  req: NextRequest
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const bParam = req.nextUrl.searchParams.get("b");
  if (!bParam) return new NextResponse("Missing b param", { status: 400 });

  const blobUrl = decodeURIComponent(bParam);
  if (!blobUrl.includes("vercel-storage.com")) {
    return new NextResponse("Invalid blob URL", { status: 400 });
  }

  try {
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
  } catch {
    return new NextResponse("Proxy error", { status: 502 });
  }
}
