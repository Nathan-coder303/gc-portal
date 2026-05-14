import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: { name: true, address: true, phone: true, email: true, licenses: true, tagline: true, logoUrl: true, website: true, contactName: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string; address?: string; phone?: string; email?: string;
    licenses?: string; tagline?: string; website?: string; contactName?: string;
  };

  const company = await prisma.company.update({
    where: { id: params.companyId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.licenses !== undefined && { licenses: body.licenses }),
      ...(body.tagline !== undefined && { tagline: body.tagline }),
      ...(body.website !== undefined && { website: body.website }),
      ...(body.contactName !== undefined && { contactName: body.contactName }),
    },
    select: { name: true, address: true, phone: true, email: true, licenses: true, tagline: true, logoUrl: true, website: true, contactName: true },
  });

  return NextResponse.json(company);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "png";
  const blob = await put(`company-logos/${params.companyId}/logo.${ext}`, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  });

  await prisma.company.update({
    where: { id: params.companyId },
    data: { logoUrl: blob.url },
  });

  return NextResponse.json({ logoUrl: blob.url });
}
