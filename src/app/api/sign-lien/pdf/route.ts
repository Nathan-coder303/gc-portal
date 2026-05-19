import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderLienReleasePdf } from "@/lib/lienRelease/lienReleasePdf";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const release = await prisma.lienRelease.findUnique({
    where: { signatureToken: token },
    include: { client: { select: { name: true, address: true, city: true, state: true, zip: true } } },
  });

  if (!release || release.archivedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await prisma.company.findFirst({ where: { id: release.companyId } });
  const clientAddress = [
    release.client.address, release.client.city, release.client.state, release.client.zip,
  ].filter(Boolean).join(", ");

  const buffer = await renderLienReleasePdf({
    type: release.type as "PARTIAL" | "FINAL",
    subName: release.subName,
    amount: release.amount,
    throughDate: release.throughDate,
    legalDescription: release.legalDescription,
    contractorName: company?.name ?? "MIBH Construction, LLC",
    clientName: release.client.name,
    clientAddress,
    signatureData: release.signatureData,
    signedByName: release.signedByName,
    createdDate: release.createdAt.toISOString().slice(0, 10),
  });

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"lien-release.pdf\"",
    },
  });
}
