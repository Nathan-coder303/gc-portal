import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20MB" }, { status: 400 });

  try {
    const blob = await put(`bid-pdfs/${Date.now()}-${file.name}`, file, { access: "private" });

    // Return a proxy URL so the private blob is served through an authenticated endpoint
    const proxyUrl = `/api/${params.companyId}/blob-proxy?u=${encodeURIComponent(blob.url)}`;

    return NextResponse.json({ url: proxyUrl, fileName: file.name });
  } catch (err) {
    console.error("Bid upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
