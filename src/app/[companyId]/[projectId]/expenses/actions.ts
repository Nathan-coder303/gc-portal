"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { toCsv } from "@/lib/export/toCsv";
import { checkDuplicate } from "@/lib/expenses/duplicates";
import { writeAuditLog } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/permissions";

const ExpenseSchema = z.object({
  projectId: z.string(),
  date: z.string(),
  vendor: z.string().min(1),
  description: z.string().min(1),
  costCodeId: z.string().optional(),
  category: z.string().min(1),
  amount: z.coerce.number().positive(),
  tax: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().min(1),
  paidBy: z.string().min(1),
  receiptUrl: z.string().optional(),
  receiptHash: z.string().optional(),
  notes: z.string().optional(),
});

export async function addExpense(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "expense:create");

  const data = ExpenseSchema.parse({
    projectId: formData.get("projectId"),
    date: formData.get("date"),
    vendor: formData.get("vendor"),
    description: formData.get("description"),
    costCodeId: formData.get("costCodeId") || undefined,
    category: formData.get("category"),
    amount: formData.get("amount"),
    tax: formData.get("tax") || 0,
    paymentMethod: formData.get("paymentMethod"),
    paidBy: formData.get("paidBy"),
    receiptUrl: formData.get("receiptUrl") || undefined,
    receiptHash: formData.get("receiptHash") || undefined,
    notes: formData.get("notes") || undefined,
  });

  const expDate = new Date(data.date + "T00:00:00");
  const { isDuplicate, isPossibleDup } = await checkDuplicate(
    data.projectId, data.vendor, data.amount, expDate, data.receiptHash
  );

  const expense = await prisma.expense.create({
    data: {
      projectId: data.projectId,
      companyId: session.user.companyId,
      date: expDate,
      vendor: data.vendor,
      description: data.description,
      costCodeId: data.costCodeId,
      category: data.category,
      amount: data.amount,
      tax: data.tax,
      paymentMethod: data.paymentMethod,
      paidBy: data.paidBy,
      receiptUrl: data.receiptUrl,
      receiptHash: data.receiptHash,
      notes: data.notes,
      isDuplicate,
      isPossibleDup,
      createdBy: session.user.id,
    },
  });

  // Auto-create journal entry
  const [cashAccount, expAccount] = await Promise.all([
    prisma.account.findFirst({ where: { projectId: data.projectId, name: "Cash" } }),
    prisma.account.findFirst({ where: { projectId: data.projectId, name: "Project Expenses" } }),
  ]);

  if (cashAccount && expAccount) {
    const total = data.amount + data.tax;
    await prisma.journalEntry.create({
      data: {
        projectId: data.projectId,
        date: expDate,
        memo: `Expense: ${data.vendor} - ${data.description}`,
        reference: `EXP-${expense.id.slice(-6)}`,
        createdBy: session.user.id,
        lines: {
          create: [
            { accountId: expAccount.id, debit: total, credit: 0 },
            { accountId: cashAccount.id, debit: 0, credit: total },
          ],
        },
      },
    });
  }

  await writeAuditLog({
    companyId: session.user.companyId,
    projectId: data.projectId,
    entityType: "EXPENSE",
    entityId: expense.id,
    action: "CREATE",
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}/${data.projectId}/expenses`);
  return { success: true, id: expense.id, isDuplicate, isPossibleDup };
}

export async function updateExpense(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "expense:edit");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing expense id");

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");

  const data = ExpenseSchema.parse({
    projectId: existing.projectId,
    date: formData.get("date"),
    vendor: formData.get("vendor"),
    description: formData.get("description"),
    costCodeId: formData.get("costCodeId") || undefined,
    category: formData.get("category"),
    amount: formData.get("amount"),
    tax: formData.get("tax") || 0,
    paymentMethod: formData.get("paymentMethod"),
    paidBy: formData.get("paidBy"),
    receiptUrl: formData.get("receiptUrl") || undefined,
    receiptHash: formData.get("receiptHash") || undefined,
    notes: formData.get("notes") || undefined,
  });

  const expDate = new Date(data.date + "T00:00:00");
  const { isDuplicate, isPossibleDup } = await checkDuplicate(
    existing.projectId, data.vendor, data.amount, expDate, data.receiptHash, id
  );

  await prisma.expense.update({
    where: { id },
    data: {
      date: expDate,
      vendor: data.vendor,
      description: data.description,
      costCodeId: data.costCodeId ?? null,
      category: data.category,
      amount: data.amount,
      tax: data.tax,
      paymentMethod: data.paymentMethod,
      paidBy: data.paidBy,
      receiptUrl: data.receiptUrl ?? null,
      receiptHash: data.receiptHash ?? null,
      notes: data.notes ?? null,
      isDuplicate,
      isPossibleDup,
      updatedBy: session.user.id,
    },
  });

  // Build change diff for audit
  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  const fields: [string, unknown, unknown][] = [
    ["date", existing.date.toISOString().split("T")[0], data.date],
    ["vendor", existing.vendor, data.vendor],
    ["description", existing.description, data.description],
    ["costCodeId", existing.costCodeId, data.costCodeId ?? null],
    ["category", existing.category, data.category],
    ["amount", Number(existing.amount).toFixed(2), data.amount.toFixed(2)],
    ["tax", Number(existing.tax).toFixed(2), data.tax.toFixed(2)],
    ["paymentMethod", existing.paymentMethod, data.paymentMethod],
    ["paidBy", existing.paidBy, data.paidBy],
    ["notes", existing.notes, data.notes ?? null],
  ];
  for (const [field, oldVal, newVal] of fields) {
    const o = oldVal == null ? null : String(oldVal);
    const n = newVal == null ? null : String(newVal);
    if (o !== n) changes.push({ field, oldValue: o, newValue: n });
  }

  if (changes.length > 0) {
    await writeAuditLog({
      companyId: session.user.companyId,
      projectId: existing.projectId,
      entityType: "EXPENSE",
      entityId: id,
      action: "UPDATE",
      changes,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "",
    });
  }

  revalidatePath(`/${session.user.companyId}/${existing.projectId}/expenses`);
  return { success: true };
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "expense:archive");

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new Error("Not found");

  await prisma.expense.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      archivedBy: session.user.id,
      updatedBy: session.user.id,
    },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    projectId: expense.projectId,
    entityType: "EXPENSE",
    entityId: id,
    action: "ARCHIVE",
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}/${expense.projectId}/expenses`);
  return { success: true };
}

