import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const VALID_ROLES = ["ADMIN", "PM", "BOOKKEEPER", "PARTNER"] as const;
type SubRole = typeof VALID_ROLES[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; userId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });

  const body = await req.json() as { role?: SubRole; resetPassword?: boolean };

  const target = await prisma.user.findFirst({
    where: { id: params.userId, companyId: params.companyId },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.resetPassword) {
    const tempPassword = randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash } });
    return NextResponse.json({ tempPassword });
  }

  if (body.role && VALID_ROLES.includes(body.role)) {
    await prisma.user.update({ where: { id: target.id }, data: { role: body.role } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No supported change" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; userId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });
  if (session.user.id === params.userId) return NextResponse.json({ error: "Can't remove yourself" }, { status: 400 });

  const target = await prisma.user.findFirst({
    where: { id: params.userId, companyId: params.companyId },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: target.id },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
