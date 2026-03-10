"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { STANDARD_DIVISIONS } from "@/lib/divisions";

// Ensure all 14 division records exist for a client (idempotent)
export async function initClientSubBids(clientId: string, companyId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  for (const div of STANDARD_DIVISIONS) {
    await prisma.subBid.upsert({
      where: { clientId_divisionCode: { clientId, divisionCode: div.code } },
      create: { clientId, companyId, divisionCode: div.code, divisionName: div.name, status: "MISSING" },
      update: {},
    });
  }
  revalidatePath(`/${companyId}/clients/${clientId}`);
}

export async function upsertSubBid(data: {
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

  const record = await prisma.subBid.upsert({
    where: { clientId_divisionCode: { clientId: data.clientId, divisionCode: data.divisionCode } },
    create: {
      clientId: data.clientId,
      companyId: data.companyId,
      divisionCode: data.divisionCode,
      divisionName: data.divisionName,
      contractorName: data.contractorName || null,
      amount: data.amount ?? null,
      notes: data.notes || null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      status: data.status || (data.amount ? "RECEIVED" : "MISSING"),
    },
    update: {
      contractorName: data.contractorName || null,
      amount: data.amount ?? null,
      notes: data.notes || null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      status: data.status || (data.amount ? "RECEIVED" : "MISSING"),
    },
  });

  revalidatePath(`/${data.companyId}/clients/${data.clientId}`);
  return record;
}
