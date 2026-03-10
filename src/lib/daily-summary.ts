import { prisma } from "@/lib/prisma";

export type DailySummaryRow = {
  id: string;
  date: Date;
  content: string;
  createdAt: Date;
};

export async function getDailySummaries(companyId: string, limit = 30): Promise<DailySummaryRow[]> {
  return prisma.dailySummary.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
    take: limit,
    select: { id: true, date: true, content: true, createdAt: true },
  });
}
