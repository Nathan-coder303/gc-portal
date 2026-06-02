import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as never);

  const t = await (prisma as any).estimateTemplate.findFirst({
    where: { estimateNumber: "2659" },
    include: {
      divisions: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: { where: { archivedAt: null, groupId: null }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!t) { console.log("NOT FOUND"); process.exit(1); }

  console.log(JSON.stringify({
    id: t.id, name: t.name, companyId: t.companyId,
    divisions: t.divisions.map((d: any) => ({
      id: d.id, csiCode: d.csiCode, name: d.name,
      items: d.items.map((i: any) => ({
        id: i.id, name: i.name, csiCode: i.csiCode, sortOrder: i.sortOrder,
        qty: Number(i.defaultQty), cost: Number(i.defaultUnitCost),
      })),
    })),
  }, null, 2));

  await (prisma as any).$disconnect();
}

main().catch(console.error);
