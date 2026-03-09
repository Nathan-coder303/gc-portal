"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";

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

  revalidatePath(`/${session.user.companyId}/estimates`);
  return { success: true, id: template.id };
}

export async function updateTemplate(templateId: string, name: string, description: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { name: name.trim(), description: description?.trim() || null, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`);
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

  revalidatePath(`/${session.user.companyId}/estimates`);
  return { success: true };
}

// ─── Division CRUD ────────────────────────────────────────────────────────────

export async function upsertTemplateDivision(
  templateId: string,
  data: { id?: string; csiCode?: string; name: string; sortOrder?: number }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  if (data.id) {
    await prisma.estimateTemplateDivision.update({
      where: { id: data.id },
      data: { csiCode: data.csiCode ?? null, name: data.name },
    });
    revalidatePath(`/${session.user.companyId}/estimates`);
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

  revalidatePath(`/${session.user.companyId}/estimates`);
  return { success: true, id: division.id };
}

export async function archiveTemplateDivision(divisionId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:archive");

  await prisma.estimateTemplateDivision.update({
    where: { id: divisionId },
    data: { archivedAt: new Date(), archivedBy: session.user.id },
  });
  revalidatePath(`/${session.user.companyId}/estimates`);
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
  revalidatePath(`/${session.user.companyId}/estimates`);
  return { success: true };
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

export async function upsertTemplateGroup(
  divisionId: string,
  data: { id?: string; name: string }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  if (data.id) {
    await prisma.estimateTemplateGroup.update({ where: { id: data.id }, data: { name: data.name } });
    revalidatePath(`/${session.user.companyId}/estimates`);
    return { success: true, id: data.id };
  }

  const maxOrder = await prisma.estimateTemplateGroup.aggregate({
    where: { divisionId, archivedAt: null },
    _max: { sortOrder: true },
  });

  const group = await prisma.estimateTemplateGroup.create({
    data: { divisionId, name: data.name, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });

  revalidatePath(`/${session.user.companyId}/estimates`);
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
  revalidatePath(`/${session.user.companyId}/estimates`);
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
  revalidatePath(`/${session.user.companyId}/estimates`);
  return { success: true };
}

// ─── Item CRUD ────────────────────────────────────────────────────────────────

export async function upsertTemplateItem(
  divisionId: string,
  data: {
    id?: string;
    groupId?: string | null;
    name: string;
    unit?: string | null;
    defaultQty?: number | null;
    defaultUnitCost?: number | null;
    defaultLaborCost?: number | null;
    defaultMaterialCost?: number | null;
    defaultMarkupPct?: number | null;
    notes?: string | null;
  }
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const payload = {
    name: data.name,
    unit: data.unit ?? null,
    defaultQty: data.defaultQty ?? null,
    defaultUnitCost: data.defaultUnitCost ?? null,
    defaultLaborCost: data.defaultLaborCost ?? null,
    defaultMaterialCost: data.defaultMaterialCost ?? null,
    defaultMarkupPct: data.defaultMarkupPct ?? null,
    notes: data.notes ?? null,
  };

  if (data.id) {
    await prisma.estimateTemplateItem.update({ where: { id: data.id }, data: payload });
    revalidatePath(`/${session.user.companyId}/estimates`);
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

  revalidatePath(`/${session.user.companyId}/estimates`);
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
  revalidatePath(`/${session.user.companyId}/estimates`);
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
  revalidatePath(`/${session.user.companyId}/estimates`);
  return { success: true };
}
