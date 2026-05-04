import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const bids = await prisma.subBid.findMany({
    where: { companyId: "cmmij161r000004jm8il8bd0e", isPlaceholder: false, contractorName: { not: null } },
    select: { contractorName: true, sourceLabel: true, emailSource: true, projectId: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const labels = new Set(bids.map(b => b.sourceLabel));
  console.log("Unique sourceLabels:", [...labels]);
  console.log("\nSample bids:");
  for (const b of bids.slice(0, 20)) {
    console.log(`  ${b.contractorName} | src=${b.sourceLabel ?? "—"} | email=${b.emailSource ?? "—"}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
