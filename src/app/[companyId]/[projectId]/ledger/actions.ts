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
  return prisma.account.findMany({ where: { projectId, archivedAt: null } });
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
  const method = (formData.get("method") as string) || undefined;

  if (!amount || amount <= 0) throw new Error("Amount must be positive");

  const accounts = await getProjectAccounts(projectId);
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const capitalAccount = accounts.find((a) => a.isPartnerCapital);
  if (!cashAccount || !capitalAccount) throw new Error("Cash or Partner Capital account not found");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });

  const memoSuffix = [method, notes].filter(Boolean).join(" – ");
  const entry = await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo: `Partner contribution – ${partner?.name}${memoSuffix ? ` (${memoSuffix})` : ""}`,
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
  const payee = (formData.get("payee") as string) || undefined;
  const description = (formData.get("description") as string) || undefined;
  const paymentSource = (formData.get("paymentSource") as string) || undefined;
  const amount = parseFloat(formData.get("amount") as string);
  const reference = (formData.get("reference") as string) || undefined;

  if (!amount || amount <= 0) throw new Error("Amount must be positive");

  const accounts = await getProjectAccounts(projectId);
  const cashAccount = accounts.find((a) => a.name === "Cash");
  const expenseAccount = accounts.find((a) => a.name === "Project Expenses");
  if (!cashAccount || !expenseAccount) throw new Error("Cash or Project Expenses account not found");

  const memoParts = [payee, description, paymentSource ? `via ${paymentSource}` : undefined].filter(Boolean);
  const memo = memoParts.length > 0 ? memoParts.join(" – ") : (description ?? "Expense payment");

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

// ─── Partner management ───────────────────────────────────────────────────────

