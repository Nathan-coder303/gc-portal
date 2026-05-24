import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { companyId: string; subId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("isFavorite" in body) {
    data.isFavorite = body.isFavorite;
  } else if ("emailOnly" in body) {
    data.email = body.email ?? null;
  } else {
    data.name = body.name;
    data.contactName = body.contactName ?? null;
    data.address = body.address ?? null;
    const cleanEmails = ((body.emailList ?? []) as string[]).map((e: string) => e.trim()).filter(Boolean);
    data.email = cleanEmails[0] ?? body.email ?? null;
    data.emailList = cleanEmails.length > 0 ? cleanEmails : null;
    data.phone = body.phone ?? null;
    data.divisionCode = body.divisionCode;
    data.divisionName = body.divisionName;
    data.notes = body.notes ?? null;
  }
  const sub = await prisma.subContractor.update({
    where: { id: params.subId },
    data,
  });
  return NextResponse.json(sub);
}

export async function DELETE(_req: NextRequest, { params }: { params: { companyId: string; subId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.subContractor.delete({ where: { id: params.subId } });
  return NextResponse.json({ ok: true });
}