export async function importExpensesCsv(
  projectId: string,
  rows: {
    date: string; vendor: string; description: string; costCode: string;
    category: string; amount: number; tax: number; paymentMethod: string;
    paidBy: string; receiptUrl: string; notes: string;
  }[]
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "expense:import");

  const costCodes = await prisma.costCode.findMany({ where: { projectId, archivedAt: null } });
  const ccMap = new Map(costCodes.map((c) => [c.code.toLowerCase(), c.id]));

  let imported = 0;
  const rowErrors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const expDate = new Date(row.date + "T00:00:00");
      const { isDuplicate, isPossibleDup } = await checkDuplicate(
        projectId, row.vendor, row.amount, expDate
      );

      await prisma.expense.create({
        data: {
          projectId,
          companyId: session.user.companyId,
          date: expDate,
          vendor: row.vendor,
          description: row.description,
          costCodeId: row.costCode ? ccMap.get(row.costCode.toLowerCase()) : undefined,
          category: row.category,
          amount: row.amount,
          tax: row.tax,
          paymentMethod: row.paymentMethod,
          paidBy: row.paidBy,
          receiptUrl: row.receiptUrl || undefined,
          notes: row.notes || undefined,
          isDuplicate,
          isPossibleDup,
          createdBy: session.user.id,
        },
      });
      imported++;
    } catch {
      rowErrors.push({ row: i + 2, message: "Failed to insert row" });
    }
  }

  if (imported > 0) {
    await writeAuditLog({
      companyId: session.user.companyId,
      projectId,
      entityType: "EXPENSE",
      entityId: projectId,
      action: "IMPORT",
      changes: [{ field: "count", oldValue: null, newValue: String(imported) }],
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "",
    });
  }

  revalidatePath(`/${session.user.companyId}/${projectId}/expenses`);
  return { success: rowErrors.length === 0, imported, rowErrors };
}

