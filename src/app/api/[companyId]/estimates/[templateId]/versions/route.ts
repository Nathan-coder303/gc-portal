import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const versions = await prisma.estimateVersion.findMany({
    where: { templateId: params.templateId, companyId: params.companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, total: true, subtotal: true, gcFee: true, createdAt: true, createdBy: true },
  });

  return NextResponse.json(versions.map(v => ({
    ...v,
    total: Number(v.total),
    subtotal: Number(v.subtotal),
    gcFee: Number(v.gcFee),
    createdAt: v.createdAt.toISOString(),
  })));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, total, subtotal, gcFee, clientId } = body as {
    label?: string; total?: number; subtotal?: number; gcFee?: number; clientId?: string;
  };

  if (!clientId || total == null || subtotal == null || gcFee == null) {
    return NextResponse.json({ error: "clientId, total, subtotal, gcFee required" }, { status: 400 });
  }

  const version = await prisma.estimateVersion.create({
    data: {
      companyId: params.companyId,
      clientId,
      templateId: params.templateId,
      label: label?.trim() || "Manual save",
      total,
      subtotal,
      gcFee,
      createdBy: session.user.name ?? session.user.email ?? null,
    },
  });

  return NextResponse.json({ ...version, total: Number(version.total), subtotal: Number(version.subtotal), gcFee: Number(version.gcFee), createdAt: version.createdAt.toISOString() });
}
