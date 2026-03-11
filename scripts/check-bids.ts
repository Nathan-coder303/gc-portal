import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const client = await prisma.client.findFirst({
    where: { name: { contains: "Avi", mode: "insensitive" } },
  });
  if (!client) { console.log("No client found matching 'Avi'"); return; }
  console.log("Client:", client.name, client.id);

  const bids = await prisma.subBid.findMany({
    where: { clientId: client.id, isPlaceholder: false },
    orderBy: { divisionCode: "asc" },
  });
  console.log(`\n${bids.length} real bids:`);
  for (const b of bids) {
    console.log(`  Div ${b.divisionCode} | ${(b.contractorName ?? "(no name)").padEnd(35)} | amount=${String(b.amount ?? "NULL").padEnd(10)} | ${b.emailSource?.slice(0, 50) ?? "manual"}`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
