import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const NEON_URL = "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const subs = await prisma.subContractor.findMany({
    where: { companyId: "cmmij161r000004jm8il8bd0e" },
    orderBy: { name: "asc" },
    take: 10,
    select: { name: true, notes: true },
  });
  for (const s of subs) console.log(`${s.name}: ${s.notes}`);
  const total = await prisma.subContractor.count({ where: { companyId: "cmmij161r000004jm8il8bd0e" } });
  const withSrc = await prisma.subContractor.count({ where: { companyId: "cmmij161r000004jm8il8bd0e", notes: { contains: "src" } } });
  console.log(`\nTotal: ${total}, with src: ${withSrc}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
