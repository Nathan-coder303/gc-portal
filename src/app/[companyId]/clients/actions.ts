"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { STANDARD_DIVISIONS } from "@/lib/divisions";
import { can } from "@/lib/auth/permissions";

// Ensure one placeholder row per division exists (idempotent)
export async function initClientSubBids(clientId: string, companyId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.subBid.findMany({
    where: { clientId, isPlaceholder: true },
    select: { divisionCode: true },
  });
  const existingCodes = new Set(existing.map((b) => b.divisionCode));

  for (const div of STANDARD_DIVISIONS) {
    if (!existingCodes.has(div.code)) {
      await prisma.subBid.create({
        data: { clientId, companyId, divisionCode: div.code, divisionName: div.name, status: "MISSING", isPlaceholder: true },
      });
    }
  }
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
  data: { name: string; description?: string | null; estimateNumber?: string | null; estimateDate?: string | null }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (!can(session.user.role, "estimateTemplate:edit")) throw new Error("Forbidden");

  await prisma.estimateTemplate.update({
    where: { id: estimateId },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      estimateNumber: data.estimateNumber?.trim() || null,
      estimateDate: data.estimateDate?.trim() || null,
      updatedBy: session.user.id,
    },
  });
  revalidatePath(`/${companyId}/clients/${clientId}`);
  revalidatePath(`/${companyId}/estimates`);
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
