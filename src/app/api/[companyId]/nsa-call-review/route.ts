/**
 * POST /api/[companyId]/nsa-call-review
 * Reviews all existing NSA leads and creates "To Call ASAP" pipeline cards
 * for any that contain "call" in the subject or message and don't already
 * have a TO_CALL_ASAP card.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find all NSA leads (from NSA sender or subject)
  const nsaLeads = await prisma.lead.findMany({
    where: {
      companyId: params.companyId,
      OR: [
        { emailFrom: { contains: "emailings.mibhconstruction", mode: "insensitive" } },
        { emailSubject: { contains: "NSA", mode: "insensitive" } },
      ],
    },
    include: { pipelineCard: { select: { id: true, stage: true } } },
  });

  let created = 0;
  let skipped = 0;

  for (const lead of nsaLeads) {
    const searchText = `${lead.emailSubject ?? ""} ${lead.message ?? ""}`;
    const hasCall = /\bcall\b/i.test(searchText);
    if (!hasCall) { skipped++; continue; }

    // Already has a TO_CALL_ASAP card
    if (lead.pipelineCard?.stage === "TO_CALL_ASAP") { skipped++; continue; }

    const receivedAt = lead.receivedAt ?? new Date();
    const receivedLabel = receivedAt.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
    const noteContent = `📞 Call requested via NSA email — received ${receivedLabel}`;

    if (lead.pipelineCard) {
      // Update existing card stage to TO_CALL_ASAP
      await prisma.pipelineCard.update({
        where: { id: lead.pipelineCard.id },
        data: { stage: "TO_CALL_ASAP", source: "NSA" },
      });
    } else {
      // Create new pipeline card
      await prisma.pipelineCard.create({
        data: {
          companyId: params.companyId,
          displayName: lead.name ?? "NSA Lead",
          leadId: lead.id,
          stage: "TO_CALL_ASAP",
          source: "NSA",
          notes: noteContent,
          pipelineType: "sales",
        },
      });
    }

    // Add a note with the date/time if one doesn't already exist
    const existingCallNote = await prisma.note.findFirst({
      where: { leadId: lead.id, content: { contains: "Call requested via NSA" } },
    });
    if (!existingCallNote) {
      await prisma.note.create({
        data: {
          companyId: params.companyId,
          leadId: lead.id,
          content: noteContent,
          noteDate: receivedAt,
        },
      });
    }

    created++;
  }

  return NextResponse.json({ reviewed: nsaLeads.length, created, skipped });
}
