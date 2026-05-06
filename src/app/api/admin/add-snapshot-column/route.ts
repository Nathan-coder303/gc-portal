import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "EstimateVersion" ADD COLUMN IF NOT EXISTS "snapshot" JSONB`
  );
  return NextResponse.json({ ok: true });
}
