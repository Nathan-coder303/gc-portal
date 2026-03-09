"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { AccountType } from "@prisma/client";

const ProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(20).toUpperCase(),
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
    code:      formData.get("code"),
    startDate: formData.get("startDate"),
    budget:    formData.get("budget"),
    status:    formData.get("status") || "ACTIVE",
  });

  const project = await prisma.project.create({
    data: {
      companyId: session.user.companyId,
      name:      data.name,
      code:      data.code,
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
      { field: "code",      oldValue: null, newValue: data.code },
      { field: "budget",    oldValue: null, newValue: String(data.budget) },
      { field: "startDate", oldValue: null, newValue: data.startDate },
    ],
    userId:   session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  return { companyId: session.user.companyId, projectId: project.id };
}
