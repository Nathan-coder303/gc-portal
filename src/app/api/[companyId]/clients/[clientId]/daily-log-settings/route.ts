import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dailyLogEmailEnabled } = await req.json() as { dailyLogEmailEnabled: boolean };

  const client = await prisma.client.update({
    where: { id: params.clientId },
    data: { dailyLogEmailEnabled },
    select: { dailyLogEmailEnabled: true },
  });

  return NextResponse.json(client);
}
