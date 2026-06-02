import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT" && session.user.clientId !== params.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.dailyLog.findMany({
    where: { clientId: params.clientId },
    select: { id: true, arrivalDate: true, attachments: true },
    orderBy: { arrivalDate: "desc" },
  });

  type RawAtt = { id: string; name: string; url: string; mimeType: string };
  const photos: { logId: string; logDate: string; id: string; name: string; mimeType: string }[] = [];

  for (const log of logs) {
    if (!log.attachments) continue;
    try {
      const atts: RawAtt[] = JSON.parse(log.attachments);
      for (const att of atts) {
        if (att.mimeType?.startsWith("image/")) {
          photos.push({
            logId: log.id,
            logDate: log.arrivalDate.toISOString().slice(0, 10),
            id: att.id,
            name: att.name,
            mimeType: att.mimeType,
          });
        }
      }
    } catch { /* skip malformed */ }
  }

  return NextResponse.json(photos);
}
