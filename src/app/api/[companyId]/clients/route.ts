import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET — list clients for picker. Lightweight: id, name, email, phone, status, address.
// Optional ?status=PROSPECT,PIPELINE,ACTIVE  comma-separated filter.
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const statusFilter = req.nextUrl.searchParams.get("status")?.split(",").map(s => s.trim()).filter(Boolean) ?? null;

  const clients = await prisma.client.findMany({
    where: {
      companyId: params.companyId,
      ...(statusFilter && statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
    },
    select: {
      id: true, name: true, email: true, phone: true,
      address: true, city: true, state: true, zip: true,
      contactName: true, projectName: true, status: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}

// POST — quick-create a client. Used by the Appointments picker when the contact
// isn't in the database yet; defaults status to PROSPECT.
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as {
    name?: string; email?: string; phone?: string; address?: string;
    city?: string; state?: string; zip?: string; projectName?: string;
    contactName?: string; status?: string;
  };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const email = body.email?.trim() || null;
  const client = await prisma.client.create({
    data: {
      companyId: params.companyId,
      name,
      email,
      emailList: email ? [email] : undefined,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      state: body.state?.trim() || null,
      zip: body.zip?.trim() || null,
      projectName: body.projectName?.trim() || null,
      contactName: body.contactName?.trim() || null,
      status: body.status || "PROSPECT",
    },
    select: {
      id: true, name: true, email: true, phone: true,
      address: true, city: true, state: true, zip: true,
      contactName: true, projectName: true, status: true,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
