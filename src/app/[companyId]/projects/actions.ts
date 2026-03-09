"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { AccountType } from "@prisma/client";

const ProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  budget: z.coerce.number().positive("Budget must be positive"),
  status: z.string().default("ACTIVE"),
});

const DEFAULT_ACCOUNTS: { name: string; type: AccountType; isPartnerCapital: boolean }[] = [
  { name: "Cash",              type: AccountType.ASSET,   isPartnerCapital: false },
  { name: "Partner Capital",   type: AccountType.EQUITY,  isPartnerCapital: true  },
  { name: "Project Expenses",  type: AccountType.EXPENSE, isPartnerCapital: false },
  { name: "Owner Draws",       type: AccountType.EQUITY,  isPartnerCapital: false },
];

export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "project:edit");

  const data = ProjectSchema.parse({
    name:      formData.get("name"),
    address:   formData.get("address") || undefined,
    startDate: formData.get("startDate"),
    budget:    formData.get("budget"),
    status:    formData.get("status") || "ACTIVE",
  });

  const project = await prisma.project.create({
    data: {
      companyId: session.user.companyId,
      name:      data.name,
      address:   data.address,
      startDate: new Date(data.startDate + "T00:00:00"),
      budget:    data.budget,
      status:    data.status,
      updatedBy: session.user.id,
    },
  });

  // Seed default ledger accounts
  await prisma.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({
      projectId:       project.id,
      name:            a.name,
      type:            a.type,
      isPartnerCapital: a.isPartnerCapital,
      updatedBy:       session.user.id,
    })),
  });

  await writeAuditLog({
    companyId:  session.user.companyId,
    projectId:  project.id,
    entityType: "PROJECT",
    entityId:   project.id,
    action:     "CREATE",
    changes: [
      { field: "name",      oldValue: null, newValue: data.name },
      { field: "budget",    oldValue: null, newValue: String(data.budget) },
      { field: "startDate", oldValue: null, newValue: data.startDate },
    ],
    userId:   session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  return { companyId: session.user.companyId, projectId: project.id };
}

export async function deleteProject(projectId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "project:edit");

  const project = await prisma.project.findUnique({
    where: { id: projectId, companyId: session.user.companyId },
  });
  if (!project) throw new Error("Project not found");

  await prisma.$transaction([
    // Estimate items, groups, divisions, estimates
    prisma.projectEstimateItem.deleteMany({ where: { division: { estimate: { projectId } } } }),
    prisma.projectEstimateGroup.deleteMany({ where: { division: { estimate: { projectId } } } }),
    prisma.projectEstimateDivision.deleteMany({ where: { estimate: { projectId } } }),
    prisma.projectEstimate.deleteMany({ where: { projectId } }),
    // Schedule
    prisma.taskChangeLog.deleteMany({ where: { task: { projectId } } }),
    prisma.task.deleteMany({ where: { projectId } }),
    // Ledger
    prisma.journalLine.deleteMany({ where: { entry: { projectId } } }),
    prisma.journalEntry.deleteMany({ where: { projectId } }),
    prisma.account.deleteMany({ where: { projectId } }),
    // Expenses
    prisma.expense.deleteMany({ where: { projectId } }),
    prisma.costCode.deleteMany({ where: { projectId } }),
    // Settings & audit
    prisma.projectSettings.deleteMany({ where: { projectId } }),
    prisma.auditLog.deleteMany({ where: { projectId } }),
    // Project
    prisma.project.delete({ where: { id: projectId } }),
  ]);
}
