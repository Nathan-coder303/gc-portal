import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const leads = await prisma.lead.findMany({
    where: { OR: [{ name: { contains: "Nicolas", mode: "insensitive" } }, { name: { contains: "Inorel", mode: "insensitive" } }] },
  });
  console.log("Leads:", JSON.stringify(leads, null, 2));
  const followups = await prisma.followUp.findMany({
    where: { leadId: { in: leads.map(l => l.id) } },
  });
  console.log("FollowUps:", JSON.stringify(followups, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
