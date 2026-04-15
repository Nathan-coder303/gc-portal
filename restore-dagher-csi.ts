import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_ECRqBeG76wQJ@ep-little-lab-aie98v1x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Map: item ID → CSI code (standard MasterFormat sections)
const CSI_MAP: Record<string, string> = {
  // 03 00 00 — Concrete (corrections: structural items → 03 31 00, pump truck → 03 05 00)
  "cmnynf7lq000g04l24h7t1hp7": "03 31 00", // Concrete Footings & Grade Beams
  "cmnynf7ly000k04l2y4gumuxj": "03 31 00", // Concrete Tie Beams
  "cmnynf7m1000l04l2z8voy8sn": "03 31 00", // Concrete Stair
  "cmnynf7m8000o04l2kuy2lfbo": "03 05 00", // Concrete Pump Truck
  "cmnynf7lu000i04l2v31fq9wc": "03 31 00", // 2nd Floor 8" Concrete Structural Slab
  "cmnynf7lw000j04l2i0t3eg0h": "03 31 00", // Cast-in-Place Concrete Columns

  // 09 00 00 — Finishes — Drywall
  "cmnynf7qs001x04l2kz9o6gph": "09 29 00", // 5/8" Type-X Gypsum Board
  "cmnynf7qv001y04l2v2ab2s4g": "09 29 00", // Level 4 Drywall Finish / Skim Coat

  // 09 00 00 — Finishes — Flooring
  "cmnynf7rc002104l2242rd3qc": "09 30 00", // Porcelain Tile Flooring — Ground Floor
  "cmnynf7ri002204l2ur2vbdru": "09 30 00", // Porcelain Tile Flooring — Second Floor
  "cmnynf7rk002304l2gof7bvyh": "09 30 00", // Tile — Bathroom & Wet Area

  // 09 00 00 — Finishes — Paint
  "cmnynf7qx001z04l29xh8a601": "09 90 00", // Interior Paint
  "cmnynf7r9002004l22cht2zf3": "09 90 00", // Exterior Paint

  // 26 00 00 — Electrical — Rough
  "cmnynf7u4002v04l27ys8n1y5": "26 24 00", // 350A Service Entrance, Meter Socket & Main Disconnect
  "cmnynf7uf002w04l244vziogb": "26 24 16", // Panel A — 200A Main House Panel
  "cmnynf7ux002x04l22p797hwe": "26 24 16", // Panel B — 100A Cabana / Inlaw Panel
  "cmnynf7v8003104l2yamyzo1r": "26 27 26", // EV Charger Level 2 — NEMA 14-50
  "cmnynf7va003204l2xc0vddum": "26 05 33", // Smoke & Carbon Monoxide Detectors

  // 26 00 00 — Electrical — Finish
  "cmnynf7v0002y04l2xxde3als": "26 27 00", // Branch Circuit Wiring, Devices & Plates
  "cmnynf7v2002z04l28p8rrc9h": "26 51 00", // Interior Lighting Fixtures
  "cmnynf7v4003004l2z86v53mq": "26 56 00", // Exterior LED Lighting
};

async function main() {
  let updated = 0;

  for (const [id, csiCode] of Object.entries(CSI_MAP)) {
    const item = await prisma.estimateTemplateItem.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!item) {
      console.log(`  NOT FOUND: ${id}`);
      continue;
    }
    await prisma.estimateTemplateItem.update({
      where: { id },
      data: { csiCode },
    });
    console.log(`  SET ${csiCode}  →  ${item.name}`);
    updated++;
  }

  console.log(`\nDone: ${updated} items updated`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
