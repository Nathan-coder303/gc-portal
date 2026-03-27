/**
 * One-time backfill: create Note records for existing leads that have a
 * message field but no corresponding note yet.
 *
 * Run: npx tsx scripts/backfill-lead-notes.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all leads with a message that don't already have a note
  const leads = await prisma.lead.findMany({
    where: { message: { not: null } },
    select: { id: true, companyId: true, message: true, receivedAt: true },
  });

  const existingNotes = await prisma.note.findMany({
    where: { leadId: { not: null } },
    select: { leadId: true },
  });
  const leadsWithNote = new Set(existingNotes.map((n) => n.leadId!));

  const toBackfill = leads.filter((l) => !leadsWithNote.has(l.id));
  console.log(`Found ${leads.length} leads with messages, ${toBackfill.length} need notes created.`);

  let created = 0;
  for (const lead of toBackfill) {
    await prisma.note.create({
      data: {
        companyId: lead.companyId,
        leadId: lead.id,
        content: lead.message!,
        noteDate: lead.receivedAt,
      },
    });
    created++;
    if (created % 10 === 0) process.stdout.write(`  ${created}/${toBackfill.length}...\n`);
  }

  console.log(`Done. Created ${created} notes.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
