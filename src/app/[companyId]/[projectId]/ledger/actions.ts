"use server";

import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { toCsv } from "@/lib/export/toCsv";
import { Role } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/permissions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getProjectAccounts(projectId: string) {
  return prisma.account.findMany({ where: { projectId } });
}

function revalidate(companyId: string, projectId: string) {
  revalidatePath(`/${companyId}/${projectId}/ledger`);
}

// ─── Guided: Partner Contribution (Dr Cash / Cr Partner Capital) ─────────────

export async function addPartnerContribution(formData: FormData) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);

  const projectId = formData.get("projectId") as string;
  const date = formData.get("date") as string;
  const partnerId = formData.get("partnerId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const notes = (formData.get("notes") as string) || undefined;

  if (!amount || amount <= 0) throw new Error("Amount must be positive");

  const accounts = await getProjectAccounts(projectId);
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const capitalAccount = accounts.find((a) => a.isPartnerCapital);
  if (!cashAccount || !capitalAccount) throw new Error("Cash or Partner Capital account not found");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });

  const entry = await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo: `Partner contribution – ${partner?.name}${notes ? ` (${notes})` : ""}`,
      createdBy: session!.user.id,
      lines: {
        create: [
          { accountId: cashAccount.id, debit: amount, credit: 0 },
          { accountId: capitalAccount.id, debit: 0, credit: amount, partnerId },
        ],
      },
    },
  });

  await writeAuditLog({
    companyId: session!.user.companyId,
    projectId,
    entityType: "JOURNAL_ENTRY",
    entityId: entry.id,
    action: "CREATE",
    changes: [{ field: "type", oldValue: null, newValue: "partner_contribution" }, { field: "amount", oldValue: null, newValue: String(amount) }],
    userId: session!.user.id,
    userName: session!.user.name ?? session!.user.email ?? "",
  });

  revalidate(session!.user.companyId, projectId);
  return { success: true };
}

// ─── Guided: Pay Expense (Dr Project Expenses / Cr Cash) ─────────────────────

export async function addPayExpense(formData: FormData) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);

  const projectId = formData.get("projectId") as string;
  const date = formData.get("date") as string;
  const memo = formData.get("memo") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const reference = (formData.get("reference") as string) || undefined;

  if (!amount || amount <= 0) throw new Error("Amount must be positive");

  const accounts = await getProjectAccounts(projectId);
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const expenseAccount = accounts.find((a) => a.name === "Project Expenses");
  if (!cashAccount || !expenseAccount) throw new Error("Cash or Project Expenses account not found");

  const payEntry = await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo,
      reference,
      createdBy: session!.user.id,
      lines: {
        create: [
          { accountId: expenseAccount.id, debit: amount, credit: 0 },
          { accountId: cashAccount.id, debit: 0, credit: amount },
        ],
      },
    },
  });

  await writeAuditLog({
    companyId: session!.user.companyId,
    projectId,
    entityType: "JOURNAL_ENTRY",
    entityId: payEntry.id,
    action: "CREATE",
    changes: [{ field: "type", oldValue: null, newValue: "pay_expense" }, { field: "amount", oldValue: null, newValue: String(amount) }],
    userId: session!.user.id,
    userName: session!.user.name ?? session!.user.email ?? "",
  });

  revalidate(session!.user.companyId, projectId);
  return { success: true };
}

// ─── Guided: Distribution / Draw (Dr Owner Draws / Cr Cash) ──────────────────

export async function addDistribution(formData: FormData) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);

  const projectId = formData.get("projectId") as string;
  const date = formData.get("date") as string;
  const partnerId = (formData.get("partnerId") as string) || undefined;
  const amount = parseFloat(formData.get("amount") as string);
  const memo = formData.get("memo") as string;

  if (!amount || amount <= 0) throw new Error("Amount must be positive");

  const accounts = await getProjectAccounts(projectId);
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const drawAccount = accounts.find((a) => a.name === "Owner Draws");
  if (!cashAccount || !drawAccount) throw new Error("Cash or Owner Draws account not found");

  const distEntry = await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo: memo || "Distribution / Draw",
      createdBy: session!.user.id,
      lines: {
        create: [
          { accountId: drawAccount.id, debit: amount, credit: 0, ...(partnerId ? { partnerId } : {}) },
          { accountId: cashAccount.id, debit: 0, credit: amount },
        ],
      },
    },
  });

  await writeAuditLog({
    companyId: session!.user.companyId,
    projectId,
    entityType: "JOURNAL_ENTRY",
    entityId: distEntry.id,
    action: "CREATE",
    changes: [{ field: "type", oldValue: null, newValue: "distribution" }, { field: "amount", oldValue: null, newValue: String(amount) }],
    userId: session!.user.id,
    userName: session!.user.name ?? session!.user.email ?? "",
  });

  revalidate(session!.user.companyId, projectId);
  return { success: true };
}

