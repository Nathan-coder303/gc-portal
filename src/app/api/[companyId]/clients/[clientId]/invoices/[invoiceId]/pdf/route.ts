import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";

export const runtime = "nodejs";
export const maxDuration = 30;

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
  { params }: { params: { companyId: string; clientId: string; invoiceId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPreview = req.nextUrl.searchParams.get("preview") === "1";

  const [invoice, company] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: params.invoiceId, companyId: params.companyId },
      include: {
        client: true,
        estimate: {
          include: {
            divisions: {
              where: { archivedAt: null },
              orderBy: { sortOrder: "asc" },
              include: {
                groups: {
                  where: { archivedAt: null },
                  orderBy: { sortOrder: "asc" },
                  include: { items: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
                },
                items: { where: { archivedAt: null, groupId: null }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!invoice || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const companyLogoDataUrl = company.logoUrl ? await resolvePrivateCoverUrl(company.logoUrl) : null;

  const divisions = invoice.estimate.divisions.map((d) => ({
    id: d.id,
    csiCode: d.csiCode,
    name: d.name,
    manualTotal: d.manualTotal ? Number(d.manualTotal) : null,
    groups: d.groups.map((g) => ({
      id: g.id,
      name: g.name,
      items: g.items.map((i) => ({
        id: i.id,
        name: i.name,
        detail: i.detail,
        unit: i.unit,
        csiCode: i.csiCode ?? null,
        defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
        defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
        defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
        visibleInPdf: i.visibleInPdf,
        notes: i.notes,
      })),
    })),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name,
      detail: i.detail,
      unit: i.unit,
      csiCode: i.csiCode ?? null,
      defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
      defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
      defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
      visibleInPdf: i.visibleInPdf,
      notes: i.notes,
    })),
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
      name: invoice.estimate.name,
      description: invoice.estimate.description,
      estimateNumber: invoice.estimate.estimateNumber,
      estimateDate: invoice.estimate.estimateDate,
    },
    client: invoice.client
      ? {
          name: invoice.client.name,
          address: invoice.client.address,
          city: invoice.client.city,
          state: invoice.client.state,
          zip: invoice.client.zip,
          phone: invoice.client.phone,
          email: invoice.client.email,
        }
      : null,
    divisions,
    showTerms: false,
    paymentSchedule: null,
    gcFeePercent: invoice.estimate.gcFeePercent ? Number(invoice.estimate.gcFeePercent) : null,
    summaryGroups: null,
    includeRoofUpgradesPage: false,
    includeAdditionPages: false,
    includeRetailPages: false,
    includeCoverPage: false,
    includeDivisionSummary: false,
    clientCoverPhotoType: null,
    clientCoverPhotoUrl: null,
    clientCoverTitle: null,
    progressPaymentPct: Number(invoice.pct),
    progressPaymentPhase: invoice.phase,
    progressInvoiceNumber: invoice.invoiceNumber,
  });

  const clientSlug = invoice.client.name.replace(/[^a-z0-9]/gi, "-");
  const phaseSlug = invoice.phase.replace(/[^a-z0-9]/gi, "-");
  const filename = `Invoice-${invoice.invoiceNumber}-${phaseSlug}-${invoice.pct}pct-${clientSlug}.pdf`;

  return new Response(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
