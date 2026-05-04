import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
const MIBH = "cmmij161r000004jm8il8bd0e";
async function main() {
  const lead = await prisma.lead.findUnique({ where: { id: "cmoqkkko20000wqiak0cx1svl" } });
  console.log("Lead:", JSON.stringify(lead, null, 2));
  const fu = await prisma.followUp.findUnique({ where: { id: "cmoqkkndy0001wqia85a23wcr" } });
  console.log("FollowUp:", JSON.stringify(fu, null, 2));
  // Also check what category/dueDate format real appointments use
  const sample = await prisma.followUp.findFirst({
    where: { companyId: MIBH, category: "APPOINTMENT" },
  });
  console.log("\nSample APPOINTMENT in MIBH:", JSON.stringify(sample, null, 2));
  // Check all categories
  const cats = await prisma.followUp.findMany({
    where: { companyId: MIBH },
    select: { category: true },
    distinct: ["category"],
  });
  console.log("All categories in MIBH:", cats.map(c => c.category));
}
main().catch(console.error).finally(() => prisma.$disconnect());
