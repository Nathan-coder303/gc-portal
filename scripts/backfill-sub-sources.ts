import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
const COMPANY_ID = "cmmij161r000004jm8il8bd0e";

type NotesData = { t?: string[]; d?: unknown[]; src?: string };
function parseNotes(raw: string | null): NotesData {
  if (!raw) return {};
  try { const p = JSON.parse(raw); return (p && typeof p === "object" && !Array.isArray(p)) ? p as NotesData : {}; } catch { return {}; }
}

async function main() {
  // Get all bids with a sourceLabel
  const bids = await prisma.subBid.findMany({
    where: { companyId: COMPANY_ID, isPlaceholder: false, contractorName: { not: null }, sourceLabel: { not: null } },
    select: { contractorName: true, divisionCode: true, sourceLabel: true },
  });

  // Build name -> best sourceLabel (prefer Excel labels over null)
  const nameToSource = new Map<string, string>();
  for (const bid of bids) {
    if (!bid.contractorName || !bid.sourceLabel) continue;
    nameToSource.set(bid.contractorName.toLowerCase(), bid.sourceLabel);
  }

  const subs = await prisma.subContractor.findMany({ where: { companyId: COMPANY_ID } });
  let updated = 0;

  for (const sub of subs) {
    const bidSrc = nameToSource.get(sub.name.toLowerCase());
    const nd = parseNotes(sub.notes);

    // If current src is already "Manual" or "Email..." and bid has Excel source, prefer bid source
    if (!bidSrc) continue; // Only update subs that have a bid source

    const currentSrc = nd.src ?? "";
    // Don't overwrite Email/PlanHub sourced subs that already have a more specific email label
    if (currentSrc.startsWith("Email ")) continue;

    nd.src = bidSrc;
    await prisma.subContractor.update({ where: { id: sub.id }, data: { notes: JSON.stringify(nd) } });
    console.log(`✓ ${sub.name} → ${bidSrc}`);
    updated++;
  }
  console.log(`\nBackfilled ${updated} subs with bid sourceLabel.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
