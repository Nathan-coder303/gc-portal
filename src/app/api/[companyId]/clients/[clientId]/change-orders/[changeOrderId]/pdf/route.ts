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

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; clientId: string; changeOrderId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coverTypeParam = req.nextUrl.searchParams.get("coverType");
  const cover = req.nextUrl.searchParams.get("cover") === "1" && coverTypeParam !== "NONE";
  const page2Param = req.nextUrl.searchParams.get("page2");
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

  const divisions = resolveItems(changeOrder.items);

  const buffer = await renderTemplatePdf({
    companyName: company.name,
    template: {
      name: changeOrder.orderNumber ? `Change Order ${changeOrder.orderNumber}` : "Change Order",
      description: changeOrder.title,
      estimateNumber: changeOrder.orderNumber ?? null,
      estimateDate: changeOrder.createdAt.toISOString().split("T")[0],
    },
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
    includeRoofUpgradesPage: page2Param === "ROOF",
    includeAdditionPages: page2Param === "ADDITION",
    includeRetailPages: page2Param === "RETAIL",
    includeCoverPage: cover,
    clientCoverPhotoType: coverTypeParam ?? changeOrder.client?.coverPhotoType ?? null,
    clientCoverPhotoUrl: null,
    clientCoverTitle: changeOrder.client?.coverTitle ?? null,
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
