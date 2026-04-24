import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// GET — check if portal user exists for this client
export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portalUser = await prisma.user.findUnique({
    where: { clientId: params.clientId },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return NextResponse.json({ portalUser: portalUser ?? null });
}

// POST — create or reset portal credentials for a client
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

  const passwordHash = await bcrypt.hash(password, 10);

  // Check if portal user already exists
  const existing = await prisma.user.findUnique({ where: { clientId: params.clientId } });

  if (existing) {
    // Reset credentials
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { email: email.trim(), passwordHash, name: name?.trim() || client.name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return NextResponse.json({ portalUser: updated });
  }

  // Check if email already taken
  const emailTaken = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (emailTaken) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Create new portal user
  const created = await prisma.user.create({
    data: {
      companyId: params.companyId,
      email: email.trim(),
      name: name?.trim() || client.name,
      role: "CLIENT",
      passwordHash,
      clientId: params.clientId,
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return NextResponse.json({ portalUser: created });
}

// DELETE — remove portal access for this client
export async function DELETE(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.user.findUnique({ where: { clientId: params.clientId } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  return NextResponse.json({ ok: true });
}
