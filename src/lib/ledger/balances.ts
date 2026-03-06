import { AccountType } from "@prisma/client";

type LineData = {
  accountId: string;
  accountType: AccountType;
  partnerId: string | null;
  debit: number;
  credit: number;
};

export function computeAccountBalance(type: AccountType, totalDebit: number, totalCredit: number): number {
  if (type === AccountType.ASSET || type === AccountType.EXPENSE) {
    return totalDebit - totalCredit;
  }
  return totalCredit - totalDebit;
}

export function computePartnerBalances(lines: LineData[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const line of lines) {
    if (line.partnerId && line.accountType === AccountType.EQUITY) {
      const current = balances.get(line.partnerId) ?? 0;
      balances.set(line.partnerId, current + line.credit - line.debit);
    }
  }
  return balances;
}
