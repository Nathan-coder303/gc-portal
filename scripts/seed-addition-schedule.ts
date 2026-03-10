/**
 * One-time script: seed Addition template items + project schedule tasks
 * Run: cd /Users/mike/gc-portal && npx tsx scripts/seed-addition-schedule.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter } as never);

const TEMPLATE_ID = "cfIFTEwzAVp2d3sE";
const PROJECT_ID = "cmmij22j5000004l23lu9sq60";
const CREATED_BY = "cmmij16iq000104jmhjombezh"; // Mike Baruh

// Group IDs from the Addition template
const GROUPS = {
  generalTemp:   "c-rr1kxQqvYsNmQk", // General Requirements > Temporary Facilities
  foundation:    "cBSIyNujuHLw6n7I", // Concrete > Foundation
  roughFraming:  "cF7sjcamiecxV-yg", // Wood & Plastics > Rough Framing
  roofing:       "ccqkrKp7mZPR99yw", // Thermal & Moisture Protection > Roofing
  insulation:    "cYOBLAou6TOHJ0ew", // Thermal & Moisture Protection > Insulation
  plumbing:      "cP2HBYEkxg-77SA0", // Mechanical > Plumbing
  drywall:       "cf3ioRyAW88mXf80", // Finishes > Drywall
  tile:          "cMXYIcYivJidHlDM", // Finishes > Tile
};

async function main() {
  console.log("🔧 Adding template items...");

  // Get current sort orders for each group so we append after existing items
  const getMaxSort = async (groupId: string) => {
    const items = await prisma.estimateTemplateItem.findMany({
      where: { groupId, archivedAt: null },
      orderBy: { sortOrder: "desc" },
      take: 1,
    });
    return (items[0]?.sortOrder ?? 0) + 10;
  };

  const templateItems: Array<{
    name: string;
    groupId: string;
    divisionId?: string;
    unit?: string;
    sortOffset?: number;
  }> = [
    // Concrete > Foundation — sub-steps for footings and SOG
    { name: "Forming",                      groupId: GROUPS.foundation,   unit: "LS" },
    { name: "Footings Rebars Installation", groupId: GROUPS.foundation,   unit: "LS" },
    { name: "Footings Pouring Concrete",    groupId: GROUPS.foundation,   unit: "CY" },
    { name: "SOG Rebars Installation",      groupId: GROUPS.foundation,   unit: "LS" },
    { name: "SOG Pouring Concrete",         groupId: GROUPS.foundation,   unit: "CY" },
    // Wood & Plastics > Rough Framing
    { name: "Trusses Installation",         groupId: GROUPS.roughFraming,  unit: "LS" },
    // Thermal & Moisture Protection > Roofing
    { name: "Flat Roof Installation",       groupId: GROUPS.roofing,       unit: "SQ" },
    // Thermal & Moisture Protection > Insulation
    { name: "Roof Insulation",             groupId: GROUPS.insulation,     unit: "SF" },
    // Mechanical > Plumbing
    { name: "Plumbing Underground Installation", groupId: GROUPS.plumbing, unit: "LS" },
    // Finishes > Drywall
    { name: "Drywall Finishes Touch Ups",  groupId: GROUPS.drywall,        unit: "LS" },
    // Finishes > Tile
    { name: "Flooring Tiles",              groupId: GROUPS.tile,           unit: "SF" },
    // General Requirements > Temporary Facilities
    { name: "Final Cleaning",              groupId: GROUPS.generalTemp,    unit: "LS" },
  ];

  // Group items by groupId to assign sort orders
  const byGroup = new Map<string, typeof templateItems>();
  for (const item of templateItems) {
    const arr = byGroup.get(item.groupId) ?? [];
    arr.push(item);
    byGroup.set(item.groupId, arr);
  }

  for (const [groupId, items] of byGroup) {
    let sort = await getMaxSort(groupId);
    // Get the divisionId from the group
    const group = await prisma.estimateTemplateGroup.findUnique({ where: { id: groupId } });
    if (!group) { console.warn(`Group ${groupId} not found`); continue; }

    for (const item of items) {
      await prisma.estimateTemplateItem.create({
        data: {
          divisionId: group.divisionId,
          groupId,
          name: item.name,
          unit: item.unit ?? "LS",
          defaultQty: 1,
          defaultUnitCost: 0,
          defaultMarkupPct: 0,
          sortOrder: sort,
        },
      });
      console.log(`  ✓ Added to template: ${item.name}`);
      sort += 10;
    }
  }

  console.log("\n📅 Creating schedule tasks...");

  // Check if tasks already exist
  const existing = await prisma.task.count({ where: { projectId: PROJECT_ID } });
  if (existing > 0) {
    console.log(`  ⚠️  Project already has ${existing} tasks. Skipping task creation.`);
    console.log("     Delete existing tasks first if you want to recreate them.");
  } else {
    const tasks: Array<{ phase: string; name: string; isMilestone?: boolean }> = [
      // 1.1 Shell
      { phase: "Shell", name: "Demolition existing wood structure" },
      { phase: "Shell", name: "Excavation" },
      { phase: "Shell", name: "Forming" },
      { phase: "Shell", name: "Footings Rebars Installation" },
      { phase: "Shell", name: "Footings Inspection", isMilestone: true },
      { phase: "Shell", name: "Footings Pouring Concrete" },
      { phase: "Shell", name: "1st Lift Columns" },
      { phase: "Shell", name: "1st Lift Blocks" },
      { phase: "Shell", name: "SOG Rebars Installation" },
      { phase: "Shell", name: "SOG Inspection", isMilestone: true },
      { phase: "Shell", name: "SOG Pouring Concrete" },
      { phase: "Shell", name: "Tie Beam Rebars Installation" },
      { phase: "Shell", name: "Tie Beam Rebars Inspection", isMilestone: true },
      { phase: "Shell", name: "Tie Beam Pouring Concrete" },
      { phase: "Shell", name: "Trusses Installation" },
      { phase: "Shell", name: "Plywood Sheathing" },
      // 1.2 Plumbing
      { phase: "Plumbing", name: "Plumbing Underground Installation" },
      { phase: "Plumbing", name: "Plumbing Underground Inspection", isMilestone: true },
      { phase: "Plumbing", name: "Plumbing Rough Installation" },
      { phase: "Plumbing", name: "Plumbing Rough Inspection", isMilestone: true },
      { phase: "Plumbing", name: "Toilets Installation" },
      { phase: "Plumbing", name: "Vanity Installation" },
      { phase: "Plumbing", name: "Bathtub Installation" },
      { phase: "Plumbing", name: "Plumbing Final Inspection", isMilestone: true },
      // 1.3 Electrical
      { phase: "Electrical", name: "Electrical Underground" },
      { phase: "Electrical", name: "Electrical Rough" },
      { phase: "Electrical", name: "Electrical Rough Inspection", isMilestone: true },
      { phase: "Electrical", name: "Electrical Trims and Outlets" },
      { phase: "Electrical", name: "Electrical Final Inspection", isMilestone: true },
      // 1.4 Roof
      { phase: "Roof", name: "Flat Roof Installation" },
      { phase: "Roof", name: "Flat Roof Final Inspection", isMilestone: true },
      // 1.5 Windows Installation
      { phase: "Windows Installation", name: "Windows Installation" },
      { phase: "Windows Installation", name: "Windows Inspection", isMilestone: true },
      // 1.6 Drywall
      { phase: "Drywall", name: "Wall Insulation" },
      { phase: "Drywall", name: "Roof Insulation" },
      { phase: "Drywall", name: "Insulation Inspection", isMilestone: true },
      { phase: "Drywall", name: "Framing Installation" },
      { phase: "Drywall", name: "Framing Inspection", isMilestone: true },
      { phase: "Drywall", name: "Drywall Hanging" },
      { phase: "Drywall", name: "Drywall Inspection", isMilestone: true },
      { phase: "Drywall", name: "Drywall Finish" },
      { phase: "Drywall", name: "Drywall Finishes Touch Ups" },
      { phase: "Drywall", name: "Ceilings Paint" },
      { phase: "Drywall", name: "Wall Paint" },
      // 1.7 Tiles
      { phase: "Tiles", name: "Flooring Tiles" },
      { phase: "Tiles", name: "Bathroom Wall Tiles" },
      // 1.8 Fine Carpentry
      { phase: "Fine Carpentry", name: "Baseboards Installation" },
      { phase: "Fine Carpentry", name: "Doors Installation" },
      { phase: "Fine Carpentry", name: "Doors Casings Installation" },
      // 1.9–1.10 Exterior
      { phase: "Exterior", name: "Stucco" },
      { phase: "Exterior", name: "Exterior Paint" },
      // 1.11 HVAC
      { phase: "HVAC", name: "HVAC Ducts Installation" },
      { phase: "HVAC", name: "HVAC Rough Inspection", isMilestone: true },
      { phase: "HVAC", name: "HVAC Mini Split Installation" },
      { phase: "HVAC", name: "HVAC Final Inspection", isMilestone: true },
      // Closeout
      { phase: "Closeout", name: "Final Cleaning" },
      { phase: "Closeout", name: "Building Final Inspection", isMilestone: true },
      { phase: "Closeout", name: "Architect's Delay" },
      // Delays
      { phase: "Delays", name: "Framing Inspection Delay" },
    ];

    for (const t of tasks) {
      await prisma.task.create({
        data: {
          projectId: PROJECT_ID,
          phase: t.phase,
          name: t.name,
          durationDays: 1,
          isMilestone: t.isMilestone ?? false,
          status: "NOT_STARTED",
          percentComplete: 0,
          predecessorIds: [],
          createdBy: CREATED_BY,
        },
      });
      console.log(`  ✓ Task: [${t.phase}] ${t.name}${t.isMilestone ? " 🏁" : ""}`);
    }
  }

  console.log("\n✅ Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
