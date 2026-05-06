import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SECRET = "8280";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Add column (idempotent)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "EstimateVersion" ADD COLUMN IF NOT EXISTS "snapshot" JSONB`
  );
  // Test write
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "EstimateVersion" LIMIT 1`
  );
  let writeTest = "no rows to test";
  if (rows.length > 0) {
    const testId = rows[0].id;
    await prisma.$executeRawUnsafe(
      `UPDATE "EstimateVersion" SET snapshot = $1::jsonb WHERE id = $2`,
      JSON.stringify({ _test: true }),
      testId,
    );
    const check = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(
      `SELECT snapshot IS NOT NULL as ok FROM "EstimateVersion" WHERE id = $1`,
      testId,
    );
    writeTest = check[0]?.ok ? "write succeeded" : "write failed — snapshot still null";
    // Revert test row
    await prisma.$executeRawUnsafe(
      `UPDATE "EstimateVersion" SET snapshot = NULL WHERE id = $1 AND snapshot = '{"_test":true}'::jsonb`,
      testId,
    );
  }
  return NextResponse.json({ ok: true, column: "added/verified", writeTest });
}
