import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const results = await prisma.estimateTemplate.findMany({
    where: {
      OR: [
        { estimateNumber: "2660" },
        { name: { contains: "2660" } },
      ]
    },
    select: { id: true, name: true, estimateNumber: true, clientId: true, archivedAt: true, signedAt: true, updatedAt: true }
  });
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
