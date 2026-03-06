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

  const expenses = await prisma.expense.findMany({
    where: { projectId: params.projectId, archivedAt: null },
    include: { costCode: true },
    orderBy: [{ date: "desc" }, { vendor: "asc" }],
  });

  const rows = expenses.map((e) => ({
    date: e.date.toISOString().split("T")[0],
    vendor: e.vendor,
    description: e.description,
    cost_code: e.costCode?.code ?? "",
    category: e.category,
    amount: e.amount.toString(),
    paid_by: e.paidBy,
    is_duplicate: e.isDuplicate ? "yes" : "no",
  }));

  return toCsv(rows, "daily-summary.csv");
}
