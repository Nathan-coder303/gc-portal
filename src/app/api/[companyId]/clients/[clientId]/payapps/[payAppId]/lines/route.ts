import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Replace all lines for a pay app
export async function PUT(req: NextRequest, { params }: { params: { companyId: string; clientId: string; payAppId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lines } = await req.json();
  if (!Array.isArray(lines)) return NextResponse.json({ error: "lines must be array" }, { status: 400 });

  // Delete all existing lines and recreate
  await prisma.payAppLine.deleteMany({ where: { payAppId: params.payAppId } });

  if (lines.length > 0) {
    await prisma.payAppLine.createMany({
      data: lines.map((l: {
        sortOrder: number; itemNumber: string; description: string;
        scheduledValue: number; fromPrevious: number; thisInvoice: number;
        retainageThis: number; retainageTotal: number;
      }, i: number) => ({
        payAppId: params.payAppId,
        sortOrder: l.sortOrder ?? i,
        itemNumber: l.itemNumber ?? "",
        description: l.description ?? "",
        scheduledValue: Number(l.scheduledValue) || 0,
        fromPrevious: Number(l.fromPrevious) || 0,
        thisInvoice: Number(l.thisInvoice) || 0,
        retainageThis: Number(l.retainageThis) || 0,
        retainageTotal: Number(l.retainageTotal) || 0,
      })),
    });
  }

  // Touch updatedAt on parent
  await prisma.payApp.update({ where: { id: params.payAppId }, data: { updatedAt: new Date() } });

  return NextResponse.json({ ok: true });
}
