"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { STANDARD_DIVISIONS, COMMERCIAL_ONLY_DIVISIONS } from "@/lib/divisions";
import { can } from "@/lib/auth/permissions";

// Ensure one placeholder row per division exists (idempotent)
export async function initClientSubBids(clientId: string, companyId: string, isCommercial = false) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.subBid.findMany({
    where: { clientId, isPlaceholder: true },
    select: { divisionCode: true },
  });
  const existingCodes = new Set(existing.map((b) => b.divisionCode));

  const allDivs = isCommercial
    ? [...STANDARD_DIVISIONS, ...COMMERCIAL_ONLY_DIVISIONS].sort((a, b) => a.code.localeCompare(b.code))
    : STANDARD_DIVISIONS;

  for (const div of allDivs) {
    if (!existingCodes.has(div.code)) {
      await prisma.subBid.create({
        data: { clientId, companyId, divisionCode: div.code, divisionName: div.name, status: "MISSING", isPlaceholder: true },
      });
    }
  }
  revalidatePath(`/${companyId}/clients/${clientId}`);
}

export async function setClientCommercial(clientId: string, companyId: string, isCommercial: boolean) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  await prisma.client.update({ where: { id: clientId, companyId }, data: { isCommercial } });
  revalidatePath(`/${companyId}/clients/${clientId}`);
}

// Update a placeholder row (manual edit from UI)
export async function upsertSubBid(data: {
  id?: string;
  clientId: string;
  companyId: string;
  divisionCode: string;
  divisionName: string;
  contractorName?: string;
  amount?: number | null;
  notes?: string;
  fileUrl?: string;
  fileName?: string;
  status?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const status = data.status || (data.amount ? "RECEIVED" : "MISSING");

  let record;
  if (data.id) {
    // Update specific record by ID
    record = await prisma.subBid.update({
      where: { id: data.id },
      data: {
        divisionCode: data.divisionCode,
        divisionName: data.divisionName,
        contractorName: data.contractorName || null,
        amount: data.amount ?? null,
        notes: data.notes || null,
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
        status,
      },
    });
  } else {
    // Find the placeholder for this division and update it
    const placeholder = await prisma.subBid.findFirst({
      where: { clientId: data.clientId, divisionCode: data.divisionCode, isPlaceholder: true },
    });
    if (placeholder) {
      record = await prisma.subBid.update({
        where: { id: placeholder.id },
        data: {
          contractorName: data.contractorName || null,
          amount: data.amount ?? null,
          notes: data.notes || null,
          fileUrl: data.fileUrl || null,
          fileName: data.fileName || null,
          status,
        },
      });
    } else {
      record = await prisma.subBid.create({
        data: {
          clientId: data.clientId,
          companyId: data.companyId,
          divisionCode: data.divisionCode,
          divisionName: data.divisionName,
          contractorName: data.contractorName || null,
          amount: data.amount ?? null,
          notes: data.notes || null,
          fileUrl: data.fileUrl || null,
          fileName: data.fileName || null,
          status,
          isPlaceholder: true,
        },
      });
    }
  }

  revalidatePath(`/${data.companyId}/clients/${data.clientId}`);
  return record;
}

export async function deleteClientEstimate(estimateId: string, clientId: string, companyId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!can(session.user.role, "estimateTemplate:archive")) throw new Error("Forbidden — ADMIN only");

  // Delete child records first (no cascade in schema)
  const divisions = await prisma.estimateTemplateDivision.findMany({
    where: { templateId: estimateId },
    select: { id: true },
  });
  const divisionIds = divisions.map((d) => d.id);

  await prisma.estimateTemplateItem.deleteMany({ where: { divisionId: { in: divisionIds } } });
  await prisma.estimateTemplateGroup.deleteMany({ where: { divisionId: { in: divisionIds } } });
  await prisma.estimateTemplateDivision.deleteMany({ where: { templateId: estimateId } });
  // Nullify any project estimates that referenced this template
  await prisma.projectEstimate.updateMany({ where: { templateId: estimateId }, data: { templateId: null } });
  await prisma.estimateTemplate.delete({ where: { id: estimateId } });

  revalidatePath(`/${companyId}/clients/${clientId}`);
}

export async function updateClientEstimate(
  estimateId: string,
  clientId: string,
  companyId: string,
  data: { name: string; description?: string | null; estimateNumber?: string | null; estimateDate?: string | null; sqFt?: number | null; durationMonths?: number | null; hasSkylights?: boolean | null; hasRoofDrains?: boolean | null }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!can(session.user.role, "estimateTemplate:edit")) throw new Error("Forbidden");

  const isRoof = data.name.toLowerCase().includes("roof");

  await prisma.estimateTemplate.update({
    where: { id: estimateId },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      estimateNumber: data.estimateNumber?.trim() || null,
      estimateDate: data.estimateDate?.trim() || null,
      sqFt: data.sqFt ?? null,
      durationMonths: isRoof ? null : (data.durationMonths ?? null),
      ...(data.hasSkylights != null && { hasSkylights: data.hasSkylights }),
      ...(data.hasRoofDrains != null && { hasRoofDrains: data.hasRoofDrains }),
      updatedBy: session.user.id,
    },
  });

  // Propagate sqFt/durationMonths to item quantities (same logic as TemplateEditor inline fields)
  const allItems = await prisma.estimateTemplateItem.findMany({
    where: { archivedAt: null, division: { templateId: estimateId } },
    select: { id: true, name: true, unit: true },
  });

  if (data.sqFt && data.sqFt > 0) {
    const effectiveQty = isRoof ? Math.ceil(data.sqFt / 100) : data.sqFt;
    const sfIds = allItems.filter(i => i.unit && /^(SF|SQ|sq\.?\s*ft\.?|square\s*feet?)$/i.test(i.unit)).map(i => i.id);
    if (sfIds.length > 0) await prisma.estimateTemplateItem.updateMany({ where: { id: { in: sfIds } }, data: { defaultQty: effectiveQty } });
  }

  if (!isRoof && data.durationMonths && data.durationMonths > 0) {
    const durIds = allItems.filter(i => i.unit && /^(MO|month|months?)$/i.test(i.unit) || /month|potty|trailer|mgmt|management/i.test(i.name ?? "")).map(i => i.id);
    if (durIds.length > 0) await prisma.estimateTemplateItem.updateMany({ where: { id: { in: durIds } }, data: { defaultQty: data.durationMonths } });
  }

  revalidatePath(`/${companyId}/clients/${clientId}`);
  revalidatePath(`/${companyId}/estimates`);
  revalidatePath(`/${companyId}/estimates/${estimateId}`);
}

export async function deleteSubBid(id: string, clientId: string, companyId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!can(session.user.role, "expense:archive")) throw new Error("Forbidden — ADMIN only");

  const bid = await prisma.subBid.findUnique({ where: { id }, select: { fileUrl: true } });

  if (bid?.fileUrl?.startsWith("gmail:")) {
    // Soft delete — keep fileUrl so re-sync never reimports this email
    await prisma.subBid.update({
      where: { id },
      data: { contractorName: null, amount: null, notes: null, fileName: null, isPlaceholder: true, status: "EXCLUDED" },
    });
  } else {
    await prisma.subBid.delete({ where: { id } });
  }

  revalidatePath(`/${companyId}/clients/${clientId}`);
}
