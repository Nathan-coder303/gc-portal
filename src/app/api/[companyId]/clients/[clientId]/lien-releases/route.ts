import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const releases = await prisma.lienRelease.findMany({
    where: { clientId: params.clientId, companyId: params.companyId, archivedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(releases);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, subName, recipientEmail, amount, throughDate, legalDescription } = await req.json();

  if (!type || !subName || !legalDescription) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const signatureToken = randomBytes(32).toString("hex");

  const release = await prisma.lienRelease.create({
    data: {
      clientId: params.clientId,
      companyId: params.companyId,
      type,
      subName,
      recipientEmail: recipientEmail || null,
      amount: amount || null,
      throughDate: throughDate || null,
      legalDescription,
      signatureToken,
    },
  });

  return NextResponse.json(release);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.$executeRawUnsafe(
    `UPDATE "LienRelease" SET "archivedAt" = NOW() WHERE id = $1 AND "companyId" = $2`,
    id, params.companyId,
  );

  return NextResponse.json({ success: true });
}
