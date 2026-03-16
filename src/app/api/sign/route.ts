import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";

// POST /api/sign — called server-side when sending the email; generates and returns a signature token
export async function POST(req: NextRequest) {
  const { templateId } = await req.json() as { templateId: string };
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

  // Reuse existing token if already generated
  const existing = await prisma.estimateTemplate.findUnique({
    where: { id: templateId },
    select: { signatureToken: true },
  });
  if (existing?.signatureToken) {
    return NextResponse.json({ token: existing.signatureToken });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { signatureToken: token },
  });
  return NextResponse.json({ token });
}

// PATCH /api/sign — called when client submits their signature
export async function PATCH(req: NextRequest) {
  const { token, signatureData, signedByName } = await req.json() as {
    token: string;
    signatureData: string;
    signedByName: string;
  };

  if (!token || !signatureData || !signedByName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const template = await prisma.estimateTemplate.findUnique({
    where: { signatureToken: token },
    select: { id: true, signedAt: true },
  });

  if (!template) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (template.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 409 });

  await prisma.estimateTemplate.update({
    where: { id: template.id },
    data: { signatureData, signedByName, signedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

// GET /api/sign?token=xxx — returns the template info for the signing page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const template = await prisma.estimateTemplate.findUnique({
    where: { signatureToken: token },
    select: {
      id: true,
      companyId: true,
      name: true,
      estimateNumber: true,
      estimateDate: true,
      signedAt: true,
      signedByName: true,
      client: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: template.name,
    estimateNumber: template.estimateNumber,
    estimateDate: template.estimateDate,
    clientName: template.client?.name ?? null,
    companyName: template.company?.name ?? null,
    alreadySigned: !!template.signedAt,
    signedAt: template.signedAt?.toISOString() ?? null,
    signedByName: template.signedByName ?? null,
    pdfUrl: `/api/${template.companyId}/estimates/${template.id}/pdf`,
  });
}
