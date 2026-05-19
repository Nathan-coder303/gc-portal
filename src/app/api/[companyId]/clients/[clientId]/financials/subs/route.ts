import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.clientSub.findMany({
    where: { clientId: params.clientId, companyId: params.companyId },
    orderBy: { createdAt: "asc" },
    include: {
      subContractor: { select: { id: true, name: true } },
      payments: { orderBy: { paidAt: "asc" } },
      scopeItems: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json(subs.map(s => ({
    id: s.id,
    subContractorId: s.subContractorId,
    subName: s.subName ?? s.subContractor?.name ?? "",
    scope: s.scope ?? null,
    division: s.division ?? null,
    contractAmount: Number(s.contractAmount),
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    payments: s.payments.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt.toISOString().slice(0, 10),
      checkNumber: p.checkNumber,
      notes: p.notes,
    })),
    scopeItems: s.scopeItems.map(i => ({
      id: i.id,
      csiCode: i.csiCode,
      name: i.name,
      amount: Number(i.amount),
    })),
  })));
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string; clientId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subName, scope, division, contractAmount, notes } = body;
  let { subContractorId } = body;

  // Auto-create SubContractor in the global database when adding a new name
  if (!subContractorId && subName) {
    const divParts = typeof division === "string" ? division.split(" · ") : [];
    const divCode = divParts[0]?.trim() || "00 00 00";
    const divName = divParts.slice(1).join(" · ").trim() || "General";

    const existing = await prisma.subContractor.findFirst({
      where: { companyId: params.companyId, name: { equals: subName, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      subContractorId = existing.id;
    } else {
      const newSub = await prisma.subContractor.create({
        data: {
          companyId: params.companyId,
          name: subName,
          divisionCode: divCode,
          divisionName: divName,
          source: "manual",
        },
      });
      subContractorId = newSub.id;
    }
  }

  const sub = await prisma.clientSub.create({
    data: {
      companyId: params.companyId,
      clientId: params.clientId,
      subContractorId: subContractorId || null,
      subName: subName || null,
      scope: scope || null,
      division: division || null,
      contractAmount: contractAmount ?? 0,
      notes: notes || null,
    },
    include: { payments: true },
  });

  return NextResponse.json({
    id: sub.id,
    subContractorId: sub.subContractorId,
    subName: sub.subName,
    scope: sub.scope ?? null,
    division: sub.division ?? null,
    contractAmount: Number(sub.contractAmount),
    notes: sub.notes,
    createdAt: sub.createdAt.toISOString(),
    payments: [],
    scopeItems: [],
  });
}
