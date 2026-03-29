import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    // authenticated via cron secret
  } else {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const arrayBuffer = await file.arrayBuffer();

  let blob;
  try {
    blob = await put(
      `db-backup-${params.companyId}.sql`,
      Buffer.from(arrayBuffer),
      { access: "private", contentType: "application/sql", addRandomSuffix: false, allowOverwrite: true }
    );
  } catch (err) {
    return NextResponse.json({ error: "Blob upload failed", detail: String(err) }, { status: 500 });
  }

  await prisma.company.update({
    where: { id: params.companyId },
    data: { backupFileUrl: blob.url, backupFileDate: date },
  });

  return NextResponse.json({ url: blob.url, date });
}
