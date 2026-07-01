import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET — active items on top, done at the bottom */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.pantryItem.findMany({
    where: { userId: session.user.id },
    orderBy: [{ done: "asc" }, { alwaysNeeded: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

/**
 * POST — add items. Two shapes supported:
 *   { text }                 → single row (kept for the manual text box)
 *   { items: Row[] }         → batch add (used by the voice-review table)
 *
 * A Row is { text, qty?, alwaysNeeded? }.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    text?: string;
    items?: { text: string; qty?: string | null; alwaysNeeded?: boolean }[];
  };

  const rows: { text: string; qty: string | null; alwaysNeeded: boolean }[] = [];
  if (Array.isArray(body.items)) {
    for (const it of body.items) {
      const text = (it.text ?? "").trim();
      if (!text) continue;
      rows.push({
        text,
        qty: it.qty?.trim() || null,
        alwaysNeeded: !!it.alwaysNeeded,
      });
    }
  } else if (typeof body.text === "string") {
    for (const part of body.text.split(/\n+|,| and | y | et /gi)) {
      const t = part.replace(/^[-•*]\s*/, "").trim();
      if (t) rows.push({ text: t, qty: null, alwaysNeeded: false });
    }
  }

  if (rows.length === 0) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const created = await Promise.all(
    rows.map(r => prisma.pantryItem.create({
      data: { userId: session.user.id, text: r.text, qty: r.qty, alwaysNeeded: r.alwaysNeeded },
    })),
  );
  return NextResponse.json(created);
}
