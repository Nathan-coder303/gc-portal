"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";

// ─── Estimate CRUD ────────────────────────────────────────────────────────────

export async function createEstimateFromTemplate(
  projectId: string,
  templateId: string,
  name: string
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:create");

  const template = await prisma.estimateTemplate.findUnique({
    where: { id: templateId },
    include: {
      divisions: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          groups: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
            include: {
              items: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
            },
          },
          items: {
            where: { archivedAt: null, groupId: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!template) throw new Error("Template not found");

  const estimate = await prisma.$transaction(async (tx) => {
    const est = await tx.projectEstimate.create({
      data: {
        projectId,
        templateId,
        name: name.trim(),
        status: "DRAFT",
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
    });

    for (const div of template.divisions) {
      const newDiv = await tx.projectEstimateDivision.create({
        data: {
          estimateId: est.id,
          csiCode: div.csiCode,
          name: div.name,
          sortOrder: div.sortOrder,
        },
      });

      for (const grp of div.groups) {
        const newGrp = await tx.projectEstimateGroup.create({
          data: { divisionId: newDiv.id, name: grp.name, sortOrder: grp.sortOrder },
        });
        for (const item of grp.items) {
          await tx.projectEstimateItem.create({
            data: {
              divisionId: newDiv.id,
              groupId: newGrp.id,
              name: item.name,
              unit: item.unit,
              qty: item.defaultQty ?? 1,
              unitCost: item.defaultUnitCost ?? 0,
              laborCost: item.defaultLaborCost ?? 0,
              materialCost: item.defaultMaterialCost ?? 0,
              markupPct: item.defaultMarkupPct ?? 0,
              notes: item.notes,
              sortOrder: item.sortOrder,
            },
          });
        }
      }

      for (const item of div.items) {
        await tx.projectEstimateItem.create({
          data: {
            divisionId: newDiv.id,
            groupId: null,
            name: item.name,
            unit: item.unit,
            qty: item.defaultQty ?? 1,
            unitCost: item.defaultUnitCost ?? 0,
            laborCost: item.defaultLaborCost ?? 0,
            materialCost: item.defaultMaterialCost ?? 0,
            markupPct: item.defaultMarkupPct ?? 0,
            notes: item.notes,
            sortOrder: item.sortOrder,
          },
        });
      }
    }

    return est;
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "PROJECT_ESTIMATE",
    entityId: estimate.id,
    action: "CREATE",
    changes: [{ field: "name", oldValue: null, newValue: name }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}/${projectId}/estimates`);
  return { success: true, id: estimate.id };
}

export async function createBlankEstimate(projectId: string, name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:create");

  const estimate = await prisma.projectEstimate.create({
    data: {
      projectId,
      name: name.trim(),
      status: "DRAFT",
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "PROJECT_ESTIMATE",
    entityId: estimate.id,
    action: "CREATE",
    changes: [{ field: "name", oldValue: null, newValue: name }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}/${projectId}/estimates`);
  return { success: true, id: estimate.id };
}

export async function updateEstimate(
  estimateId: string,
  name: string,
  description: string | null,
  status: string
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.projectEstimate.update({
    where: { id: estimateId },
    data: { name: name.trim(), description: description?.trim() || null, status, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function archiveEstimate(estimateId: string, projectId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:archive");

  await prisma.projectEstimate.update({
    where: { id: estimateId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/${projectId}/estimates`);
  return { success: true };
}

// ─── Division CRUD ────────────────────────────────────────────────────────────

export async function upsertEstimateDivision(
  estimateId: string,
  data: { id?: string; csiCode?: string; name: string }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  if (data.id) {
    await prisma.projectEstimateDivision.update({
      where: { id: data.id },
      data: { csiCode: data.csiCode ?? null, name: data.name },
    });
    revalidatePath(`/${session.user.companyId}`);
    return { success: true, id: data.id };
  }

  const maxOrder = await prisma.projectEstimateDivision.aggregate({
    where: { estimateId, archivedAt: null },
    _max: { sortOrder: true },
  });

  const division = await prisma.projectEstimateDivision.create({
    data: {
      estimateId,
      csiCode: data.csiCode ?? null,
      name: data.name,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true, id: division.id };
}

export async function archiveEstimateDivision(divisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.projectEstimateDivision.update({
    where: { id: divisionId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function reorderEstimateDivisions(estimateId: string, orderedIds: string[]) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.projectEstimateDivision.update({ where: { id }, data: { sortOrder: idx } })
    )
  );
  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

export async function upsertEstimateGroup(divisionId: string, data: { id?: string; name: string }) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  if (data.id) {
    await prisma.projectEstimateGroup.update({ where: { id: data.id }, data: { name: data.name } });
    revalidatePath(`/${session.user.companyId}`);
    return { success: true, id: data.id };
  }

  const maxOrder = await prisma.projectEstimateGroup.aggregate({
    where: { divisionId, archivedAt: null },
    _max: { sortOrder: true },
  });

  const group = await prisma.projectEstimateGroup.create({
    data: { divisionId, name: data.name, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true, id: group.id };
}

export async function archiveEstimateGroup(groupId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.projectEstimateGroup.update({
    where: { id: groupId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

// ─── Item CRUD ────────────────────────────────────────────────────────────────

export async function upsertEstimateItem(
  divisionId: string,
  data: {
    id?: string;
    groupId?: string | null;
    name: string;
    csiCode?: string | null;
    detail?: string | null;
    unit?: string | null;
    qty?: number;
    unitCost?: number;
    laborCost?: number;
    materialCost?: number;
    markupPct?: number;
    manualTotal?: number | null;
    vendor?: string | null;
    notes?: string | null;
  }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  const payload = {
    name: data.name,
    csiCode: data.csiCode ?? null,
    detail: data.detail ?? null,
    unit: data.unit ?? null,
    qty: data.qty ?? 1,
    unitCost: data.unitCost ?? 0,
    laborCost: data.laborCost ?? 0,
    materialCost: data.materialCost ?? 0,
    markupPct: data.markupPct ?? 0,
    manualTotal: data.manualTotal ?? null,
    vendor: data.vendor ?? null,
    notes: data.notes ?? null,
  };

  if (data.id) {
    await prisma.projectEstimateItem.update({ where: { id: data.id }, data: payload });
    revalidatePath(`/${session.user.companyId}`);
    return { success: true, id: data.id };
  }

  const maxOrder = await prisma.projectEstimateItem.aggregate({
    where: { divisionId, groupId: data.groupId ?? null, archivedAt: null },
    _max: { sortOrder: true },
  });

  const item = await prisma.projectEstimateItem.create({
    data: {
      divisionId,
      groupId: data.groupId ?? null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      ...payload,
    },
  });

  // Re-sort all items in this division/group by CSI code ascending (no code → end)
  const siblings = await prisma.projectEstimateItem.findMany({
    where: { divisionId, groupId: data.groupId ?? null, archivedAt: null },
    select: { id: true, csiCode: true },
  });
  siblings.sort((a, b) => {
    if (a.csiCode && b.csiCode) return a.csiCode.localeCompare(b.csiCode);
    if (a.csiCode) return -1;
    if (b.csiCode) return 1;
    return 0;
  });
  await prisma.$transaction(
    siblings.map((s, idx) => prisma.projectEstimateItem.update({ where: { id: s.id }, data: { sortOrder: idx } }))
  );

  revalidatePath(`/${session.user.companyId}`);
  return { success: true, id: item.id };
}

export async function archiveEstimateItem(itemId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.projectEstimateItem.update({
    where: { id: itemId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}
