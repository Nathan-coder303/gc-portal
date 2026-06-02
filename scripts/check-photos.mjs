import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
const { Pool } = pkg;
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require" });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const client = await prisma.client.findFirst({
  where: { name: { contains: "Carolina" } },
  select: { id: true, name: true, portalShowDailyPhotos: true },
});
console.log("Client:", JSON.stringify(client));

if (client) {
  const logs = await prisma.dailyLog.findMany({
    where: { clientId: client.id },
    select: { id: true, arrivalDate: true, attachments: true },
    orderBy: { arrivalDate: "desc" },
    take: 5,
  });
  console.log("Daily logs:", logs.length);
  for (const log of logs) {
    const atts = log.attachments ? JSON.parse(log.attachments) : [];
    const images = atts.filter(a => a.mimeType && a.mimeType.startsWith("image/"));
    console.log(" ", log.arrivalDate.toISOString().slice(0,10), "- total attachments:", atts.length, "- images:", images.length);
    if (images.length) images.forEach(a => console.log("    image:", a.name, a.mimeType));
  }
}

await prisma.$disconnect();
await pool.end();
