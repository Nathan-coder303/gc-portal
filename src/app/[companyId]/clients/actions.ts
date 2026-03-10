"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { STANDARD_DIVISIONS } from "@/lib/divisions";

// Ensure one placeholder row per division exists (idempotent)
export async function initClientSubBids(clientId: string, companyId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const existing = await prisma.subBid.findMany({
    where: { clientId, isPlaceholder: true },
    select: { divisionCode: true },
  });
  const existingCodes = new Set(existing.map((b) => b.divisionCode));

  for (const div of STANDARD_DIVISIONS) {
    if (!existingCodes.has(div.code)) {
      await prisma.subBid.create({
        data: { clientId, companyId, divisionCode: div.code, divisionName: div.name, status: "MISSING", isPlaceholder: true },
      });
    }
  }
  revalidatePath(`/${companyId}/clients/${clientId}`);
}

// Update a placeholder row (manual edit from UI)
export async function upsertSubBid(data: {
  id?: string;
  clientId: string;
  companyId: string;
  divisionCode: string;
  divisionName: string;
  contractorName?: string;
  amount?: number | null;
  notes?: string;
  fileUrl?: string;
  fileName?: string;
  status?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const status = data.status || (data.amount ? "RECEIVED" : "MISSING");

  let record;
  if (data.id) {
    // Update specific record by ID
    record = await prisma.subBid.update({
      where: { id: data.id },
      data: {
        contractorName: data.contractorName || null,
        amount: data.amount ?? null,
        notes: data.notes || null,
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
        status,
      },
    });
  } else {
    // Find the placeholder for this division and update it
    const placeholder = await prisma.subBid.findFirst({
      where: { clientId: data.clientId, divisionCode: data.divisionCode, isPlaceholder: true },
    });
    if (placeholder) {
      record = await prisma.subBid.update({
        where: { id: placeholder.id },
        data: {
          contractorName: data.contractorName || null,
          amount: data.amount ?? null,
          notes: data.notes || null,
          fileUrl: data.fileUrl || null,
          fileName: data.fileName || null,
          status,
        },
      });
    } else {
      record = await prisma.subBid.create({
        data: {
          clientId: data.clientId,
          companyId: data.companyId,
          divisionCode: data.divisionCode,
          divisionName: data.divisionName,
          contractorName: data.contractorName || null,
          amount: data.amount ?? null,
          notes: data.notes || null,
          fileUrl: data.fileUrl || null,
          fileName: data.fileName || null,
          status,
          isPlaceholder: true,
        },
      });
    }
  }

  revalidatePath(`/${data.companyId}/clients/${data.clientId}`);
  return record;
}
