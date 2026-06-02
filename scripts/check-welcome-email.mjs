import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
const { Pool } = pkg;
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require" });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const emails = await prisma.clientEmail.findMany({
  where: { context: "welcome" },
  orderBy: { sentAt: "desc" },
  take: 3,
  select: { to: true, subject: true, body: true, sentAt: true, client: { select: { name: true } } },
});
console.log(JSON.stringify(emails, null, 2));
await prisma.$disconnect();
await pool.end();
