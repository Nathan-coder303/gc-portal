import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SheetData = {
  dates: string[];
  employees: { id: string; name: string; payPerDay: number; attendance: Record<string, boolean> }[];
};

function blank(): SheetData { return { dates: [], employees: [] }; }

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sheet = await prisma.signInSheet.findUnique({
    where: { estimateTemplateId: params.templateId },
  });
  if (!sheet) return NextResponse.json(blank());
  try { return NextResponse.json(JSON.parse(sheet.data) as SheetData); }
  catch { return NextResponse.json(blank()); }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as SheetData | null;
  if (!body || !Array.isArray(body.dates) || !Array.isArray(body.employees)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Verify the estimate belongs to this company
  const est = await prisma.estimateTemplate.findFirst({
    where: { id: params.templateId, companyId: params.companyId },
    select: { id: true },
  });
  if (!est) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.signInSheet.upsert({
    where: { estimateTemplateId: params.templateId },
    create: {
      companyId: params.companyId,
      estimateTemplateId: params.templateId,
      data: JSON.stringify(body),
    },
    update: { data: JSON.stringify(body) },
  });
  return NextResponse.json({ success: true });
}
