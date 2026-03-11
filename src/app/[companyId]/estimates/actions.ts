"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
    visibleInPdf?: boolean;
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
    visibleInPdf: data.visibleInPdf ?? true,
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

export async function upsertClient(data: { id?: string; name: string; address?: string; city?: string; state?: string; zip?: string; email?: string; phone?: string }) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  const payload = {
    name: data.name.trim(),
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    state: data.state?.trim() || null,
    zip: data.zip?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
  };

  if (data.id) {
    return prisma.client.update({ where: { id: data.id }, data: payload });
  }

  return prisma.client.create({ data: { companyId: session.user.companyId, ...payload } });
}

export async function setTemplateClient(templateId: string, clientId: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");

  await prisma.estimateTemplate.update({
    where: { id: templateId },
    data: { clientId, updatedBy: session.user.id },
  });

  revalidatePath(`/${session.user.companyId}/estimates`);
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

  const newTemplate = await prisma.$transaction(async (tx) => {
    const tpl = await tx.estimateTemplate.create({
      data: {
        companyId: session.user.companyId,
        name: newName.trim(),
        description: source.description,
        sortOrder: 0,
        createdBy: session.user.id,
        updatedBy: session.user.id,
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
              name: item.name, unit: item.unit,
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
            name: item.name, unit: item.unit,
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

  revalidatePath(`/${session.user.companyId}/estimates`);
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

  revalidatePath(`/${session.user.companyId}/estimates`);
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

  revalidatePath(`/${session.user.companyId}/estimates`);
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

  revalidatePath(`/${session.user.companyId}/estimates`);
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
  } else {
    await prisma.termsTemplate.create({ data: { companyId: session.user.companyId, name: data.name.trim(), content: data.content } });
  }
  revalidatePath(`/${session.user.companyId}/estimates`);
  return { success: true };
}

export async function deleteTermsTemplate(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "estimateTemplate:edit");
  await prisma.termsTemplate.delete({ where: { id } });
  revalidatePath(`/${session.user.companyId}/estimates`);
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

  // If a CLIENT_ESTIMATE with the same name already exists for this client, return it
  const existing = await prisma.estimateTemplate.findFirst({
    where: { companyId: session.user.companyId, clientId, type: "CLIENT_ESTIMATE", name: estimateName.trim(), archivedAt: null },
  });
  if (existing) {
    revalidatePath(`/${session.user.companyId}/clients/${clientId}`);
    return { success: true, id: existing.id, clientId };
  }

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
              name: item.name, unit: item.unit,
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
            name: item.name, unit: item.unit,
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
