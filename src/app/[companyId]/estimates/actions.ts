"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { STANDARD_TEMPLATE_DIVISIONS, BATHROOM_TEMPLATE_DIVISIONS, KITCHEN_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function touchTemplate(templateId: string, userId: string) {
  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { updatedBy: userId },
  });
}

// ─── Estimate Number Auto-Increment ───────────────────────────────────────────

async function getNextEstimateNumber(companyId: string): Promise<string> {
  const all = await prisma.estimateTemplate.findMany({
    where: { companyId, estimateNumber: { not: null } },
    select: { estimateNumber: true },
  });
  let max = 0;
  for (const t of all) {
    const n = parseInt(t.estimateNumber ?? "", 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

// ─── Template CRUD ────────────────────────────────────────────────────────────

export async function createTemplate(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:create");

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  if (!name) throw new Error("Name is required");

  const template = await prisma.estimateTemplate.create({
    data: {
      companyId: session.user.companyId,
      name,
      description,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "ESTIMATE_TEMPLATE",
    entityId: template.id,
    action: "CREATE",
    changes: [{ field: "name", oldValue: null, newValue: name }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true, id: template.id };
}

export async function createStandardTemplate(name: string, description?: string, templateType: "standard" | "bathroom" | "kitchen" = "standard") {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:create");

  const template = await prisma.estimateTemplate.create({
    data: {
      companyId: session.user.companyId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });

  const divisionData = templateType === "bathroom" ? BATHROOM_TEMPLATE_DIVISIONS : templateType === "kitchen" ? KITCHEN_TEMPLATE_DIVISIONS : STANDARD_TEMPLATE_DIVISIONS;
  for (let divIdx = 0; divIdx < divisionData.length; divIdx++) {
    const div = divisionData[divIdx];
    const division = await prisma.estimateTemplateDivision.create({
      data: {
        templateId: template.id,
        csiCode: div.csiCode,
        name: div.name,
        sortOrder: divIdx,
      },
    });

    if (div.items.length > 0) {
      await prisma.estimateTemplateItem.createMany({
        data: div.items.map((item, itemIdx) => ({
          divisionId: division.id,
          csiCode: item.csiCode,
          name: item.name,
          sortOrder: itemIdx,
          visibleInPdf: true,
        })),
      });
    }
  }

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true, id: template.id };
}

export async function renameTemplate(templateId: string, name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.estimateTemplate.update({ where: { id: templateId }, data: { name: name.trim(), updatedBy: session.user.id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function duplicateTemplate(templateId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const source = await prisma.estimateTemplate.findFirst({
    where: { id: templateId, companyId: session.user.companyId },
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
  });
  if (!source) throw new Error("Template not found");

  // Only client estimates get a sequential estimateNumber — master templates don't
  const nextEstimateNumber = source.type === "CLIENT_ESTIMATE"
    ? await getNextEstimateNumber(session.user.companyId)
    : null;

  // Create the template shell
  const copy = await prisma.estimateTemplate.create({
    data: {
      companyId: session.user.companyId,
      name: `Copy of ${source.name}`,
      description: source.description,
      type: source.type,
      createdBy: session.user.id,
      estimateNumber: nextEstimateNumber,
      gcFeePercent: source.gcFeePercent,
      sqFt: source.sqFt,
      durationMonths: source.durationMonths,
      paymentSchedule: source.paymentSchedule ?? undefined,
      showTerms: source.showTerms,
      termsContent: source.termsContent,
      summaryGroups: source.summaryGroups ?? undefined,
      hasSkylights: source.hasSkylights,
      hasRoofDrains: source.hasRoofDrains,
      insulationType: source.insulationType,
    },
  });

  // Duplicate divisions → groups → items sequentially
  for (let di = 0; di < source.divisions.length; di++) {
    const srcDiv = source.divisions[di];
    const newDiv = await prisma.estimateTemplateDivision.create({
      data: { templateId: copy.id, csiCode: srcDiv.csiCode, name: srcDiv.name, sortOrder: di },
    });

    // Groups with their items
    for (let gi = 0; gi < srcDiv.groups.length; gi++) {
      const srcGrp = srcDiv.groups[gi];
      const newGrp = await prisma.estimateTemplateGroup.create({
        data: { divisionId: newDiv.id, name: srcGrp.name, sortOrder: gi },
      });
      for (let ii = 0; ii < srcGrp.items.length; ii++) {
        const item = srcGrp.items[ii];
        await prisma.estimateTemplateItem.create({
          data: {
            divisionId: newDiv.id,
            groupId: newGrp.id,
            name: item.name,
            csiCode: item.csiCode,
            detail: item.detail,
            unit: item.unit,
            defaultQty: item.defaultQty,
            defaultUnitCost: item.defaultUnitCost,
            defaultMarkupPct: item.defaultMarkupPct,
            visibleInPdf: item.visibleInPdf,
            notes: item.notes,
            sortOrder: ii,
          },
        });
      }
    }

    // Ungrouped items
    for (let ii = 0; ii < srcDiv.items.length; ii++) {
      const item = srcDiv.items[ii];
      await prisma.estimateTemplateItem.create({
        data: {
          divisionId: newDiv.id,
          name: item.name,
          csiCode: item.csiCode,
          detail: item.detail,
          unit: item.unit,
          defaultQty: item.defaultQty,
          defaultUnitCost: item.defaultUnitCost,
          defaultMarkupPct: item.defaultMarkupPct,
          visibleInPdf: item.visibleInPdf,
          notes: item.notes,
          sortOrder: ii,
        },
      });
    }
  }

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { id: copy.id };
}

export async function updateTemplate(
  templateId: string,
  name: string,
  description: string | null,
  estimateNumber?: string | null,
  estimateDate?: string | null,
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      estimateNumber: estimateNumber?.trim() || null,
      estimateDate: estimateDate?.trim() || null,
      updatedBy: session.user.id,
    },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function archiveTemplate(templateId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:archive");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { archivedAt: new Date(), archivedBy: session.user.id, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

// ─── Division CRUD ────────────────────────────────────────────────────────────

export async function upsertTemplateDivision(
  templateId: string,
  data: { id?: string; csiCode?: string; name: string; sortOrder?: number; manualTotal?: number | null }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  if (data.id) {
    // Update name/csiCode via Prisma (fields known to cached client)
    await prisma.estimateTemplateDivision.update({
      where: { id: data.id },
      data: { csiCode: data.csiCode, name: data.name },
    });
    // Set manualTotal via raw SQL — Vercel caches an older Prisma client that
    // doesn't know about this column, so using the ORM throws "Unknown argument"
    if (data.manualTotal !== undefined) {
      if (data.manualTotal === null) {
        await prisma.$executeRawUnsafe(
          `UPDATE "EstimateTemplateDivision" SET "manualTotal" = NULL WHERE id = $1`,
          data.id,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "EstimateTemplateDivision" SET "manualTotal" = $1 WHERE id = $2`,
          data.manualTotal,
          data.id,
        );
      }
    }
    // Zero out all line items when a lump-sum override is applied
    if (data.manualTotal != null) {
      await prisma.estimateTemplateItem.updateMany({
        where: { divisionId: data.id, archivedAt: null },
        data: { defaultUnitCost: 0 },
      });
      await prisma.estimateTemplateGroup.findMany({
        where: { divisionId: data.id, archivedAt: null },
        select: { id: true },
      }).then(groups =>
        prisma.estimateTemplateItem.updateMany({
          where: { groupId: { in: groups.map(g => g.id) }, archivedAt: null },
          data: { defaultUnitCost: 0 },
        })
      );
    }
    await touchTemplate(templateId, session.user.id);
    revalidatePath(`/${session.user.companyId}/estimates`, "layout");
    return { success: true, id: data.id };
  }

  const maxOrder = await prisma.estimateTemplateDivision.aggregate({
    where: { templateId, archivedAt: null },
    _max: { sortOrder: true },
  });

  const division = await prisma.estimateTemplateDivision.create({
    data: {
      templateId,
      csiCode: data.csiCode ?? null,
      name: data.name,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await touchTemplate(templateId, session.user.id);
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true, id: division.id };
}

export async function seedTemplateDivisionFromHistory(divisionId: string, csiCode: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const companyId = session.user.companyId;
  const prefix = csiCode.slice(0, 2); // e.g. "09" from "09 00 00"

  const [templateItems, projectItems] = await Promise.all([
    prisma.estimateTemplateItem.findMany({
      where: {
        archivedAt: null,
        groupId: null,
        divisionId: { not: divisionId },
        division: { archivedAt: null, csiCode: { startsWith: prefix }, template: { companyId } },
      },
      orderBy: { sortOrder: "asc" },
      select: { name: true, csiCode: true, detail: true, unit: true, defaultQty: true, defaultUnitCost: true, defaultMarkupPct: true, notes: true },
    }),
    prisma.projectEstimateItem.findMany({
      where: {
        archivedAt: null,
        groupId: null,
        division: { archivedAt: null, csiCode: { startsWith: prefix }, estimate: { project: { companyId } } },
      },
      orderBy: { sortOrder: "asc" },
      select: { name: true, csiCode: true, detail: true, unit: true, qty: true, unitCost: true, markupPct: true, notes: true },
    }),
  ]);

  const seen = new Set<string>();
  const unique: Array<{ name: string; csiCode: string | null; detail: string | null; unit: string | null; defaultQty: unknown; defaultUnitCost: unknown; defaultMarkupPct: unknown; notes: string | null }> = [];

  for (const item of templateItems) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); unique.push(item); }
  }
  for (const item of projectItems) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit, defaultQty: item.qty, defaultUnitCost: item.unitCost, defaultMarkupPct: item.markupPct, notes: item.notes });
    }
  }

  if (unique.length === 0) return { count: 0 };

  await prisma.estimateTemplateItem.createMany({
    data: unique.map((item, idx) => ({
      divisionId,
      name: item.name,
      csiCode: item.csiCode ?? null,
      detail: item.detail ?? null,
      unit: item.unit ?? null,
      defaultQty: item.defaultQty as never,
      defaultUnitCost: item.defaultUnitCost as never,
      defaultMarkupPct: item.defaultMarkupPct as never,
      notes: item.notes ?? null,
      sortOrder: idx,
    })),
  });

  revalidatePath(`/${companyId}/estimates`, "layout");
  return { count: unique.length };
}

export async function archiveTemplateDivision(divisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:archive");

  await prisma.estimateTemplateDivision.update({
    where: { id: divisionId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function mergeTemplateDivisionInto(sourceDivisionId: string, targetDivisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  // Move all groups to the target division
  await prisma.estimateTemplateGroup.updateMany({
    where: { divisionId: sourceDivisionId, archivedAt: null },
    data: { divisionId: targetDivisionId },
  });
  // Move all ungrouped items to the target division
  await prisma.estimateTemplateItem.updateMany({
    where: { divisionId: sourceDivisionId, groupId: null, archivedAt: null },
    data: { divisionId: targetDivisionId },
  });
  // Archive the now-empty source division
  await prisma.estimateTemplateDivision.update({
    where: { id: sourceDivisionId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function reorderTemplateDivisions(templateId: string, orderedIds: string[]) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.estimateTemplateDivision.update({ where: { id }, data: { sortOrder: idx } })
    )
  );
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

export async function upsertTemplateGroup(
  divisionId: string,
  data: { id?: string; name: string; manualTotal?: number | null }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  if (data.id) {
    await prisma.estimateTemplateGroup.update({ where: { id: data.id }, data: { name: data.name } });
    // Set manualTotal via raw SQL — Vercel can cache an older Prisma client that
    // doesn't know this column, so using the ORM would throw "Unknown argument"
    if (data.manualTotal !== undefined) {
      if (data.manualTotal === null) {
        await prisma.$executeRawUnsafe(
          `UPDATE "EstimateTemplateGroup" SET "manualTotal" = NULL WHERE id = $1`,
          data.id,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "EstimateTemplateGroup" SET "manualTotal" = $1 WHERE id = $2`,
          data.manualTotal,
          data.id,
        );
      }
    }
    // Zero out this group's line items when a lump-sum override is applied
    if (data.manualTotal != null) {
      await prisma.estimateTemplateItem.updateMany({
        where: { groupId: data.id, archivedAt: null },
        data: { defaultUnitCost: 0 },
      });
    }
    revalidatePath(`/${session.user.companyId}/estimates`, "layout");
    return { success: true, id: data.id };
  }

  const maxOrder = await prisma.estimateTemplateGroup.aggregate({
    where: { divisionId, archivedAt: null },
    _max: { sortOrder: true },
  });

  const group = await prisma.estimateTemplateGroup.create({
    data: { divisionId, name: data.name, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true, id: group.id };
}

export async function archiveTemplateGroup(groupId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:archive");

  await prisma.estimateTemplateGroup.update({
    where: { id: groupId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function reorderTemplateGroups(divisionId: string, orderedIds: string[]) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.estimateTemplateGroup.update({ where: { id }, data: { sortOrder: idx } })
    )
  );
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

// ─── Item CRUD ────────────────────────────────────────────────────────────────

// Keywords that identify duration-driven items (MO unit or these name patterns)
const DURATION_KEYWORDS = ["project management", "laborer", "portable potty", "tool rental", "tools"];
const SF_UNITS = new Set(["SF", "SQ"]);

function isSfItem(unit: string | null): boolean {
  return SF_UNITS.has((unit ?? "").toUpperCase().trim());
}

function isDurationItem(name: string, unit: string | null): boolean {
  const n = name.toLowerCase();
  const u = (unit ?? "").toUpperCase().trim();
  return u === "MO" || DURATION_KEYWORDS.some(k => n.includes(k));
}

export async function upsertTemplateItem(
  divisionId: string,
  data: {
    id?: string;
    groupId?: string | null;
    name: string;
    csiCode?: string | null;
    detail?: string | null;
    unit?: string | null;
    defaultQty?: number | null;
    defaultUnitCost?: number | null;
    defaultLaborCost?: number | null;
    defaultMaterialCost?: number | null;
    defaultMarkupPct?: number | null;
    notes?: string | null;
    visibleInPdf?: boolean;
  }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  // Auto-apply sqFt / durationMonths if the item matches criteria
  const division = await prisma.estimateTemplateDivision.findUnique({
    where: { id: divisionId },
    select: { templateId: true, template: { select: { sqFt: true, durationMonths: true, name: true } } },
  });
  const nameLower = data.name.toLowerCase();
  let autoDefaultQty = data.defaultQty ?? null;
  if (division?.template) {
    const { sqFt, durationMonths, name: templateName } = division.template;
    const isRoof = templateName?.toLowerCase().includes("roof") ?? false;
    if (isSfItem(data.unit ?? null) && sqFt && Number(sqFt) > 0) {
      autoDefaultQty = isRoof ? Math.ceil(Number(sqFt) / 100) : Number(sqFt);
    } else if (isDurationItem(nameLower, data.unit ?? null) && durationMonths && Number(durationMonths) > 0) {
      autoDefaultQty = Number(durationMonths);
    }
  }

  const payload = {
    name: data.name,
    csiCode: data.csiCode ?? null,
    detail: data.detail ?? null,
    unit: data.unit ?? null,
    defaultQty: autoDefaultQty,
    defaultUnitCost: data.defaultUnitCost ?? null,
    defaultLaborCost: data.defaultLaborCost ?? null,
    defaultMaterialCost: data.defaultMaterialCost ?? null,
    defaultMarkupPct: data.defaultMarkupPct ?? null,
    notes: data.notes ?? null,
    visibleInPdf: data.visibleInPdf ?? true,
  };

  if (data.id) {
    await prisma.estimateTemplateItem.update({ where: { id: data.id }, data: payload });
    if (division?.templateId) await touchTemplate(division.templateId, session.user.id);
    revalidatePath(`/${session.user.companyId}/estimates`, "layout");
    return { success: true, id: data.id };
  }

  const maxOrder = await prisma.estimateTemplateItem.aggregate({
    where: {
      divisionId,
      groupId: data.groupId ?? null,
      archivedAt: null,
    },
    _max: { sortOrder: true },
  });

  const item = await prisma.estimateTemplateItem.create({
    data: {
      divisionId,
      groupId: data.groupId ?? null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      ...payload,
    },
  });

  // Re-sort all items in this division/group by CSI code ascending (no code → end)
  const siblings = await prisma.estimateTemplateItem.findMany({
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
    siblings.map((s, idx) => prisma.estimateTemplateItem.update({ where: { id: s.id }, data: { sortOrder: idx } }))
  );

  if (division?.templateId) await touchTemplate(division.templateId, session.user.id);
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true, id: item.id };
}

export async function archiveTemplateItem(itemId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:archive");

  await prisma.estimateTemplateItem.update({
    where: { id: itemId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function restoreTemplateItem(itemId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.estimateTemplateItem.update({ where: { id: itemId }, data: { archivedAt: null, archivedBy: null } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function restoreTemplateGroup(groupId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.$transaction([
    prisma.estimateTemplateGroup.update({ where: { id: groupId }, data: { archivedAt: null, archivedBy: null } }),
    prisma.estimateTemplateItem.updateMany({ where: { groupId }, data: { archivedAt: null, archivedBy: null } }),
  ]);
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function restoreTemplateDivision(divisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.$transaction([
    prisma.estimateTemplateDivision.update({ where: { id: divisionId }, data: { archivedAt: null, archivedBy: null } }),
    prisma.estimateTemplateGroup.updateMany({ where: { divisionId }, data: { archivedAt: null, archivedBy: null } }),
    prisma.estimateTemplateItem.updateMany({ where: { divisionId }, data: { archivedAt: null, archivedBy: null } }),
  ]);
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function resetTemplateDivisionItems(divisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  const division = await prisma.estimateTemplateDivision.findUnique({
    where: { id: divisionId },
    select: { templateId: true },
  });
  await prisma.estimateTemplateItem.updateMany({
    where: { divisionId, archivedAt: null },
    data: { unit: null, defaultQty: null, defaultUnitCost: null, defaultLaborCost: null, defaultMaterialCost: null, defaultMarkupPct: null },
  });
  if (division?.templateId) await touchTemplate(division.templateId, session.user.id);
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
}

export async function moveItemBetweenDivisions(itemId: string, newDivisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const maxOrder = await prisma.estimateTemplateItem.aggregate({
    where: { divisionId: newDivisionId, groupId: null, archivedAt: null },
    _max: { sortOrder: true },
  });

  await prisma.estimateTemplateItem.update({
    where: { id: itemId },
    data: {
      divisionId: newDivisionId,
      groupId: null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function moveItemToGroup(itemId: string, groupId: string, divisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const maxOrder = await prisma.estimateTemplateItem.aggregate({
    where: { groupId, archivedAt: null },
    _max: { sortOrder: true },
  });

  await prisma.estimateTemplateItem.update({
    where: { id: itemId },
    data: {
      divisionId,
      groupId,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function reorderTemplateItems(parentId: string, parentType: "division" | "group", orderedIds: string[]) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.estimateTemplateItem.update({ where: { id }, data: { sortOrder: idx } })
    )
  );
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

// ─── Client CRUD ──────────────────────────────────────────────────────────────

export async function listClients() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const clients = await prisma.client.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { name: "asc" },
  });
  return clients;
}

export async function upsertClient(data: { id?: string; name: string; address?: string; city?: string; state?: string; zip?: string; emailList?: string[]; phone?: string; contactName?: string; projectName?: string; legalDescription?: string }) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const cleanEmails = (data.emailList ?? []).map(e => e.trim()).filter(Boolean);
  const payload = {
    name: data.name.trim(),
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    state: data.state?.trim() || null,
    zip: data.zip?.trim() || null,
    email: cleanEmails[0] ?? null,
    emailList: cleanEmails.length > 0 ? cleanEmails : Prisma.JsonNull,
    phone: data.phone?.trim() || null,
    contactName: data.contactName?.trim() || null,
    projectName: data.projectName?.trim() || null,
    legalDescription: data.legalDescription?.trim() || null,
  };

  if (data.id) {
    return prisma.client.update({ where: { id: data.id }, data: payload });
  }

  return prisma.client.create({ data: { companyId: session.user.companyId, ...payload } });
}

export async function updateClientCoverPhoto(clientId: string, coverPhotoType: string | null, coverPhotoUrl?: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.client.update({
    where: { id: clientId },
    data: { coverPhotoType, coverPhotoUrl: coverPhotoUrl ?? undefined },
  });
  revalidatePath(`/${session.user.companyId}/clients/${clientId}`);
  return { success: true };
}

export async function updateClientCoverTitle(clientId: string, coverTitle: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.client.update({
    where: { id: clientId },
    data: { coverTitle: coverTitle || null },
  });
  revalidatePath(`/${session.user.companyId}/clients/${clientId}`);
  return { success: true };
}

export async function setTemplateClient(templateId: string, clientId: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { clientId, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

// ─── Save as new template (deep copy) ────────────────────────────────────────

export async function saveAsNewTemplate(sourceTemplateId: string, newName: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:create");

  const source = await prisma.estimateTemplate.findUnique({
    where: { id: sourceTemplateId },
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
  });

  if (!source) throw new Error("Template not found");

  // Client estimates get a sequential estimateNumber so the duplicate is a fresh estimate
  const nextEstimateNumber = source.type === "CLIENT_ESTIMATE"
    ? await getNextEstimateNumber(session.user.companyId)
    : null;

  const newTemplate = await prisma.$transaction(async (tx) => {
    const tpl = await tx.estimateTemplate.create({
      data: {
        companyId: session.user.companyId,
        name: newName.trim(),
        description: source.description,
        type: source.type,
        clientId: source.clientId,
        estimateNumber: nextEstimateNumber,
        sortOrder: 0,
        createdBy: session.user.id,
        updatedBy: session.user.id,
        gcFeePercent: source.gcFeePercent,
        sqFt: source.sqFt,
        durationMonths: source.durationMonths,
        paymentSchedule: source.paymentSchedule ?? undefined,
        summaryGroups: source.summaryGroups ?? undefined,
        termsContent: source.termsContent,
        showTerms: source.showTerms,
        hasSkylights: source.hasSkylights,
        hasRoofDrains: source.hasRoofDrains,
        insulationType: source.insulationType,
      },
    });

    for (const div of source.divisions) {
      const newDiv = await tx.estimateTemplateDivision.create({
        data: { templateId: tpl.id, csiCode: div.csiCode, name: div.name, sortOrder: div.sortOrder },
      });
      for (const grp of div.groups) {
        const newGrp = await tx.estimateTemplateGroup.create({
          data: { divisionId: newDiv.id, name: grp.name, sortOrder: grp.sortOrder },
        });
        for (const item of grp.items) {
          await tx.estimateTemplateItem.create({
            data: {
              divisionId: newDiv.id, groupId: newGrp.id,
              name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit,
              defaultQty: item.defaultQty, defaultUnitCost: item.defaultUnitCost,
              defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
              defaultMarkupPct: item.defaultMarkupPct, notes: item.notes,
              visibleInPdf: item.visibleInPdf, sortOrder: item.sortOrder,
            },
          });
        }
      }
      for (const item of div.items) {
        await tx.estimateTemplateItem.create({
          data: {
            divisionId: newDiv.id, groupId: null,
            name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit,
            defaultQty: item.defaultQty, defaultUnitCost: item.defaultUnitCost,
            defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
            defaultMarkupPct: item.defaultMarkupPct, notes: item.notes,
            visibleInPdf: item.visibleInPdf, sortOrder: item.sortOrder,
          },
        });
      }
    }
    return tpl;
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true, id: newTemplate.id };
}

export async function createTemplateByName(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:create");

  const existing = await prisma.estimateTemplate.findFirst({
    where: { companyId: session.user.companyId, name, type: "TEMPLATE", archivedAt: null },
  });

  const templateId = existing
    ? existing.id
    : (
        await prisma.estimateTemplate.create({
          data: {
            companyId: session.user.companyId,
            name,
            type: "TEMPLATE",
            createdBy: session.user.id,
            updatedBy: session.user.id,
          },
        })
      ).id;

  redirect(`/${session.user.companyId}/estimates/${templateId}`);
}

export async function updateTemplatePaymentSchedule(templateId: string, rows: { payment: string; trigger: string; pct: number }[]) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { paymentSchedule: rows, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateTermsContent(templateId: string, termsContent: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { termsContent: termsContent || null, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateShowTerms(templateId: string, showTerms: boolean) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { showTerms, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateGcFee(templateId: string, gcFeePercent: number | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { gcFeePercent: gcFeePercent ?? null, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateInternalProfit(templateId: string, internalProfitOverride: number | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { internalProfitOverride: internalProfitOverride ?? null, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateSqFt(templateId: string, sqFt: number | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { sqFt: sqFt ?? null, updatedBy: session.user.id },
  });

  const sfItems = await prisma.estimateTemplateItem.findMany({
    where: { archivedAt: null, division: { templateId } },
    select: { id: true, unit: true },
  });
  const matchIds = sfItems.filter(i => isSfItem(i.unit)).map(i => i.id);
  if (matchIds.length > 0) {
    if (sqFt && sqFt > 0) {
      const template = await prisma.estimateTemplate.findUnique({ where: { id: templateId }, select: { name: true } });
      const isRoof = template?.name?.toLowerCase().includes("roof") ?? false;
      const effectiveQty = isRoof ? Math.ceil(sqFt / 100) : sqFt;
      await prisma.estimateTemplateItem.updateMany({
        where: { id: { in: matchIds } },
        data: { defaultQty: effectiveQty },
      });
    } else {
      // sqFt cleared — reset SF items to no qty
      await prisma.estimateTemplateItem.updateMany({
        where: { id: { in: matchIds } },
        data: { defaultQty: null },
      });
    }
  }

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateDurationMonths(templateId: string, months: number | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { durationMonths: months ?? null, updatedBy: session.user.id },
  });

  const allItems = await prisma.estimateTemplateItem.findMany({
    where: { archivedAt: null, division: { templateId } },
    select: { id: true, name: true, unit: true },
  });
  const matchIds = allItems.filter(i => isDurationItem(i.name, i.unit)).map(i => i.id);
  if (matchIds.length > 0) {
    if (months && months > 0) {
      await prisma.estimateTemplateItem.updateMany({
        where: { id: { in: matchIds } },
        data: { defaultQty: months },
      });
    } else {
      // duration cleared — reset duration items to no qty
      await prisma.estimateTemplateItem.updateMany({
        where: { id: { in: matchIds } },
        data: { defaultQty: null },
      });
    }
  }

  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateHasSkylights(templateId: string, value: boolean) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.estimateTemplate.update({ where: { id: templateId }, data: { hasSkylights: value, updatedBy: session.user.id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateHasRoofDrains(templateId: string, value: boolean) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.estimateTemplate.update({ where: { id: templateId }, data: { hasRoofDrains: value, updatedBy: session.user.id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateInsulationType(templateId: string, value: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.estimateTemplate.update({ where: { id: templateId }, data: { insulationType: value, updatedBy: session.user.id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateCombinationType(templateId: string, value: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.estimateTemplate.update({ where: { id: templateId }, data: { combinationType: value, updatedBy: session.user.id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function updateTemplateBrandingName(templateId: string, value: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.estimateTemplate.update({ where: { id: templateId }, data: { brandingName: value, updatedBy: session.user.id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

// ─── Summary Group overrides ───────────────────────────────────────────────────

export type SummaryGroupData = { qty: number | null; unit: string | null; unitCost: number | null; markupPct: number | null; manualTotal: number | null };

export async function updateTemplateSummaryGroup(templateId: string, label: string, data: SummaryGroupData | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const template = await prisma.estimateTemplate.findUnique({ where: { id: templateId }, select: { summaryGroups: true } });
  const current = (template?.summaryGroups as Record<string, SummaryGroupData> | null) ?? {};
  if (data === null) {
    delete current[label];
  } else {
    current[label] = data;
  }
  await prisma.estimateTemplate.update({ where: { id: templateId }, data: { summaryGroups: current, updatedBy: session.user.id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

// ─── Terms Templates ──────────────────────────────────────────────────────────

export async function listTermsTemplates() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  return prisma.termsTemplate.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, content: true },
  });
}

export async function upsertTermsTemplate(data: { id?: string; name: string; content: string }) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  if (data.id) {
    await prisma.termsTemplate.update({ where: { id: data.id }, data: { name: data.name.trim(), content: data.content } });
    revalidatePath(`/${session.user.companyId}/estimates`, "layout");
    return { success: true, id: data.id };
  } else {
    const created = await prisma.termsTemplate.create({ data: { companyId: session.user.companyId, name: data.name.trim(), content: data.content } });
    revalidatePath(`/${session.user.companyId}/estimates`, "layout");
    return { success: true, id: created.id };
  }
}

export async function deleteTermsTemplate(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.termsTemplate.delete({ where: { id } });
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
  return { success: true };
}

export async function deleteClient(clientId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  // Unlink any templates from this client first
  await prisma.estimateTemplate.updateMany({ where: { clientId }, data: { clientId: null } });
  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath(`/${session.user.companyId}/clients`);
  return { success: true };
}

export async function saveAsClientEstimate(sourceTemplateId: string, clientId: string, estimateName: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:create");

  const source = await prisma.estimateTemplate.findUnique({
    where: { id: sourceTemplateId },
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
  });

  if (!source) throw new Error("Template not found");

  // If a CLIENT_ESTIMATE with the same name already exists for this client, re-sync it
  const existing = await prisma.estimateTemplate.findFirst({
    where: { companyId: session.user.companyId, clientId, type: "CLIENT_ESTIMATE", name: estimateName.trim(), archivedAt: null },
    include: {
      divisions: {
        where: { archivedAt: null },
        include: {
          groups: { where: { archivedAt: null }, include: { items: { where: { archivedAt: null } } } },
          items: { where: { archivedAt: null } },
        },
      },
    },
  });
  if (existing) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Archive all existing divisions/groups/items
      for (const div of existing.divisions) {
        for (const grp of div.groups) {
          await tx.estimateTemplateItem.updateMany({ where: { groupId: grp.id }, data: { archivedAt: now } });
          await tx.estimateTemplateGroup.update({ where: { id: grp.id }, data: { archivedAt: now } });
        }
        await tx.estimateTemplateItem.updateMany({ where: { divisionId: div.id, groupId: null }, data: { archivedAt: now } });
        await tx.estimateTemplateDivision.update({ where: { id: div.id }, data: { archivedAt: now } });
      }
      // Update template metadata from source
      await tx.estimateTemplate.update({
        where: { id: existing.id },
        data: {
          description: source.description,
          gcFeePercent: source.gcFeePercent,
          paymentSchedule: source.paymentSchedule ?? undefined,
          summaryGroups: source.summaryGroups ?? undefined,
          termsContent: source.termsContent,
          showTerms: source.showTerms,
          insulationType: source.insulationType,
          updatedBy: session.user.id,
        },
      });
      // Re-create divisions/groups/items from source
      for (const div of source.divisions) {
        const newDiv = await tx.estimateTemplateDivision.create({
          data: { templateId: existing.id, csiCode: div.csiCode, name: div.name, sortOrder: div.sortOrder },
        });
        for (const grp of div.groups) {
          const newGrp = await tx.estimateTemplateGroup.create({
            data: { divisionId: newDiv.id, name: grp.name, sortOrder: grp.sortOrder },
          });
          for (const item of grp.items) {
            await tx.estimateTemplateItem.create({
              data: {
                divisionId: newDiv.id, groupId: newGrp.id,
                name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit,
                defaultQty: item.defaultQty, defaultUnitCost: item.defaultUnitCost,
                defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
                defaultMarkupPct: item.defaultMarkupPct, notes: item.notes,
                visibleInPdf: item.visibleInPdf, sortOrder: item.sortOrder,
              },
            });
          }
        }
        for (const item of div.items) {
          await tx.estimateTemplateItem.create({
            data: {
              divisionId: newDiv.id, groupId: null,
              name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit,
              defaultQty: item.defaultQty, defaultUnitCost: item.defaultUnitCost,
              defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
              defaultMarkupPct: item.defaultMarkupPct, notes: item.notes,
              visibleInPdf: item.visibleInPdf, sortOrder: item.sortOrder,
            },
          });
        }
      }
    });
    revalidatePath(`/${session.user.companyId}/clients/${clientId}`);
    return { success: true, id: existing.id, clientId };
  }

  const nextNumber = await getNextEstimateNumber(session.user.companyId);

  const newEstimate = await prisma.$transaction(async (tx) => {
    const tpl = await tx.estimateTemplate.create({
      data: {
        companyId: session.user.companyId,
        name: estimateName.trim(),
        description: source.description,
        type: "CLIENT_ESTIMATE",
        clientId,
        sortOrder: 0,
        createdBy: session.user.id,
        updatedBy: session.user.id,
        // Copy financial & doc fields from source; assign fresh estimate number
        estimateNumber: nextNumber,
        estimateDate: new Date().toISOString().split("T")[0],
        gcFeePercent: source.gcFeePercent,
        paymentSchedule: source.paymentSchedule ?? undefined,
        summaryGroups: source.summaryGroups ?? undefined,
        termsContent: source.termsContent,
        showTerms: source.showTerms,
      },
    });

    for (const div of source.divisions) {
      const newDiv = await tx.estimateTemplateDivision.create({
        data: { templateId: tpl.id, csiCode: div.csiCode, name: div.name, sortOrder: div.sortOrder },
      });
      for (const grp of div.groups) {
        const newGrp = await tx.estimateTemplateGroup.create({
          data: { divisionId: newDiv.id, name: grp.name, sortOrder: grp.sortOrder },
        });
        for (const item of grp.items) {
          await tx.estimateTemplateItem.create({
            data: {
              divisionId: newDiv.id, groupId: newGrp.id,
              name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit,
              defaultQty: item.defaultQty, defaultUnitCost: item.defaultUnitCost,
              defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
              defaultMarkupPct: item.defaultMarkupPct, notes: item.notes,
              visibleInPdf: item.visibleInPdf, sortOrder: item.sortOrder,
            },
          });
        }
      }
      for (const item of div.items) {
        await tx.estimateTemplateItem.create({
          data: {
            divisionId: newDiv.id, groupId: null,
            name: item.name, csiCode: item.csiCode, detail: item.detail, unit: item.unit,
            defaultQty: item.defaultQty, defaultUnitCost: item.defaultUnitCost,
            defaultLaborCost: item.defaultLaborCost, defaultMaterialCost: item.defaultMaterialCost,
            defaultMarkupPct: item.defaultMarkupPct, notes: item.notes,
            visibleInPdf: item.visibleInPdf, sortOrder: item.sortOrder,
          },
        });
      }
    }
    return tpl;
  });

  revalidatePath(`/${session.user.companyId}/clients/${clientId}`);
  return { success: true, id: newEstimate.id, clientId };
}

export async function reorderTemplates(orderedIds: string[]) {
  "use server";
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  await Promise.all(
    orderedIds.map((id, idx) =>
      prisma.estimateTemplate.update({ where: { id }, data: { sortOrder: idx } })
    )
  );
  revalidatePath(`/${session.user.companyId}/estimates`, "layout");
}
