import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";
import { STANDARD_TEMPLATE_DIVISIONS, BATHROOM_TEMPLATE_DIVISIONS, KITCHEN_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";

const _ALL = [...STANDARD_TEMPLATE_DIVISIONS, ...BATHROOM_TEMPLATE_DIVISIONS, ...KITCHEN_TEMPLATE_DIVISIONS];
const DIV_NAME_LOOKUP: Record<string, string> = {};
for (const d of _ALL) {
  const p = d.csiCode.replace(/\s/g, "").substring(0, 2);
  if (!DIV_NAME_LOOKUP[p]) DIV_NAME_LOOKUP[p] = d.name;
}

export const runtime = "nodejs";
export const maxDuration = 30;

function resolveItems(items: { id: string; csiCode: string | null; divisionName: string; name: string; description: string | null; qty: unknown; unit: string | null; unitCost: unknown; markupPct: unknown; sortOrder: number }[]) {
  const divMap = new Map<string, { id: string; csiCode: string | null; name: string; groups: never[]; items: { id: string; name: string; detail: string | null; unit: string | null; csiCode: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean; notes: string | null }[] }>();

  for (const it of items) {
    const cleanCode = (it.csiCode ?? "").replace(/\s/g, "");
    const divPrefix = cleanCode.substring(0, 2);
    const mapKey = divPrefix || it.divisionName;
    const divName = (divPrefix && DIV_NAME_LOOKUP[divPrefix]) ? DIV_NAME_LOOKUP[divPrefix] : it.divisionName;
    const divCsiCode = divPrefix ? `${divPrefix} 00 00` : null;

    if (!divMap.has(mapKey)) {
      divMap.set(mapKey, {
        id: mapKey,
        csiCode: divCsiCode,
        name: divName,
        groups: [],
        items: [],
      });
    }
    // Normalize: if user entered only one of qty/unitCost, treat the value as the unit cost
    // so a single-number entry still shows a non-zero line total in the PDF.
    let qty = it.qty != null ? Number(it.qty) : null;
    let unitCost = it.unitCost != null ? Number(it.unitCost) : null;
    if (qty != null && qty > 0 && (unitCost == null || unitCost === 0)) {
      unitCost = qty;
      qty = 1;
    } else if ((qty == null || qty === 0) && unitCost != null && unitCost > 0) {
      qty = 1;
    }

    divMap.get(mapKey)!.items.push({
      id: it.id,
      name: it.name,
      detail: null,
      unit: it.unit ?? null,
      csiCode: null,
      defaultQty: qty,
      defaultUnitCost: unitCost,
      // Per-item markup is intentionally suppressed for CO PDFs — the GC fee renders as a
      // separate line below the items, matching how estimates are presented to the client.
      defaultMarkupPct: 0,
      visibleInPdf: true,
      notes: it.description ?? null,
    });
  }

  return Array.from(divMap.values());
}

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

type StoredAttachment = { id: string; name: string; url: string; size: number; mimeType: string };
function parseAttachments(raw: string | null): StoredAttachment[] {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPreview = req.nextUrl.searchParams.get("preview") === "1";

  const [changeOrder, company, contractEstimate] = await Promise.all([
    prisma.changeOrder.findFirst({
      where: { id: params.changeOrderId, companyId: params.companyId, clientId: params.clientId },
      include: {
        client: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
    // Pull the active contract estimate to get its GC fee % — same fee applies to change orders
    prisma.estimateTemplate.findFirst({
      where: { companyId: params.companyId, clientId: params.clientId, archivedAt: null, type: "CLIENT_ESTIMATE", gcFeePercent: { not: null } },
      orderBy: [{ signedAt: "desc" }, { lastSentAt: "desc" }, { updatedAt: "desc" }],
      select: { gcFeePercent: true },
    }),
  ]);

  if (!changeOrder || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const gcFeePercent = contractEstimate?.gcFeePercent != null ? Number(contractEstimate.gcFeePercent) : null;

  const companyLogoDataUrl = company.logoUrl ? await resolvePrivateBlobUrl(company.logoUrl) : null;
  const divisions = resolveItems(changeOrder.items);

  // Build absolute URLs for attachment links so they're clickable from a downloaded / emailed PDF
  const origin = new URL(req.url).origin;
  const attachmentLinks = parseAttachments(changeOrder.attachments).map(a => ({
    name: a.name,
    url: `${origin}/api/co-attachment/${changeOrder.id}/${a.id}`,
    mimeType: a.mimeType ?? null,
  }));

  const buffer = await renderTemplatePdf({
    companyName: company.name,
    branding: {
      name: company.name || undefined,
      address: company.address || undefined,
      phone: company.phone || undefined,
      email: company.email || undefined,
      licenses: company.licenses || undefined,
      tagline: company.tagline || undefined,
      website: company.website || undefined,
      contactName: company.contactName || undefined,
      logoSrc: companyLogoDataUrl || undefined,
    },
    template: {
      name: changeOrder.orderNumber ? `Change Order ${changeOrder.orderNumber}` : changeOrder.title,
      description: null,
      estimateNumber: null,
      estimateDate: changeOrder.createdAt.toISOString().split("T")[0],
    },
    hideEstimateLabel: true,
    changeOrderNotes: changeOrder.notes ?? null,
    client: changeOrder.client
      ? {
          name: changeOrder.client.name,
          address: changeOrder.client.address,
          city: changeOrder.client.city,
          state: changeOrder.client.state,
          zip: changeOrder.client.zip,
          phone: changeOrder.client.phone,
          email: changeOrder.client.email,
        }
      : null,
    divisions,
    showTerms: false,
    paymentSchedule: null,
    gcFeePercent,
    summaryGroups: null,
    clientSignatureData: changeOrder.signatureData ?? null,
    clientSignedByName: changeOrder.signedByName ?? null,
    clientSignedAt: changeOrder.signedAt ?? null,
    includeRoofUpgradesPage: false,
    includeAdditionPages: false,
    includeRetailPages: false,
    includeCoverPage: false,
    hideContractorSignature: true,
    clientCoverPhotoType: null,
    clientCoverPhotoUrl: null,
    clientCoverTitle: null,
    attachments: attachmentLinks.length > 0 ? attachmentLinks : null,
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
