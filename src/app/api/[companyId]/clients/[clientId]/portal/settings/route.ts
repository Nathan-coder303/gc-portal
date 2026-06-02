import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: { portalShowMessages: true, portalShowDailyPhotos: true, portalShowDocuments: true, portalShowDailyLogs: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(client);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<{
    portalShowMessages: boolean;
    portalShowDailyPhotos: boolean;
    portalShowDocuments: boolean;
    portalShowDailyLogs: boolean;
  }>;

  const allowed = ["portalShowMessages", "portalShowDailyPhotos", "portalShowDocuments", "portalShowDailyLogs"] as const;
  const data: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof body[key] === "boolean") data[key] = body[key] as boolean;
  }

  const client = await prisma.client.update({
    where: { id: params.clientId },
    data,
    select: { portalShowMessages: true, portalShowDailyPhotos: true, portalShowDocuments: true, portalShowDailyLogs: true },
  });

  return NextResponse.json(client);
}
