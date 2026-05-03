import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type BidRow = {
  notes: string | null;
  emailSource: string | null;
  sourceLabel: string | null;
  fileUrl: string | null;
};

function deriveSourceLabel(bid: BidRow): string {
  if (bid.sourceLabel) return `Excel ${bid.sourceLabel}`;
  const src = bid.emailSource ?? "";
  const url = bid.fileUrl ?? "";
  const planHubMatch = src.match(/^NEW Bid Proposal\s*[-–]\s*([^:]+):/i);
  if (planHubMatch) return `Email ${planHubMatch[1].trim()}`;
  const followUpMatch = src.match(/our bid on [""]([^""]+)[""]/i);
  if (followUpMatch) return `Email ${followUpMatch[1].trim()}`;
  const numMatch = src.match(/\b(\d{4})\b/);
  if (numMatch) return `Email ${numMatch[1]}`;
  if (url.startsWith("gmail:") || /gmail|google/i.test(src) || src) return "Email";
  return "Manual";
}

function parseNotesData(notes: string | null): Record<string, unknown> {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) return { t: parsed };
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {}
  return {};
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [subs, bids] = await Promise.all([
    prisma.subContractor.findMany({
      where: { companyId: params.companyId },
      select: { id: true, email: true, notes: true },
    }),
    prisma.subBid.findMany({
      where: { companyId: params.companyId },
      select: { notes: true, emailSource: true, sourceLabel: true, fileUrl: true },
    }),
  ]);

  // Build email → best source label map from all bids
  const emailToSource = new Map<string, string>();
  for (const bid of bids) {
    if (!bid.notes) continue;
    const parts = bid.notes.split(" | ");
    const bidEmail = parts[1]?.trim().toLowerCase();
    if (!bidEmail || !bidEmail.includes("@")) continue;
    const label = deriveSourceLabel(bid);
    const existing = emailToSource.get(bidEmail);
    // Prefer more specific labels over generic "Email" or "Manual"
    if (!existing || existing === "Manual" || (existing === "Email" && label !== "Manual")) {
      emailToSource.set(bidEmail, label);
    }
  }

  let updated = 0;
  for (const sub of subs) {
    const notesData = parseNotesData(sub.notes);
    if (notesData.src) continue; // already tagged

    const email = sub.email?.toLowerCase().trim();
    const srcLabel = email && emailToSource.has(email) ? emailToSource.get(email)! : "Manual";

    const newNotesData: Record<string, unknown> = { ...notesData, src: srcLabel };
    // Clean up empty arrays
    if (Array.isArray(newNotesData.t) && (newNotesData.t as unknown[]).length === 0) delete newNotesData.t;
    if (Array.isArray(newNotesData.d) && (newNotesData.d as unknown[]).length === 0) delete newNotesData.d;

    await prisma.subContractor.update({
      where: { id: sub.id },
      data: { notes: JSON.stringify(newNotesData) },
    });
    updated++;
  }

  return NextResponse.json({ updated });
}
