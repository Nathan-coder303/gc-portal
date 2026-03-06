"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/permissions";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

// ─── Project ──────────────────────────────────────────────────────────────────

export async function updateProject(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "project:edit");

  const projectId = formData.get("projectId") as string;
  const existing = await prisma.project.findUnique({ where: { id: projectId } });
  if (!existing) throw new Error("Project not found");

  const name = (formData.get("name") as string).trim();
  const code = (formData.get("code") as string).trim().toUpperCase();
  const startDateStr = formData.get("startDate") as string;
  const budget = parseFloat(formData.get("budget") as string);
  const status = formData.get("status") as string;

  if (!name || !code) throw new Error("Name and code are required");
  if (isNaN(budget) || budget < 0) throw new Error("Budget must be a positive number");

  const startDate = new Date(startDateStr + "T00:00:00");

  await prisma.project.update({
    where: { id: projectId },
    data: { name, code, startDate, budget, status, updatedBy: session.user.id },
  });

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  const pairs: [string, unknown, unknown][] = [
    ["name", existing.name, name],
    ["code", existing.code, code],
    ["startDate", existing.startDate.toISOString().split("T")[0], startDateStr],
    ["budget", Number(existing.budget).toFixed(2), budget.toFixed(2)],
    ["status", existing.status, status],
  ];
  for (const [field, o, n] of pairs) {
    if (String(o) !== String(n)) changes.push({ field, oldValue: String(o), newValue: String(n) });
  }

  if (changes.length > 0) {
    await writeAuditLog({
      companyId: session.user.companyId,
      projectId,
      entityType: "PROJECT",
      entityId: projectId,
      action: "UPDATE",
      changes,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "",
    });
  }

  revalidatePath(`/${session.user.companyId}/${projectId}/settings`);
  return { success: true };
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createUser(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "user:create");

  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const role = formData.get("role") as Role;
  const password = formData.get("password") as string;

  if (!name || !email || !password) throw new Error("Name, email, and password are required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (!Object.values(Role).includes(role)) throw new Error("Invalid role");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with that email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      companyId: session.user.companyId,
      name,
      email,
      role,
      passwordHash,
      updatedBy: session.user.id,
    },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "USER",
    entityId: user.id,
    action: "CREATE",
    changes: [{ field: "role", oldValue: null, newValue: role }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function updateUserRole(userId: string, role: Role) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "user:edit");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.companyId !== session.user.companyId) throw new Error("Forbidden");

  await prisma.user.update({
    where: { id: userId },
    data: { role, updatedBy: session.user.id },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "USER",
    entityId: userId,
    action: "UPDATE",
    changes: [{ field: "role", oldValue: user.role, newValue: role }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function archiveUser(userId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "user:archive");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.companyId !== session.user.companyId) throw new Error("Forbidden");
  if (user.id === session.user.id) throw new Error("Cannot archive your own account");

  await prisma.user.update({
    where: { id: userId },
    data: { archivedAt: new Date(), archivedBy: session.user.id, updatedBy: session.user.id },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "USER",
    entityId: userId,
    action: "ARCHIVE",
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}
