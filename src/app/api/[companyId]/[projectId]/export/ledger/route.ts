import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/export/toCsv";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string; projectId: string } }
) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const entries = await prisma.journalEntry.findMany({
    where: { projectId: params.projectId },
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
