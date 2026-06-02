import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as never);
  const db = prisma as any;

  // Division IDs from estimate 2659
  const DIV = {
    d02: "cmp77tpwy000d04jo327moaie", // 02 Existing Conditions / Demolition
    d03: "cmp77tpx4000f04jo9d24lbjp", // 03 Concrete
    d04: "cmp77tq4m003204jo31dlqsii", // 04 Masonry
    d05: "cmp77tq4y003804jo24rj0oba", // 05 Metals
    d07: "cmp77tq18001b04jo3s5i98t7", // 07 Thermal & Moisture
    d08: "cmp77tq1z001o04jorw2ghpbo", // 08 Openings
    d09: "cmp77tq2g001w04johvm59ldc", // 09 Finishes
    d12: "cmp77tq51003904jos33fdtrv", // 12 Furnishings (Casework)
    d22: "cmp77tq58003d04joqdlwbtq0", // 22 Plumbing
    d23: "cmp77tq3p002k04jo386yc9ef", // 23 Mechanical
    d26: "cmp77tq47002u04jo6xarhcaa", // 26 Electrical
  };

  type Item = {
    name: string; csiCode: string; unit: string;
    defaultQty: number; defaultUnitCost: number; notes?: string;
  };

  async function addItems(divisionId: string, startSort: number, items: Item[]) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.estimateTemplateItem.create({
        data: {
          divisionId,
          name: it.name,
          csiCode: it.csiCode,
          unit: it.unit,
          defaultQty: it.defaultQty,
          defaultUnitCost: it.defaultUnitCost,
          defaultMarkupPct: 0,
          notes: it.notes ?? null,
          visibleInPdf: true,
          sortOrder: startSort + i * 10,
        },
      });
    }
    console.log(`  ✓ ${items.length} items added to div ${divisionId}`);
  }

  // ── 02 DEMOLITION (existing item at sortOrder 0, new start at 10)
  console.log("02 Demolition...");
  await addItems(DIV.d02, 10, [
    { name: "Selective demo — porch flooring/slab",     csiCode: "02 41 13", unit: "SF",  defaultQty: 220,  defaultUnitCost: 8.00,    notes: "Floor elevation leveling required" },
    { name: "Selective demo — porch walls/enclosure",   csiCode: "02 41 13", unit: "SF",  defaultQty: 150,  defaultUnitCost: 6.00,    notes: "Remove existing tie beam and wall sections" },
    { name: "Remove existing doors at porch",           csiCode: "02 41 19", unit: "EA",  defaultQty: 2,    defaultUnitCost: 150.00 },
    { name: "Remove existing stucco at porch perimeter",csiCode: "02 41 13", unit: "SF",  defaultQty: 180,  defaultUnitCost: 4.50 },
    { name: "Remove existing A/C compressor",           csiCode: "02 41 19", unit: "EA",  defaultQty: 1,    defaultUnitCost: 450.00,  notes: "Existing unit to be replaced" },
    { name: "Remove existing air handler",              csiCode: "02 41 19", unit: "EA",  defaultQty: 1,    defaultUnitCost: 350.00,  notes: "Existing AHU to be replaced" },
    { name: "Remove cast iron sanitary pipe",           csiCode: "02 41 19", unit: "LF",  defaultQty: 22,   defaultUnitCost: 35.00,   notes: "Replace with SCH. 40 PVC" },
    { name: "Debris removal and disposal",              csiCode: "01 74 13", unit: "CY",  defaultQty: 8,    defaultUnitCost: 185.00 },
    { name: "Site protection/cleanup",                  csiCode: "01 50 00", unit: "LS",  defaultQty: 1,    defaultUnitCost: 1200.00 },
  ]);

  // ── 03 CONCRETE
  console.log("03 Concrete...");
  await addItems(DIV.d03, 10, [
    { name: "Concrete pedestal — 16x16",            csiCode: "03 30 00", unit: "EA",  defaultQty: 2,    defaultUnitCost: 850.00,  notes: "5,000 PSI, below new porch landing" },
    { name: "New concrete tie beam",                csiCode: "03 30 00", unit: "LF",  defaultQty: 37,   defaultUnitCost: 125.00,  notes: "#4 ties, #5 bars" },
    { name: "New concrete cap — 8x8",               csiCode: "03 30 00", unit: "LF",  defaultQty: 12,   defaultUnitCost: 85.00,   notes: "Two #5 continuous" },
    { name: "New 6\" concrete slab landing",         csiCode: "03 30 00", unit: "SF",  defaultQty: 48,   defaultUnitCost: 28.00,   notes: "5,000 PSI, #8 each way centered" },
    { name: "Concrete fill at masonry cells",        csiCode: "03 30 00", unit: "CY",  defaultQty: 4,    defaultUnitCost: 425.00,  notes: "3,000 PSI grout in CBS cells" },
    { name: "Formwork — tie beams and caps",         csiCode: "03 10 00", unit: "LS",  defaultQty: 1,    defaultUnitCost: 1850.00 },
  ]);

  // ── 04 MASONRY (existing items end at sortOrder 50)
  console.log("04 Masonry...");
  await addItems(DIV.d04, 60, [
    { name: "8\" CBS masonry wall — porch enclosure",    csiCode: "04 22 00", unit: "SF",  defaultQty: 370,  defaultUnitCost: 32.00,   notes: "Grade N-2, 1,900 PSI, Type M mortar" },
    { name: "Drill/epoxy #5 rebar — existing masonry",   csiCode: "03 21 00", unit: "EA",  defaultQty: 40,   defaultUnitCost: 45.00,   notes: "@ 24\" OC" },
    { name: "Drill/epoxy #4 rebar — existing masonry",   csiCode: "03 21 00", unit: "EA",  defaultQty: 19,   defaultUnitCost: 38.00,   notes: "@ 24\" OC typical" },
    { name: "Wire reinforcement — 9 GA DUR-O-WAL",       csiCode: "04 05 19", unit: "LF",  defaultQty: 185,  defaultUnitCost: 4.50 },
  ]);

  // ── 05 METALS (framing & hardware)
  console.log("05 Metals...");
  await addItems(DIV.d05, 10, [
    { name: "Metal floor joists — 2x8x18 GA",          csiCode: "05 40 00", unit: "LF",  defaultQty: 220,  defaultUnitCost: 18.00,   notes: "New porch floor @ 12\" OC" },
    { name: "Metal track — 2x8x14 GA continuous",      csiCode: "05 40 00", unit: "LF",  defaultQty: 37,   defaultUnitCost: 14.00,   notes: "Perimeter, screws @ 12\" OC" },
    { name: "Composed beam — two 2x8x14 GA",           csiCode: "05 40 00", unit: "LF",  defaultQty: 12,   defaultUnitCost: 28.00,   notes: "At porch floor framing" },
    { name: "Metal stud framing — 3-5/8\" 25 GA",       csiCode: "05 40 00", unit: "SF",  defaultQty: 250,  defaultUnitCost: 6.50,    notes: "Non-bearing walls" },
    { name: "Metal stud framing — 20 GA cabinet walls", csiCode: "05 40 00", unit: "SF",  defaultQty: 270,  defaultUnitCost: 7.50,    notes: "Heavier gauge for cabinet support" },
    { name: "Simpson RCKW 5.5 connectors",             csiCode: "05 50 00", unit: "EA",  defaultQty: 10,   defaultUnitCost: 65.00,   notes: "At metal girder connections" },
    { name: "Simpson Titen HD anchors — 1/2x4\"",       csiCode: "05 50 00", unit: "EA",  defaultQty: 10,   defaultUnitCost: 28.00,   notes: "3-1/2\" embedment" },
    { name: "Tapcons and misc hardware",                csiCode: "05 50 00", unit: "LS",  defaultQty: 1,    defaultUnitCost: 450.00 },
  ]);

  // ── 07 THERMAL & MOISTURE PROTECTION
  console.log("07 Building Envelope...");
  await addItems(DIV.d07, 10, [
    { name: "Exterior plywood sheathing — 1/2\"",        csiCode: "07 25 00", unit: "SF",  defaultQty: 520,  defaultUnitCost: 4.50,    notes: "At new metal stud exterior walls" },
    { name: "Paper-back metal lath",                    csiCode: "07 25 00", unit: "SF",  defaultQty: 520,  defaultUnitCost: 3.25,    notes: "Over plywood sheathing" },
    { name: "Smooth stucco finish — 3/4\"",              csiCode: "09 24 00", unit: "SF",  defaultQty: 520,  defaultUnitCost: 8.50,    notes: "Exterior, to match existing" },
    { name: "Waterproof membrane/moisture barrier",      csiCode: "07 19 00", unit: "SF",  defaultQty: 520,  defaultUnitCost: 2.25,    notes: "Continuous on all exterior walls" },
    { name: "Batt insulation — R-19",                   csiCode: "07 21 00", unit: "SF",  defaultQty: 520,  defaultUnitCost: 2.85,    notes: "Exterior walls" },
    { name: "Batt insulation — R-4.1",                  csiCode: "07 21 00", unit: "SF",  defaultQty: 250,  defaultUnitCost: 1.45,    notes: "Interior walls where shown" },
    { name: "New soffit — along windows",               csiCode: "09 26 00", unit: "LF",  defaultQty: 32,   defaultUnitCost: 85.00,   notes: "For blackout shades, with electrical outlets" },
    { name: "Caulking/sealant — silicone",              csiCode: "07 92 00", unit: "LF",  defaultQty: 180,  defaultUnitCost: 4.50,    notes: "Around all openings, pipes, conduit" },
    { name: "Flashing — galvanized",                    csiCode: "07 62 00", unit: "LF",  defaultQty: 85,   defaultUnitCost: 12.00 },
  ]);

  // ── 08 OPENINGS
  console.log("08 Openings...");
  await addItems(DIV.d08, 10, [
    { name: "Impact fixed window Type 1 — 64\"x8'-0\"",                csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 4200.00, notes: "MR Glass MG5000, Zone 4, FL# 27000-R3" },
    { name: "Impact casement window Type 2 — 53\"x50\" (egress)",      csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 3800.00, notes: "MR Glass MG600, Zone 4, FL# 29676-R2" },
    { name: "Impact fixed window Type 3 — 49\"x8'-0\"",                csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 3950.00, notes: "MR Glass MG5000, Zone 4, FL# 27000-R3" },
    { name: "Impact fixed window Type 4 — 49\"x8'-0\"",                csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 4100.00, notes: "MR Glass MG5000, Zone 5, FL# 27000-R3" },
    { name: "Impact fixed window Type 5 — 4'-0\"x5'-0\"",              csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 2850.00, notes: "MR Glass MG450, Zone 4, FL# 40676-R2" },
    { name: "Impact casement window Type 6 — 3'-2\"x5'-0\" (egress)",  csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 2650.00, notes: "MR Glass MG600, Zone 5, FL# 29676-R2" },
    { name: "Impact fixed window Type 7 — 4'-0\"x2'-11\"",             csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 1850.00, notes: "MR Glass MG450, Zone 4, FL# 40676-R2" },
    { name: "Impact fixed window Type 8 — 3'-2\"x2'-11\"",             csiCode: "08 51 13", unit: "EA", defaultQty: 1, defaultUnitCost: 1650.00, notes: "MR Glass MG450, Zone 5, FL# 40676-R2" },
    { name: "Window mullions (D1, E1, E2)",                            csiCode: "08 51 13", unit: "EA", defaultQty: 4, defaultUnitCost: 285.00,  notes: "MR Glass, Zone 4/5" },
    { name: "Impact French door — 4'-0\"x8'-0\"",                      csiCode: "08 14 33", unit: "EA", defaultQty: 1, defaultUnitCost: 5850.00, notes: "MR Glass MG3000, FL# 26942.2" },
    { name: "Interior wood door — 2'-10\"x6'-8\"",                     csiCode: "08 14 00", unit: "EA", defaultQty: 2, defaultUnitCost: 485.00,  notes: "Paint grade, right swing in" },
    { name: "Interior door frames — wood",                             csiCode: "08 21 13", unit: "EA", defaultQty: 2, defaultUnitCost: 185.00,  notes: "Paint grade" },
    { name: "Door hardware — Kwikset Milan Lever",                     csiCode: "08 71 00", unit: "EA", defaultQty: 3, defaultUnitCost: 125.00,  notes: "Model #2259647, no locks" },
  ]);

  // ── 09 FINISHES
  console.log("09 Finishes...");
  await addItems(DIV.d09, 10, [
    { name: "1/2\" drywall — walls, living room",              csiCode: "09 29 00", unit: "SF",   defaultQty: 480,  defaultUnitCost: 3.25,  notes: "Painted" },
    { name: "1/2\" drywall — walls, kitchen",                  csiCode: "09 29 00", unit: "SF",   defaultQty: 420,  defaultUnitCost: 3.25,  notes: "Painted" },
    { name: "1/2\" drywall — walls, bedroom",                  csiCode: "09 29 00", unit: "SF",   defaultQty: 320,  defaultUnitCost: 3.25,  notes: "Painted" },
    { name: "1/2\" drywall — walls, hallway",                  csiCode: "09 29 00", unit: "SF",   defaultQty: 180,  defaultUnitCost: 3.25,  notes: "Painted" },
    { name: "1/2\" drywall — walls, sitting area",             csiCode: "09 29 00", unit: "SF",   defaultQty: 240,  defaultUnitCost: 3.50,  notes: "Over 1\"x2\" P.T. strips at raised area" },
    { name: "1/2\" drywall — ceiling, living room",            csiCode: "09 29 00", unit: "SF",   defaultQty: 285,  defaultUnitCost: 3.75,  notes: "10'-0\" ceiling height" },
    { name: "1/2\" drywall — ceiling, kitchen",                csiCode: "09 29 00", unit: "SF",   defaultQty: 245,  defaultUnitCost: 3.75,  notes: "10'-0\" ceiling height" },
    { name: "1/2\" drywall — ceiling, bedroom",                csiCode: "09 29 00", unit: "SF",   defaultQty: 165,  defaultUnitCost: 3.75,  notes: "8'-4\" ceiling height" },
    { name: "1/2\" drywall — ceiling, hallway",                csiCode: "09 29 00", unit: "SF",   defaultQty: 85,   defaultUnitCost: 3.75,  notes: "8'-4\" ceiling height" },
    { name: "Drywall tape and mud — all surfaces",             csiCode: "09 29 00", unit: "SF",   defaultQty: 2420, defaultUnitCost: 0.85 },
    { name: "Interior paint — walls (primer + 2 coats)",       csiCode: "09 91 00", unit: "SF",   defaultQty: 1640, defaultUnitCost: 2.25 },
    { name: "Interior paint — ceilings (primer + 2 coats)",    csiCode: "09 91 00", unit: "SF",   defaultQty: 780,  defaultUnitCost: 2.00 },
    { name: "Stone flooring installation — living room",        csiCode: "09 30 00", unit: "SF",   defaultQty: 285,  defaultUnitCost: 8.50,  notes: "Owner selection" },
    { name: "Stone flooring installation — kitchen",            csiCode: "09 30 00", unit: "SF",   defaultQty: 245,  defaultUnitCost: 8.50,  notes: "Owner selection" },
    { name: "Stone flooring installation — bedroom",            csiCode: "09 30 00", unit: "SF",   defaultQty: 165,  defaultUnitCost: 8.50,  notes: "Owner selection" },
    { name: "Stone flooring installation — hallway",            csiCode: "09 30 00", unit: "SF",   defaultQty: 85,   defaultUnitCost: 8.50,  notes: "Owner selection" },
    { name: "6\" wood baseboard — all rooms",                  csiCode: "09 65 16", unit: "LF",   defaultQty: 245,  defaultUnitCost: 6.50,  notes: "Paint grade, owner selection" },
    { name: "Tile window sills — 1x4\"",                       csiCode: "09 30 13", unit: "LF",   defaultQty: 48,   defaultUnitCost: 12.00, notes: "By owner" },
  ]);

  // ── 12 FURNISHINGS (Casework)
  console.log("12 Casework...");
  await addItems(DIV.d12, 10, [
    { name: "Kitchen base cabinet installation",    csiCode: "12 36 00", unit: "LF",  defaultQty: 36.5, defaultUnitCost: 65.00,  notes: "Cabinets by owner, install labor" },
    { name: "Kitchen upper cabinet installation",   csiCode: "12 36 00", unit: "LF",  defaultQty: 13,   defaultUnitCost: 55.00,  notes: "Cabinets by owner, install labor" },
    { name: "Kitchen island/peninsula installation",csiCode: "12 36 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 850.00, notes: "By owner, install labor" },
    { name: "Countertop installation",              csiCode: "12 36 00", unit: "SF",  defaultQty: 87,   defaultUnitCost: 12.00,  notes: "By owner, install labor" },
    { name: "Under cabinet LED tape light",         csiCode: "26 51 00", unit: "LF",  defaultQty: 13,   defaultUnitCost: 18.00,  notes: "3 watts, by owner" },
  ]);

  // ── 22 PLUMBING
  console.log("22 Plumbing...");
  await addItems(DIV.d22, 10, [
    { name: "Kitchen sink — rough-in",              csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 650.00,  notes: "2\" waste, 1/2\" HW/CW" },
    { name: "Kitchen sink — trim out",              csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 285.00,  notes: "Chrome P-trap, angle stops, supplies" },
    { name: "Hand sink — rough-in",                 csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 550.00,  notes: "2\" waste, 1/2\" HW/CW" },
    { name: "Hand sink — trim out",                 csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 245.00,  notes: "Chrome trim" },
    { name: "Dishwasher connection",                csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 285.00,  notes: "6.5 gal/cycle max" },
    { name: "Refrigerator ice maker line",          csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 185.00,  notes: "CW connection" },
    { name: "3\" PVC sanitary line — kitchen",      csiCode: "22 13 00", unit: "LF",  defaultQty: 22,   defaultUnitCost: 45.00,   notes: "SCH. 40 PVC, 1/8\"/ft slope" },
    { name: "2\" AAV — kitchen",                    csiCode: "22 13 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 125.00,  notes: "Air admittance valve" },
    { name: "Copper domestic water supply",         csiCode: "22 11 00", unit: "LF",  defaultQty: 35,   defaultUnitCost: 32.00,   notes: "HW & CW, connect to existing" },
    { name: "Gas pipe — polypipe underground",      csiCode: "22 11 19", unit: "LF",  defaultQty: 13.5, defaultUnitCost: 28.00,   notes: "18\" UG" },
    { name: "Gas pipe — metallic riser/connection", csiCode: "22 11 19", unit: "LF",  defaultQty: 7,    defaultUnitCost: 42.00,   notes: "To gas range" },
    { name: "Kitchen faucet installation",          csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 165.00 },
    { name: "Hand sink faucet installation",        csiCode: "22 40 00", unit: "EA",  defaultQty: 1,    defaultUnitCost: 145.00 },
  ]);

  // ── 23 HVAC
  console.log("23 HVAC...");
  await addItems(DIV.d23, 10, [
    { name: "New condenser — Goodman GSXC1603610",         csiCode: "23 81 00", unit: "EA",  defaultQty: 1,  defaultUnitCost: 3850.00, notes: "34,000 BTUH, 16 SEER" },
    { name: "New air handler — ASPT37C14A + TXV",          csiCode: "23 73 00", unit: "EA",  defaultQty: 1,  defaultUnitCost: 2450.00, notes: "Suspended at ceiling" },
    { name: "Rigid ductwork — insulated R-8",              csiCode: "23 31 00", unit: "LF",  defaultQty: 86, defaultUnitCost: 38.00,   notes: "Supply, 16\"x10\" and 12\"x10\"" },
    { name: "Supply vents — 24\"x6\" sidewall",             csiCode: "23 37 13", unit: "EA",  defaultQty: 4,  defaultUnitCost: 85.00,   notes: "220-250 CFM" },
    { name: "Supply vents — 14\"x6\" sidewall",             csiCode: "23 37 13", unit: "EA",  defaultQty: 4,  defaultUnitCost: 75.00,   notes: "120 CFM each" },
    { name: "Supply vents — 16\"x6\" sidewall",             csiCode: "23 37 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 78.00 },
    { name: "Supply vents — 6\"x6\" one-way",               csiCode: "23 37 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 55.00,   notes: "49 CFM" },
    { name: "Return air grille — 24\"x24\"",                csiCode: "23 37 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 125.00,  notes: "Living room" },
    { name: "Return air grille — 12\"x12\" new",            csiCode: "23 37 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 85.00,   notes: "Bedroom, 12\" AFF" },
    { name: "Kitchen exhaust hood with fan",               csiCode: "23 38 00", unit: "EA",  defaultQty: 1,  defaultUnitCost: 850.00,  notes: "400-600 CFM" },
    { name: "Exhaust duct — 8\" 26 GA GMD",                 csiCode: "23 38 00", unit: "LF",  defaultQty: 4,  defaultUnitCost: 45.00,   notes: "Hood to wall, with cap/damper" },
    { name: "Refrigerant line set — insulated",            csiCode: "23 81 00", unit: "EA",  defaultQty: 1,  defaultUnitCost: 485.00,  notes: "New, to new CU" },
    { name: "Condensate drain — 2\" PVC primary",           csiCode: "23 23 00", unit: "LF",  defaultQty: 15, defaultUnitCost: 18.00,   notes: "Insulated, to existing drain" },
    { name: "Condensate drain — 3/4\" PVC secondary",       csiCode: "23 23 00", unit: "LF",  defaultQty: 8,  defaultUnitCost: 15.00,   notes: "Emergency pan with switch" },
    { name: "Thermostat — programmable",                   csiCode: "23 09 23", unit: "EA",  defaultQty: 1,  defaultUnitCost: 285.00 },
    { name: "HVAC startup and commissioning",              csiCode: "23 05 00", unit: "LS",  defaultQty: 1,  defaultUnitCost: 650.00 },
  ]);

  // ── 26 ELECTRICAL
  console.log("26 Electrical...");
  await addItems(DIV.d26, 10, [
    { name: "200A main disconnect switch",                      csiCode: "26 24 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 1250.00, notes: "Exterior, Square D type QO" },
    { name: "200A meter",                                       csiCode: "26 24 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 450.00,  notes: "Exterior" },
    { name: "200A 20/40 circuit panel",                         csiCode: "26 24 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 1850.00, notes: "Exterior at main panel" },
    { name: "Ground rod with #4 AWG CU",                        csiCode: "26 05 26", unit: "EA",  defaultQty: 1,  defaultUnitCost: 285.00,  notes: "At panel" },
    { name: "Surge protection device",                          csiCode: "26 05 26", unit: "EA",  defaultQty: 1,  defaultUnitCost: 385.00,  notes: "At panel" },
    { name: "Service conductors — #2/0 AWG CU in 2\" PVC",      csiCode: "26 05 33", unit: "EA",  defaultQty: 1,  defaultUnitCost: 650.00,  notes: "Meter to panel" },
    { name: "15A lighting circuits (AFCI)",                     csiCode: "26 27 26", unit: "EA",  defaultQty: 4,  defaultUnitCost: 285.00,  notes: "#14 wire" },
    { name: "20A receptacle circuits (AFCI)",                   csiCode: "26 27 26", unit: "EA",  defaultQty: 14, defaultUnitCost: 325.00,  notes: "#12 wire" },
    { name: "20A GFCI circuits",                                csiCode: "26 27 26", unit: "EA",  defaultQty: 5,  defaultUnitCost: 365.00,  notes: "#12 wire" },
    { name: "30A water heater circuit (2-pole)",                 csiCode: "26 27 26", unit: "EA",  defaultQty: 1,  defaultUnitCost: 485.00,  notes: "#10 wire, 240V" },
    { name: "A/C circuits (2-pole)",                            csiCode: "26 27 26", unit: "EA",  defaultQty: 4,  defaultUnitCost: 425.00,  notes: "20-30A, #10-#12" },
    { name: "AHU disconnect — 2P-60A NEMA 3R",                  csiCode: "26 29 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 285.00,  notes: "Exterior at main panel" },
    { name: "A/C disconnect — 2P-60A NEMA 1",                   csiCode: "26 29 13", unit: "EA",  defaultQty: 1,  defaultUnitCost: 245.00,  notes: "At AHU location" },
    { name: "Standard duplex receptacles (AFCI)",               csiCode: "26 27 26", unit: "EA",  defaultQty: 16, defaultUnitCost: 95.00 },
    { name: "GFCI receptacles",                                 csiCode: "26 27 26", unit: "EA",  defaultQty: 11, defaultUnitCost: 125.00,  notes: "Kitchen counters, near sinks" },
    { name: "Weatherproof GFI receptacle",                      csiCode: "26 27 26", unit: "EA",  defaultQty: 1,  defaultUnitCost: 165.00,  notes: "Exterior" },
    { name: "Range outlet — 240V",                              csiCode: "26 27 26", unit: "EA",  defaultQty: 1,  defaultUnitCost: 285.00,  notes: "Kitchen" },
    { name: "Refrigerator outlet — GFCI",                       csiCode: "26 27 26", unit: "EA",  defaultQty: 1,  defaultUnitCost: 125.00,  notes: "Kitchen" },
    { name: "Single pole switches",                             csiCode: "26 27 13", unit: "EA",  defaultQty: 3,  defaultUnitCost: 65.00 },
    { name: "Dimmer switches",                                  csiCode: "26 27 13", unit: "EA",  defaultQty: 26, defaultUnitCost: 85.00 },
    { name: "Recessed LED downlights — kitchen",                csiCode: "26 51 00", unit: "EA",  defaultQty: 14, defaultUnitCost: 145.00 },
    { name: "Recessed LED downlights — dining",                 csiCode: "26 51 00", unit: "EA",  defaultQty: 5,  defaultUnitCost: 145.00 },
    { name: "Recessed LED downlights — living",                 csiCode: "26 51 00", unit: "EA",  defaultQty: 8,  defaultUnitCost: 145.00 },
    { name: "Recessed LED downlights — sitting",                csiCode: "26 51 00", unit: "EA",  defaultQty: 2,  defaultUnitCost: 145.00 },
    { name: "Ceiling fan with light",                           csiCode: "26 51 00", unit: "EA",  defaultQty: 4,  defaultUnitCost: 385.00 },
    { name: "Under cabinet LED lighting",                       csiCode: "26 51 00", unit: "LF",  defaultQty: 12, defaultUnitCost: 28.00 },
    { name: "Pendant/column light",                             csiCode: "26 51 00", unit: "EA",  defaultQty: 1,  defaultUnitCost: 285.00 },
    { name: "Smoke detector (interconnected)",                  csiCode: "28 31 11", unit: "EA",  defaultQty: 2,  defaultUnitCost: 145.00 },
    { name: "Smoke/CO combo detector",                          csiCode: "28 31 11", unit: "EA",  defaultQty: 2,  defaultUnitCost: 185.00 },
    { name: "Television outlet",                                csiCode: "27 15 00", unit: "EA",  defaultQty: 2,  defaultUnitCost: 125.00,  notes: "Sitting area, bedroom" },
  ]);

  console.log("\n✅ All items inserted.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
