import Papa from "papaparse";
import { z } from "zod";

const ExpenseRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  vendor: z.string().min(1, "Vendor required"),
  description: z.string().min(1, "Description required"),
  cost_code: z.string().optional(),
  category: z.string().min(1, "Category required"),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid amount"),
  tax: z.string().optional(),
  payment_method: z.string().min(1, "Payment method required"),
  paid_by: z.string().min(1, "Paid by required"),
  receipt_url: z.string().optional(),
});

export type ParsedExpenseRow = {
  date: string;
  vendor: string;
  description: string;
  costCode: string;
  category: string;
  amount: number;
  tax: number;
  paymentMethod: string;
  paidBy: string;
  receiptUrl: string;
  rowIndex: number;
};

export type ExpenseParseResult = {
  rows: ParsedExpenseRow[];
  errors: { row: number; field: string; message: string }[];
};

export function parseExpensesCsv(csvText: string): ExpenseParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const rows: ParsedExpenseRow[] = [];
  const errors: { row: number; field: string; message: string }[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i];
    const parsed = ExpenseRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: i + 2,
          field: String(issue.path[0] ?? "unknown"),
          message: issue.message,
        });
      }
    } else {
      const d = parsed.data;
      rows.push({
        date: d.date,
        vendor: d.vendor,
        description: d.description,
        costCode: d.cost_code ?? "",
        category: d.category,
        amount: parseFloat(d.amount),
        tax: parseFloat(d.tax ?? "0"),
        paymentMethod: d.payment_method,
        paidBy: d.paid_by,
        receiptUrl: d.receipt_url ?? "",
        rowIndex: i + 2,
      });
    }
  }

  return { rows, errors };
}
