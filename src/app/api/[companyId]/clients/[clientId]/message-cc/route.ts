import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: { messageCcEmails: true },
  });
  return NextResponse.json({ emails: (client?.messageCcEmails as string[] | null) ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emails } = await req.json() as { emails: string[] };
  const cleaned = Array.from(new Set((emails ?? []).map(e => e.trim()).filter(e => EMAIL.test(e))));

  await prisma.client.update({
    where: { id: params.clientId },
    data: { messageCcEmails: cleaned.length > 0 ? cleaned : [] },
  });

  return NextResponse.json({ emails: cleaned });
}
