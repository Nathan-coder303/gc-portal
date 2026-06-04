import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// GET — list all portal users (client-portal logins) for this client
export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portalUsers = await prisma.user.findMany({
    where: { clientId: params.clientId, role: "CLIENT", archivedAt: null },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Keep backward-compat with old single-user UI: surface the first as portalUser
  return NextResponse.json({
    portalUser: portalUsers[0] ?? null,
    portalUsers,
  });
}

// POST — add a new portal user (or reset password for an existing email)
export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password, name } = await req.json();
  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  // If this email already exists, only allow updating it if it's already attached to THIS client
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    if (existing.clientId !== params.clientId) {
      return NextResponse.json({ error: "Email already in use by another account" }, { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, name: name?.trim() || existing.name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return NextResponse.json({ portalUser: updated });
  }

  const created = await prisma.user.create({
    data: {
      companyId: params.companyId,
      email: cleanEmail,
      name: name?.trim() || client.name,
      role: "CLIENT",
      passwordHash,
      clientId: params.clientId,
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return NextResponse.json({ portalUser: created });
}

// DELETE — remove a portal user. If ?userId=X provided, remove that one; otherwise remove ALL (backward compat).
export async function DELETE(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId, clientId: params.clientId, role: "CLIENT" } });
  } else {
    await prisma.user.deleteMany({ where: { clientId: params.clientId, role: "CLIENT" } });
  }

  return NextResponse.json({ ok: true });
}
