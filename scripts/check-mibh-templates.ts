import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const templates = await prisma.estimateTemplate.findMany({
    where: { 
      companyId: "cmmij161r000004jm8il8bd0e",
      type: "TEMPLATE"
    },
    include: {
      divisions: {
        include: {
          groups: {
            include: { items: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" }
          },
          items: { orderBy: { sortOrder: "asc" } },
        },
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: { sortOrder: "asc" }
  });

  for (const t of templates) {
    console.log(`\n=== TEMPLATE: ${t.name} (${t.id}) ===`);
    for (const div of t.divisions) {
      console.log(`  DIV: ${div.name}`);
      for (const grp of div.groups) {
        console.log(`    GROUP: ${grp.name}`);
        for (const item of grp.items) {
          console.log(`      ITEM: ${item.name} | qty=${item.qty} ${item.unit} | unit=$${item.unitCost}`);
        }
      }
      for (const item of div.items) {
        console.log(`    UNGROUPED ITEM: ${item.name} | qty=${item.qty} ${item.unit} | unit=$${item.unitCost}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
