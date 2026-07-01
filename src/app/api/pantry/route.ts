import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET — list current user's pantry items, active on top, done at the bottom */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.pantryItem.findMany({
    where: { userId: session.user.id },
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

/**
 * POST — add one or more items.
 *   Body: { text }  → single item  (also splits on commas / "and" / newlines
 *                    so a one-liner "eggs, milk and bread" adds 3 rows)
 *   Body: { items: string[] }  → add many
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { text?: string; items?: string[] };

  let raw: string[] = [];
  if (Array.isArray(body.items)) raw = body.items;
  else if (typeof body.text === "string") raw = [body.text];

  const parts = raw
    .flatMap(s => s.split(/\n+|,| and | y | et /gi))
    .map(s => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  if (parts.length === 0) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const created = await Promise.all(
    parts.map(text => prisma.pantryItem.create({ data: { userId: session.user.id, text } })),
  );
  return NextResponse.json(created);
}
