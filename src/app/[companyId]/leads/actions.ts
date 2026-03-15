"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteLead(leadId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.lead.delete({ where: { id: leadId } });
  revalidatePath(`/${session.user.companyId}/leads`);
  revalidatePath(`/${session.user.companyId}/today`);
  return { success: true };
}
