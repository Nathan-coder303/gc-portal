import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderChangeOrderPdfBuffer, ChangeOrderPdfItem, ChangeOrderPdfAttachment } from "@/lib/changeOrderPdf";

export const runtime = "nodejs";
export const maxDuration = 30;

async function resolvePrivateBlobUrl(blobUrl: string | null): Promise<string | null> {
  if (!blobUrl) return null;
  try {
    const res = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const mt = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mt};base64,${Buffer.from(ab).toString("base64")}`;
  } catch {
    return null;
  }
}

function parseAttachments(raw: string | null): ChangeOrderPdfAttachment[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(a => ({ name: a.name, url: a.url, mimeType: a.mimeType ?? null }));
  } catch { return []; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPreview = req.nextUrl.searchParams.get("preview") === "1";

  const [changeOrder, company] = await Promise.all([
    prisma.changeOrder.findFirst({
      where: { id: params.changeOrderId, companyId: params.companyId, clientId: params.clientId },
      include: {
        client: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!changeOrder || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const companyLogoDataUrl = company.logoUrl ? await resolvePrivateBlobUrl(company.logoUrl) : null;

  const items: ChangeOrderPdfItem[] = changeOrder.items.map(it => ({
    name: it.name,
    description: it.description,
    qty: it.qty != null ? Number(it.qty) : 0,
    unit: it.unit,
    unitCost: it.unitCost != null ? Number(it.unitCost) : 0,
    markupPct: it.markupPct != null ? Number(it.markupPct) : 0,
  }));

  const buffer = await renderChangeOrderPdfBuffer({
    orderNumber: changeOrder.orderNumber,
    createdAt: changeOrder.createdAt,
    title: changeOrder.title,
    notes: changeOrder.notes,
    status: changeOrder.status,
    signedAt: changeOrder.signedAt,
    signedByName: changeOrder.signedByName,
    signatureData: changeOrder.signatureData,
    items,
    attachments: parseAttachments(changeOrder.attachments),
    company: {
      name: company.name,
      address: company.address,
      phone: company.phone,
      email: company.email,
      licenses: company.licenses,
      website: company.website,
      logoSrc: companyLogoDataUrl ?? undefined,
    },
    client: changeOrder.client
      ? {
          name: changeOrder.client.name,
          address: changeOrder.client.address,
          city: changeOrder.client.city,
          state: changeOrder.client.state,
          zip: changeOrder.client.zip,
          projectName: changeOrder.client.projectName,
        }
      : null,
  });

  const clientSlug = changeOrder.client ? `-${changeOrder.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
  const coSlug = changeOrder.orderNumber ?? "ChangeOrder";
  const filename = `${coSlug}${clientSlug}.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