// ─── Advanced: Freeform Journal Entry (enforces debit=credit) ────────────────

export async function addJournalEntry(formData: FormData) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);

  const projectId = formData.get("projectId") as string;
  const date = formData.get("date") as string;
  const memo = formData.get("memo") as string;
  const reference = (formData.get("reference") as string) || undefined;

  const debitAccountId = formData.get("debitAccountId") as string;
  const creditAccountId = formData.get("creditAccountId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const partnerId = (formData.get("partnerId") as string) || undefined;

  if (!amount || amount <= 0) throw new Error("Amount must be positive");
  if (debitAccountId === creditAccountId) throw new Error("Debit and credit accounts must differ");

  const manualEntry = await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo,
      reference,
      createdBy: session!.user.id,
      lines: {
        create: [
          { accountId: debitAccountId, debit: amount, credit: 0 },
          { accountId: creditAccountId, debit: 0, credit: amount, ...(partnerId ? { partnerId } : {}) },
        ],
      },
    },
  });

  await writeAuditLog({
    companyId: session!.user.companyId,
    projectId,
    entityType: "JOURNAL_ENTRY",
    entityId: manualEntry.id,
    action: "CREATE",
    changes: [{ field: "type", oldValue: null, newValue: "manual" }, { field: "amount", oldValue: null, newValue: String(amount) }],
    userId: session!.user.id,
    userName: session!.user.name ?? session!.user.email ?? "",
  });

  revalidate(session!.user.companyId, projectId);
  return { success: true };
}

// ─── Reversal (audit-safe, no deletes) ───────────────────────────────────────

export async function reverseJournalEntry(entryId: string) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);
  requirePermission(session, "journalEntry:reverse");

  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (entry.isReversal) throw new Error("Cannot reverse a reversal entry");

  // Check if already reversed
  const existing = await prisma.journalEntry.findFirst({
    where: { reversesId: entryId },
  });
  if (existing) throw new Error("Entry has already been reversed");

  const today = new Date().toISOString().split("T")[0];

  const reversal = await prisma.journalEntry.create({
    data: {
      projectId: entry.projectId,
      date: new Date(today),
      memo: `REVERSAL: ${entry.memo}`,
      reference: entry.reference ? `REV-${entry.reference}` : undefined,
      isReversal: true,
      reversesId: entryId,
      createdBy: session!.user.id,
      lines: {
        create: entry.lines.map((l) => ({
          accountId: l.accountId,
          partnerId: l.partnerId ?? undefined,
          debit: Number(l.credit),   // swap
          credit: Number(l.debit),   // swap
        })),
      },
    },
  });

  await writeAuditLog({
    companyId: session!.user.companyId,
    projectId: entry.projectId,
    entityType: "JOURNAL_ENTRY",
    entityId: reversal.id,
    action: "REVERSE",
    changes: [{ field: "reversesId", oldValue: null, newValue: entryId }],
    userId: session!.user.id,
    userName: session!.user.name ?? session!.user.email ?? "",
  });

  revalidate(session!.user.companyId, entry.projectId);
  return { success: true };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportLedgerCsv(projectId: string) {
  const entries = await prisma.journalEntry.findMany({
    where: { projectId },
    include: { lines: { include: { account: true, partner: true } } },
    orderBy: { date: "desc" },
  });

  const rows = entries.flatMap((e) =>
    e.lines.map((line) => ({
      date: e.date.toISOString().split("T")[0],
      reference: e.reference ?? "",
      memo: e.memo,
      is_reversal: e.isReversal ? "yes" : "no",
      account: line.account.name,
      partner: line.partner?.name ?? "",
      debit: line.debit.toString(),
      credit: line.credit.toString(),
    }))
  );

  return toCsv(rows, "ledger.csv");
}

// ─── Legacy alias (kept for backward compat with any existing calls) ─────────
export { addDistribution as addExpenseDraw };
