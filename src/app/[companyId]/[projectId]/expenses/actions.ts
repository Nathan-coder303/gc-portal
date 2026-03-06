"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { parseExpensesCsv } from "@/lib/csv/parseExpenses";
import { toCsv } from "@/lib/export/toCsv";

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
});

export async function addExpense(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

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
  });

  // Duplicate detection
  const expDate = new Date(data.date);
  const duplicate = await prisma.expense.findFirst({
    where: {
      projectId: data.projectId,
      vendor: data.vendor,
      amount: data.amount,
      date: expDate,
    },
  });

  const expense = await prisma.expense.create({
    data: {
      ...data,
      date: expDate,
      companyId: session.user.companyId,
      isDuplicate: !!duplicate,
      createdBy: session.user.id,
    },
  });

  // Auto-create journal entry
  const [cashAccount, expAccount] = await Promise.all([
    prisma.account.findFirst({ where: { projectId: data.projectId, name: "Cash" } }),
    prisma.account.findFirst({ where: { projectId: data.projectId, name: "Project Expenses" } }),
  ]);

  if (cashAccount && expAccount) {
    await prisma.journalEntry.create({
      data: {
        projectId: data.projectId,
        date: expDate,
        memo: `Expense: ${data.vendor} - ${data.description}`,
        reference: `EXP-${expense.id.slice(-6)}`,
        createdBy: session.user.id,
        lines: {
          create: [
            { accountId: expAccount.id, debit: data.amount, credit: 0 },
            { accountId: cashAccount.id, debit: 0, credit: data.amount },
          ],
        },
      },
    });
  }

  revalidatePath(`/${session.user.companyId}/${data.projectId}/expenses`);
  return { success: true, id: expense.id };
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new Error("Not found");

  await prisma.expense.delete({ where: { id } });
  revalidatePath(`/${session.user.companyId}/${expense.projectId}/expenses`);
  return { success: true };
}

export async function importExpensesCsv(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const projectId = formData.get("projectId") as string;
  const csvText = formData.get("csv") as string;

  const { rows, errors } = parseExpensesCsv(csvText);
  if (errors.length > 0) return { success: false, errors, imported: 0 };

  // Look up cost codes
  const costCodes = await prisma.costCode.findMany({ where: { projectId } });
  const ccMap = new Map(costCodes.map((c) => [c.code, c.id]));

  const seen = new Map<string, boolean>();
  let imported = 0;

  for (const row of rows) {
    const expDate = new Date(row.date);
    const key = `${row.vendor}|${row.amount}|${row.date}`;
    const existingDup = await prisma.expense.findFirst({
      where: { projectId, vendor: row.vendor, amount: row.amount, date: expDate },
    });
    const isDuplicate = !!existingDup || seen.has(key);
    seen.set(key, true);

    await prisma.expense.create({
      data: {
        projectId,
        companyId: session.user.companyId,
        date: expDate,
        vendor: row.vendor,
        description: row.description,
        costCodeId: row.costCode ? ccMap.get(row.costCode) : undefined,
        category: row.category,
        amount: row.amount,
        tax: row.tax,
        paymentMethod: row.paymentMethod,
        paidBy: row.paidBy,
        receiptUrl: row.receiptUrl || undefined,
        isDuplicate,
        createdBy: session.user.id,
      },
    });
    imported++;
  }

  revalidatePath(`/${session.user.companyId}/${projectId}/expenses`);
  return { success: true, errors: [], imported };
}

export async function exportExpensesCsv(projectId: string) {
  const expenses = await prisma.expense.findMany({
    where: { projectId },
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
    payment_method: e.paymentMethod,
    paid_by: e.paidBy,
    is_duplicate: e.isDuplicate ? "yes" : "no",
    receipt_url: e.receiptUrl ?? "",
  }));

  return toCsv(rows, "expenses.csv");
}
