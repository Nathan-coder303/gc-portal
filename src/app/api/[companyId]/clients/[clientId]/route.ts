import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET — fetch full client record for the popup edit form */
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = await prisma.client.findFirst({
    where: { id: params.clientId, companyId: params.companyId },
    select: {
      id: true, name: true, email: true, phone: true,
      address: true, city: true, state: true, zip: true,
      contactName: true, projectName: true, status: true,
      legalDescription: true,
    },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}

/** PATCH — update client fields (used by the Today appointment-popup edit form) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.companyId !== params.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as {
    name?: string; email?: string | null; phone?: string | null;
    address?: string | null; city?: string | null; state?: string | null; zip?: string | null;
    contactName?: string | null; projectName?: string | null;
    status?: string;
  };

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.email !== undefined) {
    const cleaned = body.email?.trim() || null;
    data.email = cleaned;
    data.emailList = cleaned ? [cleaned] : null;
  }
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.address !== undefined) data.address = body.address?.trim() || null;
  if (body.city !== undefined) data.city = body.city?.trim() || null;
  if (body.state !== undefined) data.state = body.state?.trim() || null;
  if (body.zip !== undefined) data.zip = body.zip?.trim() || null;
  if (body.contactName !== undefined) data.contactName = body.contactName?.trim() || null;
  if (body.projectName !== undefined) data.projectName = body.projectName?.trim() || null;
  if (body.status !== undefined) data.status = body.status;

  const updated = await prisma.client.update({
    where: { id: params.clientId },
    data,
    select: {
      id: true, name: true, email: true, phone: true,
      address: true, city: true, state: true, zip: true,
      contactName: true, projectName: true, status: true,
    },
  });
  // Refresh the client's pages so the updated email/details (e.g. the send-email "To"
  // field, which reads the client record) reflect the change immediately.
  revalidatePath(`/${params.companyId}/clients/${params.clientId}`, "layout");
  revalidatePath(`/${params.companyId}/clients`, "layout");
  return NextResponse.json(updated);
}
