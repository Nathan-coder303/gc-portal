import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; emailId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.clientEmail.delete({ where: { id: params.emailId } });
  return NextResponse.json({ success: true });
}
