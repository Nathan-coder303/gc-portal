import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — list leads; pass ?all=true to include those already in the pipeline
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = req.nextUrl.searchParams.get("all") === "true";

  const leads = await prisma.lead.findMany({
    where: { companyId: params.companyId, ...(all ? {} : { pipelineCard: null }) },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true, name: true, email: true, phone: true,
      projectType: true, address: true, city: true,
    },
  });

  return NextResponse.json(leads);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, email, address, city, state, zip, projectType, message } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      companyId: params.companyId,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      zip: zip?.trim() || null,
      projectType: projectType?.trim() || null,
      message: message?.trim() || null,
      source: "manual",
      receivedAt: new Date(),
      status: "new",
    },
  });

  return NextResponse.json({ lead });
}
