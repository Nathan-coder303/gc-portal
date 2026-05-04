import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });

const LEAD_ID = "cmoqkkko20000wqiak0cx1svl";
const FOLLOWUP_ID = "cmoqkkndy0001wqia85a23wcr";
const MIBH = "cmmij161r000004jm8il8bd0e";

async function main() {
  await prisma.lead.update({ where: { id: LEAD_ID }, data: { companyId: MIBH } });
  await prisma.followUp.update({ where: { id: FOLLOWUP_ID }, data: { companyId: MIBH } });
  console.log("Fixed: Inorel Nicolas and appointment moved to MIBH Construction LLC");
}
main().catch(console.error).finally(() => prisma.$disconnect());
