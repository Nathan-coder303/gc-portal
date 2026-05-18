import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/sign-doc/pdf?token=xxx — public: serve the original PDF for viewing
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new Response("token required", { status: 400 });

  const doc = await prisma.clientDocument.findUnique({
    where: { signatureToken: token },
    select: { originalFileUrl: true, name: true, archivedAt: true },
  });

  if (!doc || doc.archivedAt) return new Response("Not found", { status: 404 });

  const res = await fetch(doc.originalFileUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new Response("File not found", { status: 404 });

  const bytes = await res.arrayBuffer();
  const filename = `${doc.name.replace(/[^a-z0-9]/gi, "-")}.pdf`;

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
