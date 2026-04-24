import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const FROM = "cmme9q6fg0000hriagrothwrc";
  const TO = req.nextUrl.searchParams.get("to");
  if (!TO) return NextResponse.json({ error: "Missing ?to= param" }, { status: 400 });

  const result = await prisma.subBid.updateMany({
    where: { companyId: FROM, fileUrl: { startsWith: "gmail:" } },
    data: { companyId: TO },
  });

  return NextResponse.json({ migrated: result.count, from: FROM, to: TO });
}
