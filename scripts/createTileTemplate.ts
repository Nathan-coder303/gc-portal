import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const MIBH_COMPANY_ID = "cmmij161r000004jm8il8bd0e";
const MIBH_USER_ID = "cmmij16iq000104jmhjombezh"; // mikebaruh@gmail.com

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as never);

  try {
    // Create the estimate template
    const template = await prisma.estimateTemplate.create({
      data: {
        name: "Tile Roof Replacement",
        companyId: MIBH_COMPANY_ID,
        createdBy: MIBH_USER_ID,
      },
    });
    console.log("Created template:", template.id);

    const divisions = [
      {
        csiCode: "01",
        name: "General Conditions",
        sortOrder: 0,
        items: [
          { name: "Mobilization / Setup", detail: "Crew, equipment, trailer setup", csiCode: "01 71 00", defaultQty: 1, unit: "LS", defaultUnitCost: 450, defaultMarkupPct: 15, sortOrder: 0 },
          { name: "Temporary Protection", detail: "Tarps, plywood, interior furniture protection", csiCode: "01 50 00", defaultQty: 1, unit: "LS", defaultUnitCost: 350, defaultMarkupPct: 15, sortOrder: 1 },
          { name: "Job Site Cleanup", detail: "Daily cleanup and final broom sweep", csiCode: "01 74 00", defaultQty: 1, unit: "LS", defaultUnitCost: 300, defaultMarkupPct: 15, sortOrder: 2 },
          { name: "Debris Removal / Dump Fees", detail: "Roll-off dumpster or haul-away of old tile and debris", csiCode: "01 74 19", defaultQty: 1, unit: "LS", defaultUnitCost: 650, defaultMarkupPct: 15, sortOrder: 3 },
          { name: "Permit", detail: "Building permit — roofing", csiCode: "01 41 00", defaultQty: 1, unit: "LS", defaultUnitCost: 500, defaultMarkupPct: 0, sortOrder: 4 },
        ],
      },
      {
        csiCode: "02",
        name: "Existing Conditions",
        sortOrder: 1,
        items: [
          { name: "Tile Removal", detail: "Remove and dispose of existing concrete or clay roof tiles", csiCode: "02 41 16", defaultQty: 0, unit: "SQ", defaultUnitCost: 85, defaultMarkupPct: 20, sortOrder: 0 },
          { name: "Remove Existing Underlayment", detail: "Strip old felt or single-ply underlayment from deck", csiCode: "02 41 16", defaultQty: 0, unit: "SQ", defaultUnitCost: 18, defaultMarkupPct: 20, sortOrder: 1 },
          { name: "Remove Existing Drip Edge", detail: "Pull and discard old aluminum drip edge (eave and rake)", csiCode: "02 41 16", defaultQty: 0, unit: "LF", defaultUnitCost: 1.5, defaultMarkupPct: 20, sortOrder: 2 },
          { name: "Remove Existing Valley Metal", detail: "Pull and discard old valley flashing", csiCode: "02 41 16", defaultQty: 0, unit: "LF", defaultUnitCost: 2.5, defaultMarkupPct: 20, sortOrder: 3 },
          { name: "Remove Existing Flashing at Walls / Penetrations", detail: "Remove step, counter, and chimney flashing as needed", csiCode: "02 41 16", defaultQty: 0, unit: "LF", defaultUnitCost: 3.0, defaultMarkupPct: 20, sortOrder: 4 },
        ],
      },
      {
        csiCode: "06",
        name: "Wood & Carpentry",
        sortOrder: 2,
        items: [
          { name: "Deck Inspection & Re-Nail", detail: "Inspect plywood/OSB deck; re-nail all panels to code (8d @ 6\" o.c.)", csiCode: "06 10 00", defaultQty: 0, unit: "SQ", defaultUnitCost: 22, defaultMarkupPct: 20, sortOrder: 0 },
          { name: "Plywood Deck Replacement — 5/8\" CDX", detail: "Replace damaged or rotted deck sheathing, 5/8\" CDX plywood", csiCode: "06 16 00", defaultQty: 0, unit: "SF", defaultUnitCost: 4.25, defaultMarkupPct: 20, sortOrder: 1 },
          { name: "1x6 T&G Decking Replacement", detail: "Replace damaged tongue-and-groove boards (older homes)", csiCode: "06 16 00", defaultQty: 0, unit: "LF", defaultUnitCost: 6.5, defaultMarkupPct: 20, sortOrder: 2 },
          { name: "Fascia Board Replacement — 1x8", detail: "Replace rotted fascia with painted or primed 1x8 wood", csiCode: "06 20 00", defaultQty: 0, unit: "LF", defaultUnitCost: 8.5, defaultMarkupPct: 20, sortOrder: 3 },
          { name: "Barge Board / Rake Board Replacement", detail: "Replace rotted barge/rake boards", csiCode: "06 20 00", defaultQty: 0, unit: "LF", defaultUnitCost: 9.0, defaultMarkupPct: 20, sortOrder: 4 },
          { name: "Furring Strips (Battens) — 1x2", detail: "Install horizontal tile battens over underlayment per code", csiCode: "06 10 00", defaultQty: 0, unit: "SQ", defaultUnitCost: 38, defaultMarkupPct: 20, sortOrder: 5 },
        ],
      },
      {
        csiCode: "07",
        name: "Thermal & Moisture Protection",
        sortOrder: 3,
        items: [
          { name: "Drip Edge — Aluminum (Eave)", detail: "Install new aluminum drip edge at eaves, 2\" x 2\" minimum", csiCode: "07 71 00", defaultQty: 0, unit: "LF", defaultUnitCost: 2.25, defaultMarkupPct: 20, sortOrder: 0 },
          { name: "Drip Edge — Aluminum (Rake)", detail: "Install new aluminum drip edge at rakes", csiCode: "07 71 00", defaultQty: 0, unit: "LF", defaultUnitCost: 2.25, defaultMarkupPct: 20, sortOrder: 1 },
          { name: "Ice & Water Shield — Eaves / Low Slope", detail: "Self-adhered membrane at eaves, valleys, and areas < 4:12", csiCode: "07 27 00", defaultQty: 0, unit: "SQ", defaultUnitCost: 85, defaultMarkupPct: 20, sortOrder: 2 },
          { name: "Underlayment — 30 lb. Felt", detail: "Install #30 felt underlayment over full deck", csiCode: "07 31 00", defaultQty: 0, unit: "SQ", defaultUnitCost: 32, defaultMarkupPct: 20, sortOrder: 3 },
          { name: "Underlayment — Titanium UDL-30 (Synthetic)", detail: "Install synthetic non-woven underlayment (code-approved alternative)", csiCode: "07 31 00", defaultQty: 0, unit: "SQ", defaultUnitCost: 52, defaultMarkupPct: 20, sortOrder: 4 },
          { name: "Underlayment — Polyglass PolyGlass FR (Self-Adhered)", detail: "Full-coverage self-adhered modified bitumen underlayment for tile", csiCode: "07 27 00", defaultQty: 0, unit: "SQ", defaultUnitCost: 95, defaultMarkupPct: 20, sortOrder: 5 },
          { name: "Valley Metal — 24 ga. Galvanized (Open Valley)", detail: "Install W-style or V-style metal valley flashing, 24 ga.", csiCode: "07 62 00", defaultQty: 0, unit: "LF", defaultUnitCost: 7.5, defaultMarkupPct: 20, sortOrder: 6 },
          { name: "Step Flashing at Walls", detail: "Install aluminum or galvanized step flashing at vertical walls", csiCode: "07 62 00", defaultQty: 0, unit: "LF", defaultUnitCost: 8.5, defaultMarkupPct: 20, sortOrder: 7 },
          { name: "Counter Flashing / Reglet at Walls", detail: "Install counter flashing over step flashing at stucco or masonry walls", csiCode: "07 62 00", defaultQty: 0, unit: "LF", defaultUnitCost: 9.0, defaultMarkupPct: 20, sortOrder: 8 },
          { name: "Chimney Flashing — Complete Set", detail: "Install base, counter, saddle, and cap flashing at chimney", csiCode: "07 62 00", defaultQty: 0, unit: "EA", defaultUnitCost: 650, defaultMarkupPct: 20, sortOrder: 9 },
          { name: "Skylight Flashing Kit", detail: "Install manufacturer skylight flashing kit", csiCode: "07 62 00", defaultQty: 0, unit: "EA", defaultUnitCost: 450, defaultMarkupPct: 20, sortOrder: 10 },
          { name: "Pipe Jack Flashing — Aluminum", detail: "Install aluminum pipe boot/jack at plumbing penetrations", csiCode: "07 62 00", defaultQty: 0, unit: "EA", defaultUnitCost: 55, defaultMarkupPct: 20, sortOrder: 11 },
          { name: "Concrete Tile — S-Profile (Supply & Install)", detail: "Concrete S-profile tile, installed over battens with foam adhesive at hips/ridges", csiCode: "07 32 14", defaultQty: 0, unit: "SQ", defaultUnitCost: 420, defaultMarkupPct: 20, sortOrder: 12 },
          { name: "Concrete Tile — Flat / Low-Profile (Supply & Install)", detail: "Flat concrete tile, installed over battens", csiCode: "07 32 14", defaultQty: 0, unit: "SQ", defaultUnitCost: 395, defaultMarkupPct: 20, sortOrder: 13 },
          { name: "Clay Tile — Barrel (Supply & Install)", detail: "Traditional clay barrel/mission tile, installed with foam adhesive", csiCode: "07 32 13", defaultQty: 0, unit: "SQ", defaultUnitCost: 580, defaultMarkupPct: 20, sortOrder: 14 },
          { name: "Clay Tile — Flat (Supply & Install)", detail: "Flat clay roof tile, installed over battens", csiCode: "07 32 13", defaultQty: 0, unit: "SQ", defaultUnitCost: 520, defaultMarkupPct: 20, sortOrder: 15 },
          { name: "Hip & Ridge Tile", detail: "Install hip and ridge cap tiles with two-part polyurethane foam adhesive", csiCode: "07 32 14", defaultQty: 0, unit: "LF", defaultUnitCost: 18.5, defaultMarkupPct: 20, sortOrder: 16 },
          { name: "Rake / Barge Tile", detail: "Install rake-end tiles along gable edges", csiCode: "07 32 14", defaultQty: 0, unit: "LF", defaultUnitCost: 16.0, defaultMarkupPct: 20, sortOrder: 17 },
          { name: "Tile Foam Adhesive (Two-Part Polyurethane)", detail: "Supply polyurethane foam adhesive for hip, ridge, and rake tile bedding", csiCode: "07 32 14", defaultQty: 0, unit: "KIT", defaultUnitCost: 85, defaultMarkupPct: 20, sortOrder: 18 },
          { name: "Mortar / Bedding at Hips & Ridges", detail: "Mortar bed under ridge and hip cap tiles (alternative to foam)", csiCode: "07 32 14", defaultQty: 0, unit: "LF", defaultUnitCost: 12.0, defaultMarkupPct: 20, sortOrder: 19 },
          { name: "Eave Closure / Bird Stop", detail: "Install aluminum or tile eave closure to seal bottom course", csiCode: "07 32 14", defaultQty: 0, unit: "LF", defaultUnitCost: 4.5, defaultMarkupPct: 20, sortOrder: 20 },
          { name: "Ridge Vent — Mortar Ridge (Closed)", detail: "Install closed ridge with mortar — no ventilation", csiCode: "07 32 14", defaultQty: 0, unit: "LF", defaultUnitCost: 14.0, defaultMarkupPct: 20, sortOrder: 21 },
          { name: "Attic Ventilation — Tile Vents (In-Deck)", detail: "Install tile vent units in field of roof for attic ventilation", csiCode: "07 72 00", defaultQty: 0, unit: "EA", defaultUnitCost: 65, defaultMarkupPct: 20, sortOrder: 22 },
          { name: "Attic Ventilation — Box Vents", detail: "Install box vents cut through deck and tile", csiCode: "07 72 00", defaultQty: 0, unit: "EA", defaultUnitCost: 85, defaultMarkupPct: 20, sortOrder: 23 },
          { name: "Power Attic Ventilator", detail: "Install solar or electric power attic ventilator with tile curb", csiCode: "07 72 00", defaultQty: 0, unit: "EA", defaultUnitCost: 425, defaultMarkupPct: 20, sortOrder: 24 },
        ],
      },
      {
        csiCode: "09",
        name: "Finishes",
        sortOrder: 4,
        items: [
          { name: "Stucco Repair at Wall / Flashing", detail: "Patch and re-stucco around counter flashing after install", csiCode: "09 24 00", defaultQty: 0, unit: "LF", defaultUnitCost: 12.0, defaultMarkupPct: 20, sortOrder: 0 },
          { name: "Caulking / Sealant at Penetrations", detail: "Paintable urethane caulk at all pipe boots, vents, and edges", csiCode: "09 90 00", defaultQty: 0, unit: "LF", defaultUnitCost: 3.5, defaultMarkupPct: 20, sortOrder: 1 },
          { name: "Paint — Touch-Up Fascia & Trim", detail: "Spot paint fascia and trim affected by work", csiCode: "09 91 00", defaultQty: 0, unit: "LS", defaultUnitCost: 250, defaultMarkupPct: 20, sortOrder: 2 },
        ],
      },
      {
        csiCode: "22",
        name: "Plumbing",
        sortOrder: 5,
        items: [
          { name: "Lead Pipe Boot / Flashing", detail: "Install lead boot flashing around plumbing stack penetrations", csiCode: "22 10 00", defaultQty: 0, unit: "EA", defaultUnitCost: 95, defaultMarkupPct: 20, sortOrder: 0 },
          { name: "Pipe Stack Flashing — Aluminum (3\" or 4\")", detail: "Aluminum pipe flashing for standard drain and vent stacks", csiCode: "22 10 00", defaultQty: 0, unit: "EA", defaultUnitCost: 65, defaultMarkupPct: 20, sortOrder: 1 },
          { name: "A/C Condensate Line Penetration", detail: "Flash and seal A/C condensate line through tile roof", csiCode: "22 10 00", defaultQty: 0, unit: "EA", defaultUnitCost: 75, defaultMarkupPct: 20, sortOrder: 2 },
        ],
      },
    ];

    for (const div of divisions) {
      const createdDiv = await prisma.estimateTemplateDivision.create({
        data: {
          templateId: template.id,
          csiCode: div.csiCode,
          name: div.name,
          sortOrder: div.sortOrder as number,
        },
      });
      console.log(`  Created division: ${div.csiCode} - ${div.name}`);

      for (const item of div.items) {
        await prisma.estimateTemplateItem.create({
          data: {
            divisionId: createdDiv.id,
            name: item.name,
            detail: item.detail,
            csiCode: item.csiCode,
            defaultQty: item.defaultQty,
            unit: item.unit,
            defaultUnitCost: item.defaultUnitCost,
            defaultMarkupPct: item.defaultMarkupPct,
            sortOrder: item.sortOrder,
          },
        });
      }
      console.log(`    Added ${div.items.length} items`);
    }

    console.log("\nDone! Tile Roof Replacement template created for MIBH.");
    console.log("Template ID:", template.id);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
