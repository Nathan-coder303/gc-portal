import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    const templates = await prisma.estimateTemplate.findMany({
      where: { companyId: company.id },
      orderBy: { sortOrder: "asc" },
    });
    console.log(`\nCompany: ${company.id} — ${company.name}`);
    console.log("Templates:", templates.map(t => `${t.name} (type=${t.type}, archived=${t.archivedAt ? "YES" : "no"})`));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
