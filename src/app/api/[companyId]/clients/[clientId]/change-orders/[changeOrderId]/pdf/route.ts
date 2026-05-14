import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";

export const runtime = "nodejs";
export const maxDuration = 30;

function resolveItems(items: { id: string; csiCode: string | null; divisionName: string; name: string; description: string | null; qty: unknown; unit: string | null; unitCost: unknown; markupPct: unknown; sortOrder: number }[]) {
  const divMap = new Map<string, { id: string; csiCode: string | null; name: string; groups: never[]; items: { id: string; name: string; detail: string | null; unit: string | null; csiCode: string | null; defaultQty: number | null; defaultUnitCost: number | null; defaultMarkupPct: number | null; visibleInPdf: boolean; notes: string | null }[] }>();

  for (const it of items) {
    if (!divMap.has(it.divisionName)) {
      divMap.set(it.divisionName, {
        id: it.divisionName,
        csiCode: it.csiCode ? it.csiCode.substring(0, 2) : null,
        name: it.divisionName,
        groups: [],
        items: [],
      });
    }
    divMap.get(it.divisionName)!.items.push({
      id: it.id,
      name: it.name,
      detail: it.description ?? null,
      unit: it.unit ?? null,
      csiCode: it.csiCode ?? null,
      defaultQty: it.qty != null ? Number(it.qty) : null,
      defaultUnitCost: it.unitCost != null ? Number(it.unitCost) : null,
      defaultMarkupPct: it.markupPct != null ? Number(it.markupPct) : null,
      visibleInPdf: true,
      notes: null,
    });
  }

  return Array.from(divMap.values());
}

async function resolvePrivateCoverUrl(blobUrl: string | null): Promise<string | null> {
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

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPreview = req.nextUrl.searchParams.get("preview") === "1";
  const includeDivisionSummary = req.nextUrl.searchParams.get("divSummary") === "1";
  const forcedBreakCsiPrefixes = (req.nextUrl.searchParams.get("forcedBreakCsi") ?? "").split(",").map(s => s.trim()).filter(Boolean);

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

  const companyLogoDataUrl = company.logoUrl ? await resolvePrivateCoverUrl(company.logoUrl) : null;
  const divisions = resolveItems(changeOrder.items);

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
    gcFeePercent: null,
    summaryGroups: null,
    includeRoofUpgradesPage: false,
    includeAdditionPages: false,
    includeRetailPages: false,
    includeCoverPage: false,
    includeDivisionSummary,
    forcedBreakCsiPrefixes,
    clientCoverPhotoType: null,
    clientCoverPhotoUrl: null,
    clientCoverTitle: null,
  });

  const clientSlug = changeOrder.client ? `-${changeOrder.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
  const coSlug = changeOrder.orderNumber ? `CO-${changeOrder.orderNumber}` : "ChangeOrder";
  const filename = `${coSlug}${clientSlug}.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
