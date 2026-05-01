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

export async function updateEstimateGcFee(estimateId: string, gcFeePercent: number | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.projectEstimate.update({
    where: { id: estimateId },
    data: { gcFeePercent: gcFeePercent ?? null, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

const DURATION_KEYWORDS = ["project management", "laborer", "portable potty", "tool rental", "tools"];
// SF and SQ (squares) both use the sqFt value as qty
const SF_UNITS = new Set(["SF", "SQ"]);

function isSfItem(unit: string | null): boolean {
  return SF_UNITS.has((unit ?? "").toUpperCase().trim());
}

function isDurationItem(name: string, unit: string | null): boolean {
  const n = name.toLowerCase();
  const u = (unit ?? "").toUpperCase().trim();
  return u === "MO" || DURATION_KEYWORDS.some(k => n.includes(k));
}

export async function updateEstimateSqFt(estimateId: string, sqFt: number | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.projectEstimate.update({
    where: { id: estimateId },
    data: { sqFt: sqFt ?? null, updatedBy: session.user.id },
  });

  if (sqFt && sqFt > 0) {
    const sfItems = await prisma.projectEstimateItem.findMany({
      where: { archivedAt: null, division: { estimateId } },
      select: { id: true, unit: true },
    });
    const matchIds = sfItems.filter(i => isSfItem(i.unit)).map(i => i.id);
    if (matchIds.length > 0) {
      await prisma.projectEstimateItem.updateMany({
        where: { id: { in: matchIds } },
        data: { qty: sqFt },
      });
    }
  }

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function updateEstimateDurationMonths(estimateId: string, months: number | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  await prisma.projectEstimate.update({
    where: { id: estimateId },
    data: { durationMonths: months ?? null, updatedBy: session.user.id },
  });

  if (months && months > 0) {
    const allItems = await prisma.projectEstimateItem.findMany({
      where: { archivedAt: null, division: { estimateId } },
      select: { id: true, name: true, unit: true },
    });
    const matchIds = allItems.filter(i => isDurationItem(i.name, i.unit)).map(i => i.id);
    if (matchIds.length > 0) {
      await prisma.projectEstimateItem.updateMany({
        where: { id: { in: matchIds } },
        data: { qty: months },
      });
    }
  }

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
  data: { id?: string; csiCode?: string; name: string; manualTotal?: number | null }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  if (data.id) {
    await prisma.projectEstimateDivision.update({
      where: { id: data.id },
      data: {
        csiCode: data.csiCode ?? null,
        name: data.name,
        ...(data.manualTotal !== undefined && { manualTotal: data.manualTotal }),
      },
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

export async function seedEstimateDivisionFromHistory(divisionId: string, csiCode: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");

  const companyId = session.user.companyId;
  const prefix = csiCode.slice(0, 2);

  const [templateItems, projectItems] = await Promise.all([
    prisma.estimateTemplateItem.findMany({
      where: {
        archivedAt: null,
        groupId: null,
        division: { archivedAt: null, csiCode: { startsWith: prefix }, template: { companyId } },
      },
      orderBy: { sortOrder: "asc" },
      select: { name: true, csiCode: true, detail: true, unit: true, defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true, notes: true },
    }),
    prisma.projectEstimateItem.findMany({
      where: {
        archivedAt: null,
        groupId: null,
        divisionId: { not: divisionId },
        division: { archivedAt: null, csiCode: { startsWith: prefix }, estimate: { project: { companyId } } },
      },
      orderBy: { sortOrder: "asc" },
      select: { name: true, csiCode: true, detail: true, unit: true, qty: true, unitCost: true, markupPct: true, notes: true },
    }),
  ]);

  const seen = new Set<string>();
  const unique: Array<{ name: string; csiCode: string | null; detail: string | null; unit: string | null; qty: unknown; unitCost: unknown; markupPct: unknown; notes: string | null }> = [];

  for (const item of templateItems) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit, qty: item.defaultQty, unitCost: item.defaultUnitCost, markupPct: item.defaultMarkupPct, notes: item.notes });
    }
  }
  for (const item of projectItems) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit, qty: item.qty, unitCost: item.unitCost, markupPct: item.markupPct, notes: item.notes });
    }
  }

  if (unique.length === 0) return { count: 0 };

  await prisma.projectEstimateItem.createMany({
    data: unique.map((item, idx) => ({
      divisionId,
      name: item.name,
      csiCode: item.csiCode ?? null,
      detail: item.detail ?? null,
      unit: item.unit ?? null,
      qty: (item.qty as never) ?? 1,
      unitCost: (item.unitCost as never) ?? 0,
      laborCost: 0,
      materialCost: 0,
      markupPct: (item.markupPct as never) ?? 0,
      notes: item.notes ?? null,
      sortOrder: idx,
    })),
  });

  revalidatePath(`/${companyId}`);
  return { count: unique.length };
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

  // Auto-apply sqFt / durationMonths if the item matches criteria
  const division = await prisma.projectEstimateDivision.findUnique({
    where: { id: divisionId },
    select: { estimate: { select: { sqFt: true, durationMonths: true } } },
  });
  const nameLower = data.name.toLowerCase();
  let autoQty = data.qty ?? 1;
  if (division?.estimate) {
    const { sqFt, durationMonths } = division.estimate;
    if (isSfItem(data.unit ?? null) && sqFt && Number(sqFt) > 0) {
      autoQty = Number(sqFt);
    } else if (isDurationItem(nameLower, data.unit ?? null) && durationMonths && Number(durationMonths) > 0) {
      autoQty = Number(durationMonths);
    }
  }

  const payload = {
    name: data.name,
    csiCode: data.csiCode ?? null,
    detail: data.detail ?? null,
    unit: data.unit ?? null,
    qty: autoQty,
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

// ─── Summary Group overrides ───────────────────────────────────────────────────

export type SummaryGroupData = { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null };

export async function updateEstimateSummaryGroup(estimateId: string, label: string, data: SummaryGroupData | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimate:edit");
  const estimate = await prisma.projectEstimate.findUnique({ where: { id: estimateId }, select: { summaryGroups: true } });
  const current = (estimate?.summaryGroups as Record<string, SummaryGroupData> | null) ?? {};
  if (data === null) { delete current[label]; } else { current[label] = data; }
  await prisma.projectEstimate.update({ where: { id: estimateId }, data: { summaryGroups: current } });
  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}
