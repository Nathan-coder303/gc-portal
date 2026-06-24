import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/[companyId]/formulas?prefix=<prefix>
 *   List all formulas whose scope starts with the given prefix.
 *   Used by editor parents to batch-load formulas for a screen.
 *
 * GET /api/[companyId]/formulas?scope=<scope>
 *   Look up a single formula by exact scope.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = req.nextUrl.searchParams.get("scope");
  const prefix = req.nextUrl.searchParams.get("prefix");

  if (scope) {
    const f = await prisma.formula.findUnique({
      where: { companyId_scope: { companyId: params.companyId, scope } },
    });
    return NextResponse.json(f ? { scope: f.scope, expression: f.expression } : null);
  }

  const where = prefix
    ? { companyId: params.companyId, scope: { startsWith: prefix } }
    : { companyId: params.companyId };

  const rows = await prisma.formula.findMany({ where, select: { scope: true, expression: true } });
  return NextResponse.json(rows);
}

/** POST { scope, expression } — upsert a formula */
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { scope?: string; expression?: string };
  if (!body.scope || !body.expression) return NextResponse.json({ error: "scope + expression required" }, { status: 400 });

  const saved = await prisma.formula.upsert({
    where: { companyId_scope: { companyId: params.companyId, scope: body.scope } },
    create: { companyId: params.companyId, scope: body.scope, expression: body.expression },
    update: { expression: body.expression },
  });
  return NextResponse.json({ scope: saved.scope, expression: saved.expression });
}

/** DELETE ?scope=<scope> — remove a stored formula (when user reverts to a plain number) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = req.nextUrl.searchParams.get("scope");
  if (!scope) return NextResponse.json({ error: "scope required" }, { status: 400 });

  await prisma.formula.deleteMany({
    where: { companyId: params.companyId, scope },
  });
  return NextResponse.json({ success: true });
}
