import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.scheduleSavedTemplate.findMany({
    where: { companyId: params.companyId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(templates);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, tasks } = body;
  if (!name || !tasks) return NextResponse.json({ error: "name and tasks required" }, { status: 400 });

  const tpl = await prisma.scheduleSavedTemplate.create({
    data: { companyId: params.companyId, name, description: description ?? null, tasks },
  });
  return NextResponse.json(tpl);
}
