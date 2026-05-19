import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderLienReleasePdf } from "@/lib/lienRelease/lienReleasePdf";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [release, company] = await Promise.all([
    prisma.lienRelease.findFirst({
      where: { id: params.id, companyId: params.companyId, archivedAt: null },
      include: { client: { select: { name: true, address: true, city: true, state: true, zip: true } } },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = release.client;
  const clientAddress = [client.address, client.city, client.state, client.zip].filter(Boolean).join(", ");

  const buffer = await renderLienReleasePdf({
    type: release.type as "PARTIAL" | "FINAL",
    subName: release.subName,
    amount: release.amount,
    throughDate: release.throughDate,
    legalDescription: release.legalDescription,
    contractorName: company?.name ?? "MIBH Construction, LLC",
    clientName: client.name,
    clientAddress,
    signatureData: release.signatureData,
    signedByName: release.signedByName,
    createdDate: release.createdAt.toISOString().slice(0, 10),
  });

  const slug = `lien-release-${release.type.toLowerCase()}-${release.subName.replace(/[^a-z0-9]/gi, "-")}`;
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}.pdf"`,
    },
  });
}
