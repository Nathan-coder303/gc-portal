import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use normal Prisma for type-safe fields, raw SQL only for `snapshot`
  // (Vercel caches an older Prisma client that doesn't know about the snapshot column)
  const [versions, snapshotRows] = await Promise.all([
    prisma.estimateVersion.findMany({
      where: { templateId: params.templateId, companyId: params.companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, total: true, subtotal: true, gcFee: true, createdAt: true, createdBy: true },
    }),
    prisma.$queryRaw<{ id: string; snapshot: unknown }[]>(Prisma.sql`
      SELECT id, snapshot FROM "EstimateVersion"
      WHERE "templateId" = ${params.templateId} AND "companyId" = ${params.companyId}
    `),
  ]);

  const snapshotMap = new Map(snapshotRows.map(r => [r.id, r.snapshot ?? null]));

  return NextResponse.json(versions.map(v => ({
    id: v.id,
    label: v.label,
    total: Number(v.total),
    subtotal: Number(v.subtotal),
    gcFee: Number(v.gcFee),
    snapshot: snapshotMap.get(v.id) ?? null,
    createdAt: v.createdAt.toISOString(),
    createdBy: v.createdBy,
  })));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, total, subtotal, gcFee, clientId, snapshot } = body as {
    label?: string; total?: number; subtotal?: number; gcFee?: number; clientId?: string; snapshot?: unknown;
  };

  if (!clientId || total == null || subtotal == null || gcFee == null) {
    return NextResponse.json({ error: "clientId, total, subtotal, gcFee required" }, { status: 400 });
  }

  // Create without snapshot to avoid Prisma stale-cache type error
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

  // Set snapshot via raw SQL — bypasses Prisma's stale generated client
  if (snapshot != null) {
    await prisma.$executeRaw`
      UPDATE "EstimateVersion" SET snapshot = ${JSON.stringify(snapshot)}::jsonb WHERE id = ${version.id}
    `;
  }

  return NextResponse.json({
    ...version,
    total: Number(version.total),
    subtotal: Number(version.subtotal),
    gcFee: Number(version.gcFee),
    createdAt: version.createdAt.toISOString(),
  });
}
