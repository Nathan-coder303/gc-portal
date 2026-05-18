import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — proxy the PDF blob (requires auth)
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; docId: string } }
) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const executed = req.nextUrl.searchParams.get("executed") === "1";

  const doc = await prisma.clientDocument.findFirst({
    where: { id: params.docId, clientId: params.clientId, companyId: params.companyId },
  });
  if (!doc) return new Response("Not found", { status: 404 });

  const blobUrl = executed ? doc.countersignedFileUrl : doc.originalFileUrl;
  if (!blobUrl) return new Response("Not found", { status: 404 });

  const res = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return new Response("File not found", { status: 404 });

  const bytes = await res.arrayBuffer();
  const suffix = executed ? "-executed" : "";
  const filename = `${doc.name.replace(/[^a-z0-9]/gi, "-")}${suffix}.pdf`;

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
