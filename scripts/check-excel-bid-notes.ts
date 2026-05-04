import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const bids = await prisma.subBid.findMany({
    where: { companyId: "cmmij161r000004jm8il8bd0e", sourceLabel: { in: ["Excel 1240", "Excel Ingraham"] }, isPlaceholder: false, contractorName: { not: null } },
    select: { contractorName: true, sourceLabel: true, notes: true, emailSource: true },
    orderBy: { sourceLabel: "asc" },
  });
  console.log(`Total Excel bids: ${bids.length}`);
  const withNotes = bids.filter(b => b.notes && b.notes.trim());
  console.log(`With notes: ${withNotes.length}`);
  for (const b of withNotes) {
    console.log(`\n[${b.sourceLabel}] ${b.contractorName}`);
    console.log(`  notes: ${b.notes}`);
  }
  console.log("\n--- Without notes ---");
  for (const b of bids.filter(b => !b.notes || !b.notes.trim())) {
    console.log(`[${b.sourceLabel}] ${b.contractorName} | email: ${b.emailSource ?? "—"}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
