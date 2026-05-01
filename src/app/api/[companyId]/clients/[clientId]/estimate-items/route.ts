import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.estimateTemplateItem.findMany({
    where: {
      division: {
        template: {
          companyId: params.companyId,
          clientId: params.clientId,
          archivedAt: null,
        },
      },
    },
    select: { name: true },
    distinct: ["name"],
    orderBy: { name: "asc" },
  });

  return NextResponse.json(items.map((i) => i.name));
}