export async function createPartner(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:create");

  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim() || null;
  const role = (formData.get("role") as string).trim() || null;
  const ownershipPctRaw = formData.get("ownershipPct") as string;
  const ownershipPct = ownershipPctRaw ? parseFloat(ownershipPctRaw) : null;

  if (!name) throw new Error("Name is required");

  const partner = await prisma.partner.create({
    data: {
      companyId: session.user.companyId,
      name,
      email,
      role,
      ownershipPct: ownershipPct ?? null,
      updatedBy: session.user.id,
    },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "PARTNER",
    entityId: partner.id,
    action: "CREATE",
    changes: [{ field: "name", oldValue: null, newValue: name }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function updatePartner(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:edit");

  const id = formData.get("id") as string;
  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) throw new Error("Partner not found");
  if (existing.companyId !== session.user.companyId) throw new Error("Forbidden");

  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim() || null;
  const role = (formData.get("role") as string).trim() || null;
  const ownershipPctRaw = formData.get("ownershipPct") as string;
  const ownershipPct = ownershipPctRaw ? parseFloat(ownershipPctRaw) : null;

  if (!name) throw new Error("Name is required");
  if (ownershipPct !== null && (ownershipPct < 0 || ownershipPct > 100)) throw new Error("Ownership must be 0–100");

  await prisma.partner.update({
    where: { id },
    data: { name, email, role, ownershipPct: ownershipPct ?? null, updatedBy: session.user.id },
  });

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  const pairs: [string, unknown, unknown][] = [
    ["name", existing.name, name],
    ["email", existing.email, email],
    ["role", existing.role, role],
    ["ownershipPct", existing.ownershipPct != null ? String(existing.ownershipPct) : null, ownershipPct != null ? String(ownershipPct) : null],
  ];
  for (const [field, o, n] of pairs) {
    const os = o == null ? null : String(o);
    const ns = n == null ? null : String(n);
    if (os !== ns) changes.push({ field, oldValue: os, newValue: ns });
  }

  if (changes.length > 0) {
    await writeAuditLog({
      companyId: session.user.companyId,
      entityType: "PARTNER",
      entityId: id,
      action: "UPDATE",
      changes,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "",
    });
  }

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function archivePartner(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:archive");

  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) throw new Error("Partner not found");
  if (partner.companyId !== session.user.companyId) throw new Error("Forbidden");

  await prisma.partner.update({
    where: { id },
    data: { archivedAt: new Date(), archivedBy: session.user.id, updatedBy: session.user.id },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    entityType: "PARTNER",
    entityId: id,
    action: "ARCHIVE",
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function archiveAllPartners() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:archive");

  const partners = await prisma.partner.findMany({
    where: { companyId: session.user.companyId, archivedAt: null },
    select: { id: true },
  });

  for (const p of partners) {
    await prisma.partner.update({
      where: { id: p.id },
      data: { archivedAt: new Date(), archivedBy: session.user.id, updatedBy: session.user.id },
    });
  }

  revalidatePath(`/${session.user.companyId}`);
  return { success: true, count: partners.length };
}

// ─── Account management ───────────────────────────────────────────────────────

export async function updateAccount(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "account:create"); // reuse create permission for edits

  const id = formData.get("id") as string;
  const projectId = formData.get("projectId") as string;
  const name = (formData.get("name") as string).trim();

  if (!name) throw new Error("Name is required");

  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing || existing.projectId !== projectId) throw new Error("Account not found");

  await prisma.account.update({
    where: { id },
    data: { name, updatedBy: session.user.id },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    projectId,
    entityType: "ACCOUNT",
    entityId: id,
    action: "UPDATE",
    changes: [{ field: "name", oldValue: existing.name, newValue: name }],
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}/${projectId}/ledger`);
  revalidatePath(`/${session.user.companyId}/${projectId}/settings`);
  return { success: true };
}

export async function archiveAccount(id: string, projectId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "account:archive");

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.projectId !== projectId) throw new Error("Account not found");

  await prisma.account.update({
    where: { id },
    data: { archivedAt: new Date(), archivedBy: session.user.id, updatedBy: session.user.id },
  });

  await writeAuditLog({
    companyId: session.user.companyId,
    projectId,
    entityType: "ACCOUNT",
    entityId: id,
    action: "ARCHIVE",
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "",
  });

  revalidatePath(`/${session.user.companyId}/${projectId}/ledger`);
  revalidatePath(`/${session.user.companyId}/${projectId}/settings`);
  return { success: true };
}

// ─── Partner Portal Access ────────────────────────────────────────────────────

export async function createPartnerPortalAccess(data: {
  partnerId: string;
  projectId: string;
  email: string;
  password: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "user:create");

  const bcrypt = (await import("bcryptjs")).default;

  const partner = await prisma.partner.findUnique({ where: { id: data.partnerId } });
  if (!partner) throw new Error("Partner not found");
  if (partner.companyId !== session.user.companyId) throw new Error("Forbidden");

  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with that email already exists");

  if (data.password.length < 8) throw new Error("Password must be at least 8 characters");

  const passwordHash = await bcrypt.hash(data.password, 12);

  // Extract last name from partner name (last word)
  const nameParts = partner.name.trim().split(" ");
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : partner.name;

  const user = await prisma.user.create({
    data: {
      companyId: session.user.companyId,
      name: partner.name,
      lastName,
      email,
      role: "PARTNER",
      passwordHash,
      updatedBy: session.user.id,
    },
  });

  // Grant access to this specific project
  await prisma.userProjectAccess.create({
    data: { userId: user.id, projectId: data.projectId },
  });

  revalidatePath(`/${session.user.companyId}/${data.projectId}/ledger`);
  return { success: true, userId: user.id };
}

// ─── Payees ───────────────────────────────────────────────────────────────────

export async function createPayee(name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");
  return prisma.payee.upsert({
    where: { companyId_name: { companyId: session.user.companyId, name: trimmed } },
    update: {},
    create: { companyId: session.user.companyId, name: trimmed },
  });
}

// ─── Legacy alias (kept for backward compat with any existing calls) ─────────
export { addDistribution as addExpenseDraw };

// ─── Partner Account Dashboard ────────────────────────────────────────────────

export async function updatePartnerBeginningBalance(partnerId: string, amount: number) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:edit");
  await prisma.partner.update({ where: { id: partnerId }, data: { beginningBalance: amount } });
  revalidatePath(`/${session.user.companyId}`);
  return { success: true };
}

export async function updateLlcName(projectId: string, name: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:edit");
  await prisma.project.update({ where: { id: projectId }, data: { llcName: name.trim() || null } });
  revalidatePath(`/${session.user.companyId}/${projectId}/ledger`);
}

export async function updateLlcBeginningBalance(projectId: string, amount: number) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:edit");
  await prisma.project.update({ where: { id: projectId }, data: { llcBeginningBalance: amount } });
  revalidatePath(`/${session.user.companyId}/${projectId}/ledger`);
  return { success: true };
}

export async function addPartnerAccountEntry(data: {
  projectId: string;
  companyId: string;
  accountType: "PARTNER" | "LLC";
  partnerId?: string;
  description: string;
  amount: number;
  entryType: "CREDIT" | "DEBIT";
  date: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  if (data.amount <= 0) throw new Error("Amount must be positive");

  await prisma.partnerAccountEntry.create({
    data: {
      projectId: data.projectId,
      accountType: data.accountType,
      partnerId: data.partnerId ?? null,
      description: data.description,
      amount: data.amount,
      entryType: data.entryType,
      date: new Date(data.date),
      createdBy: session.user.id,
    },
  });

  revalidatePath(`/${data.companyId}/${data.projectId}/ledger`);
  return { success: true };
}

export async function deletePartnerAccountEntry(id: string, companyId: string, projectId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:edit");
  await prisma.partnerAccountEntry.delete({ where: { id } });
  revalidatePath(`/${companyId}/${projectId}/ledger`);
  return { success: true };
}

export async function updatePartnerAccountEntry(
  id: string,
  data: { description: string; amount: number; date: string },
  companyId: string,
  projectId: string,
) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  requirePermission(session, "partner:edit");
  const entry = await prisma.partnerAccountEntry.update({
    where: { id },
    data: { description: data.description, amount: data.amount, date: new Date(data.date) },
  });
  // Cascade date and amount to the linked counterpart entry
  if (entry.linkedEntryId) {
    await prisma.partnerAccountEntry.update({
      where: { id: entry.linkedEntryId },
      data: { amount: data.amount, date: new Date(data.date) },
    });
  }
  revalidatePath(`/${companyId}/${projectId}/ledger`);
  return { success: true };
}
