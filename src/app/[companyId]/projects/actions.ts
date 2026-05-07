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
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
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
    city:      formData.get("city") || undefined,
    state:     formData.get("state") || undefined,
    zip:       formData.get("zip") || undefined,
    startDate: formData.get("startDate"),
    budget:    formData.get("budget"),
    status:    formData.get("status") || "ACTIVE",
  });

  const project = await prisma.project.create({
    data: {
      companyId: session.user.companyId,
      name:      data.name,
      address:   data.address ?? null,
      city:      data.city ?? null,
      state:     data.state ?? null,
      zip:       data.zip ?? null,
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

export async function updateProject(projectId: string, data: {
  name?: string; address?: string; city?: string; state?: string; zip?: string;
  startDate?: string; budget?: number; status?: string; photoUrl?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "project:edit");

  await prisma.project.update({
    where: { id: projectId, companyId: session.user.companyId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.city !== undefined && { city: data.city || null }),
      ...(data.state !== undefined && { state: data.state || null }),
      ...(data.zip !== undefined && { zip: data.zip || null }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate + "T00:00:00") }),
      ...(data.budget !== undefined && { budget: data.budget }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      updatedBy: session.user.id,
    },
  });
}

export async function duplicateProject(projectId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "project:edit");

  const original = await prisma.project.findUnique({
    where: { id: projectId, companyId: session.user.companyId },
  });
  if (!original) throw new Error("Project not found");

  const copy = await prisma.project.create({
    data: {
      companyId: session.user.companyId,
      name: `Copy of ${original.name}`,
      address: original.address,
      city: original.city,
      state: original.state,
      zip: original.zip,
      startDate: original.startDate,
      budget: original.budget,
      status: "ACTIVE",
      updatedBy: session.user.id,
    },
  });

  await prisma.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({
      projectId: copy.id,
      name: a.name,
      type: a.type,
      isPartnerCapital: a.isPartnerCapital,
      updatedBy: session.user.id,
    })),
  });

  return { companyId: session.user.companyId, projectId: copy.id };
}

export async function addProjectPartner(projectId: string, userId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "project:edit");

  await prisma.userProjectAccess.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: {},
  });
}

export async function removeProjectPartner(projectId: string, userId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "project:edit");

  await prisma.userProjectAccess.deleteMany({ where: { userId, projectId } });
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
