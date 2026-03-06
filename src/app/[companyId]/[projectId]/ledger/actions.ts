"use server";

import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { toCsv } from "@/lib/export/toCsv";
import { Role } from "@prisma/client";

export async function addJournalEntry(formData: FormData) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);

  const projectId = formData.get("projectId") as string;
  const date = formData.get("date") as string;
  const memo = formData.get("memo") as string;
  const reference = formData.get("reference") as string;

  const debitAccountId = formData.get("debitAccountId") as string;
  const creditAccountId = formData.get("creditAccountId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const partnerId = formData.get("partnerId") as string || undefined;

  await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo,
      reference: reference || undefined,
      createdBy: session!.user.id,
      lines: {
        create: [
          { accountId: debitAccountId, debit: amount, credit: 0 },
          { accountId: creditAccountId, debit: 0, credit: amount, partnerId },
        ],
      },
    },
  });

  revalidatePath(`/${session!.user.companyId}/${projectId}/ledger`);
  return { success: true };
}

export async function addPartnerContribution(formData: FormData) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);

  const projectId = formData.get("projectId") as string;
  const date = formData.get("date") as string;
  const partnerId = formData.get("partnerId") as string;
  const amount = parseFloat(formData.get("amount") as string);

  const [cashAccount, capitalAccount] = await Promise.all([
    prisma.account.findFirst({ where: { projectId, name: "Cash" } }),
    prisma.account.findFirst({ where: { projectId, isPartnerCapital: true } }),
  ]);

  if (!cashAccount || !capitalAccount) throw new Error("Required accounts not found");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });

  await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo: `Partner contribution - ${partner?.name}`,
      reference: undefined,
      createdBy: session!.user.id,
      lines: {
        create: [
          { accountId: cashAccount.id, debit: amount, credit: 0 },
          { accountId: capitalAccount.id, debit: 0, credit: amount, partnerId },
        ],
      },
    },
  });

  revalidatePath(`/${session!.user.companyId}/${projectId}/ledger`);
  return { success: true };
}

export async function addExpenseDraw(formData: FormData) {
  const session = await auth();
  await requireRole(session, [Role.ADMIN, Role.PM, Role.BOOKKEEPER]);

  const projectId = formData.get("projectId") as string;
  const date = formData.get("date") as string;
  const memo = formData.get("memo") as string;
  const amount = parseFloat(formData.get("amount") as string);

  const [cashAccount, drawAccount] = await Promise.all([
    prisma.account.findFirst({ where: { projectId, name: "Cash" } }),
    prisma.account.findFirst({ where: { projectId, name: "Owner Draws" } }),
  ]);

  if (!cashAccount || !drawAccount) throw new Error("Required accounts not found");

  await prisma.journalEntry.create({
    data: {
      projectId,
      date: new Date(date),
      memo,
      createdBy: session!.user.id,
      lines: {
        create: [
          { accountId: drawAccount.id, debit: amount, credit: 0 },
          { accountId: cashAccount.id, debit: 0, credit: amount },
        ],
      },
    },
  });

  revalidatePath(`/${session!.user.companyId}/${projectId}/ledger`);
  return { success: true };
}

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
      account: line.account.name,
      partner: line.partner?.name ?? "",
      debit: line.debit.toString(),
      credit: line.credit.toString(),
    }))
  );

  return toCsv(rows, "ledger.csv");
}
