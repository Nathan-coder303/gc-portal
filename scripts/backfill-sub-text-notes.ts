import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
const COMPANY_ID = "cmmij161r000004jm8il8bd0e";

type NotesData = { t?: string[]; d?: unknown[]; src?: string; text?: string };
function parseNotes(raw: string | null): NotesData {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    return (p && typeof p === "object" && !Array.isArray(p)) ? p as NotesData : {};
  } catch { return {}; }
}

async function main() {
  // All Excel bids with notes (contact info line)
  const bids = await prisma.subBid.findMany({
    where: {
      companyId: COMPANY_ID,
      sourceLabel: { in: ["Excel 1240", "Excel Ingraham"] },
      isPlaceholder: false,
      contractorName: { not: null },
      notes: { not: null },
    },
    select: { contractorName: true, notes: true, sourceLabel: true },
  });

  // Build best-notes map: name → notes text (prefer non-empty)
  const nameToNotes = new Map<string, string>();
  for (const bid of bids) {
    if (!bid.contractorName || !bid.notes?.trim()) continue;
    nameToNotes.set(bid.contractorName.toLowerCase(), bid.notes.trim());
  }

  const subs = await prisma.subContractor.findMany({ where: { companyId: COMPANY_ID } });
  let updated = 0, skipped = 0;

  for (const sub of subs) {
    const bidNotes = nameToNotes.get(sub.name.toLowerCase());
    if (!bidNotes) { skipped++; continue; }

    const nd = parseNotes(sub.notes);
    // Don't overwrite existing user-typed text
    if (nd.text?.trim()) { skipped++; continue; }

    nd.text = bidNotes;
    await prisma.subContractor.update({ where: { id: sub.id }, data: { notes: JSON.stringify(nd) } });
    console.log(`✓ ${sub.name} → ${bidNotes}`);
    updated++;
  }
  console.log(`\nDone. Updated ${updated} subs, skipped ${skipped}.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
