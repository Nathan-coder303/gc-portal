import { prisma } from "@/lib/prisma";
import { subDays, addDays } from "date-fns";

export type DuplicateCheckResult = {
  isDuplicate: boolean;    // exact match
  isPossibleDup: boolean;  // fuzzy match
};

/**
 * Fuzzy duplicate detection:
 * - Exact: same vendor (case-insensitive) + amount + date
 * - Fuzzy: same vendor + amount within ±$0.01 + date within ±2 days
 * - Or: same receiptHash (file hash match)
 */
export async function checkDuplicate(
  projectId: string,
  vendor: string,
  amount: number,
  date: Date,
  receiptHash?: string | null,
  excludeId?: string
): Promise<DuplicateCheckResult> {
  const dateStr = date.toISOString().split("T")[0];
  const dateStart = new Date(dateStr + "T00:00:00");

  const baseWhere = excludeId
    ? { projectId, NOT: { id: excludeId } }
    : { projectId };

  // Exact match
  const exact = await prisma.expense.findFirst({
    where: {
      ...baseWhere,
      vendor: { equals: vendor, mode: "insensitive" as const },
      amount: amount,
      date: dateStart,
    },
  });

  if (exact) return { isDuplicate: true, isPossibleDup: false };

  // Receipt hash match
  if (receiptHash) {
    const hashMatch = await prisma.expense.findFirst({
      where: { ...baseWhere, receiptHash },
    });
    if (hashMatch) return { isDuplicate: true, isPossibleDup: false };
  }

  // Fuzzy: amount ±$0.01, date ±2 days, same vendor
  const fuzzy = await prisma.expense.findFirst({
    where: {
      ...baseWhere,
      vendor: { equals: vendor, mode: "insensitive" as const },
      amount: { gte: amount - 0.01, lte: amount + 0.01 },
      date: {
        gte: subDays(dateStart, 2),
        lte: addDays(dateStart, 2),
      },
    },
  });

  return { isDuplicate: false, isPossibleDup: !!fuzzy };
}
