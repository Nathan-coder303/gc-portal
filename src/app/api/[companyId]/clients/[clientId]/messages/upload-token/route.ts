import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename } = await req.json() as { filename: string };
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `messages/${params.clientId}/${Date.now()}-${safe}`;

  const token = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    pathname,
    maximumSizeInBytes: 25 * 1024 * 1024,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return NextResponse.json({ token, pathname });
}
