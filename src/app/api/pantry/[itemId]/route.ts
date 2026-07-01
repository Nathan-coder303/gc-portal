import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.pantryItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { text?: string; done?: boolean };
  const updated = await prisma.pantryItem.update({
    where: { id: params.itemId },
    data: {
      ...(body.text !== undefined ? { text: body.text.trim() } : {}),
      ...(body.done !== undefined ? { done: !!body.done } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.pantryItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pantryItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ success: true });
}