export async function exportExpensesCsv(projectId: string) {
  const expenses = await prisma.expense.findMany({
    where: { projectId, archivedAt: null },
    include: { costCode: true },
    orderBy: { date: "desc" },
  });

  const rows = expenses.map((e) => ({
    date: e.date.toISOString().split("T")[0],
    vendor: e.vendor,
    description: e.description,
    cost_code: e.costCode?.code ?? "",
    category: e.category,
    amount: e.amount.toString(),
    tax: e.tax.toString(),
    total: (Number(e.amount) + Number(e.tax)).toFixed(2),
    payment_method: e.paymentMethod,
    paid_by: e.paidBy,
    notes: e.notes ?? "",
    is_duplicate: e.isDuplicate ? "yes" : "",
    possible_dup: e.isPossibleDup ? "yes" : "",
    receipt_url: e.receiptUrl ?? "",
  }));

  return toCsv(rows, "expenses.csv");
}

// Cost code management
export async function upsertCostCode(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const id = formData.get("id") as string | null;
  const projectId = formData.get("projectId") as string;
  const code = (formData.get("code") as string).trim().toUpperCase();
  const name = formData.get("name") as string;
  const budgetAmount = parseFloat(formData.get("budgetAmount") as string) || 0;

  if (id) {
    requirePermission(session, "costCode:edit");
    const existing = await prisma.costCode.findUnique({ where: { id } });
    await prisma.costCode.update({
      where: { id },
      data: { code, name, budgetAmount, updatedBy: session.user.id },
    });
    const changes = [];
    if (existing?.code !== code) changes.push({ field: "code", oldValue: existing?.code ?? null, newValue: code });
    if (existing?.name !== name) changes.push({ field: "name", oldValue: existing?.name ?? null, newValue: name });
    if (Number(existing?.budgetAmount) !== budgetAmount) changes.push({ field: "budgetAmount", oldValue: String(existing?.budgetAmount ?? ""), newValue: String(budgetAmount) });
    await writeAuditLog({ companyId: session.user.companyId, projectId, entityType: "COST_CODE", entityId: id, action: "UPDATE", changes, userId: session.user.id, userName: session.user.name ?? session.user.email ?? "" });
  } else {
    requirePermission(session, "costCode:create");
    const cc = await prisma.costCode.create({
      data: { projectId, code, name, budgetAmount, updatedBy: session.user.id },
    });
    await writeAuditLog({ companyId: session.user.companyId, projectId, entityType: "COST_CODE", entityId: cc.id, action: "CREATE", userId: session.user.id, userName: session.user.name ?? session.user.email ?? "" });
  }

  revalidatePath(`/${session.user.companyId}/${projectId}/settings`);
  revalidatePath(`/${session.user.companyId}/${projectId}/expenses`);
  return { success: true };
}

export async function deleteCostCode(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "costCode:archive");

  const cc = await prisma.costCode.findUnique({ where: { id } });
  if (!cc) throw new Error("Not found");

  await prisma.costCode.update({
    where: { id },
    data: { archivedAt: new Date(), archivedBy: session.user.id, updatedBy: session.user.id },
  });

  await writeAuditLog({ companyId: session.user.companyId, projectId: cc.projectId, entityType: "COST_CODE", entityId: id, action: "ARCHIVE", userId: session.user.id, userName: session.user.name ?? session.user.email ?? "" });

  revalidatePath(`/${session.user.companyId}/${cc.projectId}/settings`);
  return { success: true };
}
