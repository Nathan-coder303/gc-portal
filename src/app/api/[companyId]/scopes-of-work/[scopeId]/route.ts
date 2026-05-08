import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; scopeId: string } }
) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, title, body } = await req.json() as { name?: string; title?: string; body?: string };
  if (!name?.trim() || !title?.trim() || !body?.trim())
    return NextResponse.json({ error: "name, title, and body are required" }, { status: 400 });

  const scope = await prisma.scopeOfWork.update({
    where: { id: params.scopeId },
    data: { name: name.trim(), title: title.trim(), body: body.trim() },
    select: { id: true, name: true, title: true, body: true },
  });
  return NextResponse.json({ scope });
}
