import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; logId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const log = await prisma.dailyLog.findFirst({
    where: { id: params.logId, clientId: params.clientId, companyId: params.companyId },
    select: { id: true },
  });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { filename } = await req.json() as { filename: string };
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `daily-logs/${params.logId}/${Date.now()}-${safe}`;

  const token = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    pathname,
    maximumSizeInBytes: 200 * 1024 * 1024,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return NextResponse.json({ token, pathname });
}
