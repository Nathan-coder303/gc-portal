import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";

export const runtime = "nodejs";
export const maxDuration = 30;

type SnapItem = { name: string; qty: number | null; unitCost: number | null; markup: number | null; unit: string | null; detail: string | null; total: number };
type SnapGroup = { name: string; manualTotal?: number | null; items: SnapItem[] };
type SnapDivision = { name: string; csiCode: string | null; manualTotal: number | null; total: number; groups: SnapGroup[]; items: SnapItem[] };
type Snapshot = { divisions: SnapDivision[]; subtotal: number; gcFee: number; total: number };

const DEFAULT_PAYMENT_SCHEDULE = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

async function resolvePrivateBlobUrl(blobUrl: string | null): Promise<string | null> {
  if (!blobUrl) return null;
  try {
    const res = await fetch(blobUrl, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const mt = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mt};base64,${Buffer.from(ab).toString("base64")}`;
  } catch { return null; }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string; templateId: string; versionId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [template, company, rows] = await Promise.all([
    prisma.estimateTemplate.findFirst({
      where: { id: params.templateId, companyId: params.companyId },
      include: {
        client: { include: { files: { where: { useInEstimate: true }, select: { fileUrl: true }, take: 1 } } },
      },
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
    prisma.$queryRaw<{ id: string; label: string; created_at: Date; snapshot: unknown }[]>(Prisma.sql`
      SELECT id, label, "createdAt" as created_at, snapshot
      FROM "EstimateVersion"
      WHERE id = ${params.versionId}
        AND "templateId" = ${params.templateId}
        AND "companyId" = ${params.companyId}
    `),
  ]);

  if (!template || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  if (!row.snapshot) return NextResponse.json({ error: "No snapshot for this version" }, { status: 404 });

  const snapshot = row.snapshot as Snapshot;

  // Map snapshot divisions → renderTemplatePdf format
  const divisions = snapshot.divisions.map((d, di) => ({
    id: `snap-div-${di}`,
    csiCode: d.csiCode,
    name: d.name,
    manualTotal: d.manualTotal,
    groups: d.groups.map((g, gi) => ({
      id: `snap-grp-${di}-${gi}`,
      name: g.name,
      manualTotal: g.manualTotal ?? null,
      items: g.items.map((item, ii) => ({
        id: `snap-item-g-${di}-${gi}-${ii}`,
        name: item.name,
        detail: item.detail,
        unit: item.unit,
        csiCode: null,
        defaultQty: item.qty,
        defaultUnitCost: item.unitCost,
        defaultMarkupPct: item.markup,
        visibleInPdf: true,
        notes: null,
      })),
    })),
    items: d.items.map((item, ii) => ({
      id: `snap-item-${di}-${ii}`,
      name: item.name,
      detail: item.detail,
      unit: item.unit,
      csiCode: null,
      defaultQty: item.qty,
      defaultUnitCost: item.unitCost,
      defaultMarkupPct: item.markup,
      visibleInPdf: true,
      notes: null,
    })),
  }));

  const companyLogoDataUrl = company.logoUrl ? await resolvePrivateBlobUrl(company.logoUrl) : null;

  const buf = await renderTemplatePdf({
    companyName: company.name,
    branding: {
      name: template.brandingName || company.name || undefined,
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
      name: template.name,
      description: template.description,
      estimateNumber: template.estimateNumber,
      estimateDate: template.estimateDate,
      sqFt: template.sqFt ? Number(template.sqFt) : null,
      durationMonths: template.durationMonths ? Number(template.durationMonths) : null,
    },
    client: template.client ? {
      name: template.client.name,
      address: template.client.address,
      city: template.client.city,
      state: template.client.state,
      zip: template.client.zip,
      phone: template.client.phone,
      email: template.client.email,
    } : null,
    divisions,
    showTerms: template.showTerms,
    termsContent: template.termsContent,
    paymentSchedule: (template.paymentSchedule as { payment: string; trigger: string; pct: number }[] | null) ?? DEFAULT_PAYMENT_SCHEDULE,
    gcFeePercent: template.gcFeePercent ? Number(template.gcFeePercent) : null,
    summaryGroups: (template.summaryGroups as Record<string, { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null }> | null) ?? null,
    includeRoofUpgradesPage: template.name.toLowerCase().includes("roof") && !template.name.toLowerCase().includes("retail"),
    includeAdditionPages: template.name.toLowerCase().includes("addition"),
    includePermitPages: false,
    includeRetailPages: template.name.toLowerCase().includes("retail"),
    includeCoverPage: false,
    insulationType: template.insulationType ?? "ISO",
    clientCoverPhotoType: template.client?.coverPhotoType ?? null,
    clientCoverPhotoUrl: await resolvePrivateBlobUrl(template.client?.coverPhotoUrl ?? null),
    clientCoverTitle: template.client?.coverTitle ?? null,
  });

  const versionLabel = row.label.replace(/[^a-z0-9]/gi, "-");
  const estimateSlug = template.estimateNumber ? `Estimate-${template.estimateNumber}` : template.name.replace(/[^a-z0-9]/gi, "-");
  const filename = `${estimateSlug}-v-${versionLabel}.pdf`;

  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
