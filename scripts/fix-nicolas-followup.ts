import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const NEON_URL = process.env.DATABASE_URL!;

const adapter = new PrismaPg({ connectionString: NEON_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const FOLLOWUP_ID = "cmoqkkndy0001wqia85a23wcr";

  const existing = await prisma.followUp.findUnique({ where: { id: FOLLOWUP_ID } });
  if (!existing) { console.log("FollowUp not found"); return; }

  console.log("Before:", { category: existing.category, text: existing.text });

  const newText = existing.text?.startsWith("📅 ") ? existing.text : `📅 ${existing.text}`;

  await prisma.followUp.update({
    where: { id: FOLLOWUP_ID },
    data: { category: "TASK", text: newText },
  });

  console.log("After:", { category: "TASK", text: newText });
}

main().catch(console.error).finally(() => prisma.$disconnect());
