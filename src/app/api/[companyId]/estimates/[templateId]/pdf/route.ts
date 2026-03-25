import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/permissions";
import { renderTemplatePdf } from "@/lib/estimates/templatePdf";
import { insertClientPageIntoEstimate } from "@/lib/estimates/insertClientPage";

const DEFAULT_PAYMENT_SCHEDULE = [
  { payment: "Deposit", trigger: "Contract signing – permits, engineering, scheduling", pct: 25 },
  { payment: "Structure Start", trigger: "Foundation completed / framing start", pct: 25 },
  { payment: "Dry-In", trigger: "Framing, roof, windows installed", pct: 20 },
  { payment: "Rough-Ins", trigger: "Electrical, plumbing, HVAC rough inspections passed", pct: 20 },
  { payment: "Completion", trigger: "Final inspection / punchlist", pct: 10 },
];

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; templateId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "estimate:read"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const countersigned = req.nextUrl.searchParams.get("countersigned") === "1";
  const cover = req.nextUrl.searchParams.get("cover") === "1";

  const [template, company] = await Promise.all([
    prisma.estimateTemplate.findFirst({
      where: { id: params.templateId, companyId: params.companyId, archivedAt: null },
      include: {
        client: true,
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
    }),
    prisma.company.findFirst({ where: { id: params.companyId } }),
  ]);

  if (!template || !company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const divisions = template.divisions.map((d) => ({
    id: d.id,
    csiCode: d.csiCode,
    name: d.name,
    groups: d.groups.map((g) => ({
      id: g.id,
      name: g.name,
      items: g.items.map((i) => ({
        id: i.id,
        name: i.name,
        detail: i.detail,
        unit: i.unit,
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
      defaultQty: i.defaultQty ? Number(i.defaultQty) : null,
      defaultUnitCost: i.defaultUnitCost ? Number(i.defaultUnitCost) : null,
      defaultMarkupPct: i.defaultMarkupPct ? Number(i.defaultMarkupPct) : null,
      visibleInPdf: i.visibleInPdf,
      notes: i.notes,
    })),
  }));

  const buffer = await renderTemplatePdf({
    companyName: company.name,
    template: { name: template.name, description: template.description, estimateNumber: template.estimateNumber, estimateDate: template.estimateDate },
    client: template.client ? { name: template.client.name, address: template.client.address, city: template.client.city, state: template.client.state, zip: template.client.zip, phone: template.client.phone, email: template.client.email } : null,
    divisions,
    showTerms: true,
    termsContent: template.termsContent,
    paymentSchedule: (template.paymentSchedule as { payment: string; trigger: string; pct: number }[] | null) ?? DEFAULT_PAYMENT_SCHEDULE,
    gcFeePercent: template.gcFeePercent ? Number(template.gcFeePercent) : null,
    summaryGroups: (template.summaryGroups as Record<string, { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null }> | null) ?? null,
    ...(countersigned && {
      clientSignatureData: template.signatureData ?? null,
      clientSignedByName: template.signedByName ?? null,
      clientSignedAt: template.signedAt ?? null,
      contractorSignatureData: template.counterSignatureData ?? null,
      contractorSignedAt: template.counterSignedAt ?? null,
    }),
    includeRoofUpgradesPage: template.name.toLowerCase().includes("roof"),
    includeAdditionPages: template.name.toLowerCase().includes("addition"),
    includeCoverPage: cover,
    insulationType: template.insulationType ?? "ISO",
    clientCoverPhotoType: template.client?.coverPhotoType ?? null,
    clientCoverPhotoUrl: template.client?.coverPhotoUrl ?? null,
  });

  // Insert client's marked PDF page 2 as page 3 (roofing estimates only)
  const isRoof = template.name.toLowerCase().includes("roof");
  let finalBuffer = buffer;
  if (isRoof && template.client) {
    const insertFile = await prisma.clientFile.findFirst({
      where: { clientId: template.client.id, useInEstimate: true },
      select: { fileUrl: true },
    });
    finalBuffer = await insertClientPageIntoEstimate(buffer, insertFile?.fileUrl);
  }

  const clientSlug = template.client ? `-for-${template.client.name.replace(/[^a-z0-9]/gi, "-")}` : "";
  const estimateSlug = template.estimateNumber ? `Estimate-${template.estimateNumber}` : template.name.replace(/[^a-z0-9]/gi, "-");
  const filename = `${estimateSlug}${clientSlug}${countersigned ? "-countersigned" : ""}.pdf`;

  return new Response(finalBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
