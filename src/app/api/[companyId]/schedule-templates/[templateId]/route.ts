import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET full template including tasks
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tpl = await prisma.scheduleSavedTemplate.findFirst({
    where: { id: params.templateId, companyId: params.companyId },
  });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tpl);
}

// PATCH — overwrite with updated tasks / rename
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const tpl = await prisma.scheduleSavedTemplate.update({
    where: { id: params.templateId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.tasks !== undefined && { tasks: body.tasks }),
    },
  });
  return NextResponse.json(tpl);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.scheduleSavedTemplate.delete({ where: { id: params.templateId } });
  return NextResponse.json({ success: true });
}
