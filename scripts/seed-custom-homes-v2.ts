/**
 * One-time script: insert "Custom Homes V2" schedule template into prod DB.
 * Run: npx tsx scripts/seed-custom-homes-v2.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const COMPANY_ID = "cmmij161r000004jm8il8bd0e"; // MIBH CONSTRUCTION LLC

// offsetDays = calendar days from Jun 1, 2026 (project start)
// durationDays = stated week count × 5 (Mon-Fri work days)
const TASKS = [
  // ─── Phase 1 ────────────────────────────────────────────────────────────────
  { phase: "01 — Preconstruction, Mobilization & Long-Lead Procurement", name: "Permit issuance / Notice to Proceed", durationDays: 0, offsetDays: 0, isMilestone: true, trade: null },
  { phase: "01 — Preconstruction, Mobilization & Long-Lead Procurement", name: "Mobilization, site fence, port-o-let, dumpster", durationDays: 5, offsetDays: 0, isMilestone: false, trade: "General" },
  { phase: "01 — Preconstruction, Mobilization & Long-Lead Procurement", name: "Long-lead order: oversized impact windows", durationDays: 5, offsetDays: 0, isMilestone: false, trade: "Windows" },
  { phase: "01 — Preconstruction, Mobilization & Long-Lead Procurement", name: "Long-lead order: HVAC equipment, electrical panel", durationDays: 10, offsetDays: 0, isMilestone: false, trade: "HVAC" },
  { phase: "01 — Preconstruction, Mobilization & Long-Lead Procurement", name: "FPL coordination — overhead service line removal", durationDays: 30, offsetDays: 0, isMilestone: false, trade: "Electrical" },
  { phase: "01 — Preconstruction, Mobilization & Long-Lead Procurement", name: "Tree removal permit & arborist coordination", durationDays: 10, offsetDays: 0, isMilestone: false, trade: "Site" },

  // ─── Phase 2 ────────────────────────────────────────────────────────────────
  { phase: "02 — Site Preparation & Demolition", name: "SWPPP install, silt fence, tree protection", durationDays: 5, offsetDays: 0, isMilestone: false, trade: "Site" },
  { phase: "02 — Site Preparation & Demolition", name: "Tree removal & site clearing", durationDays: 5, offsetDays: 7, isMilestone: false, trade: "Site" },
  { phase: "02 — Site Preparation & Demolition", name: "Survey: layout & corner staking", durationDays: 5, offsetDays: 7, isMilestone: false, trade: "Survey" },
  { phase: "02 — Site Preparation & Demolition", name: "Earthwork — rough grading & compacted fill", durationDays: 10, offsetDays: 14, isMilestone: false, trade: "Earthwork" },
  { phase: "02 — Site Preparation & Demolition", name: "FBC termite pretreatment", durationDays: 5, offsetDays: 21, isMilestone: false, trade: "Termite" },

  // ─── Phase 3 ────────────────────────────────────────────────────────────────
  { phase: "03 — Foundation & Underground", name: "Footing excavation (spread, continuous, grade beams)", durationDays: 5, offsetDays: 28, isMilestone: false, trade: "Excavation" },
  { phase: "03 — Foundation & Underground", name: "Footing reinforcement & formwork", durationDays: 5, offsetDays: 28, isMilestone: false, trade: "Concrete" },
  { phase: "03 — Foundation & Underground", name: "Underground plumbing rough-in (DWV)", durationDays: 10, offsetDays: 28, isMilestone: false, trade: "Plumbing" },
  { phase: "03 — Foundation & Underground", name: "Underground electrical conduit, EV rough-in", durationDays: 5, offsetDays: 35, isMilestone: false, trade: "Electrical" },
  { phase: "03 — Foundation & Underground", name: "Footing pour & inspection", durationDays: 5, offsetDays: 35, isMilestone: false, trade: "Concrete" },
  { phase: "03 — Foundation & Underground", name: "Compacted fill, vapor barrier, WWM", durationDays: 5, offsetDays: 42, isMilestone: false, trade: "Concrete" },
  { phase: "03 — Foundation & Underground", name: "Slab-on-grade pour (1,414 SF) & cure", durationDays: 10, offsetDays: 49, isMilestone: false, trade: "Concrete" },
  { phase: "03 — Foundation & Underground", name: "Foundation inspection — MILESTONE", durationDays: 0, offsetDays: 56, isMilestone: true, trade: null },

  // ─── Phase 4 ────────────────────────────────────────────────────────────────
  { phase: "04 — Ground Floor Structure", name: "Ground floor CMU walls — exterior (8\" reinforced)", durationDays: 20, offsetDays: 63, isMilestone: false, trade: "Masonry" },
  { phase: "04 — Ground Floor Structure", name: "Ground floor CMU partitions & In-Law demising wall", durationDays: 15, offsetDays: 70, isMilestone: false, trade: "Masonry" },
  { phase: "04 — Ground Floor Structure", name: "Tie columns (TC1–TC10) & embeds", durationDays: 10, offsetDays: 77, isMilestone: false, trade: "Concrete" },
  { phase: "04 — Ground Floor Structure", name: "Precast lintels at openings (NOA-compliant)", durationDays: 5, offsetDays: 84, isMilestone: false, trade: "Masonry" },
  { phase: "04 — Ground Floor Structure", name: "2nd floor tie beams (2B-1 thru 2B-8) reinforcement", durationDays: 10, offsetDays: 84, isMilestone: false, trade: "Concrete" },

  // ─── Phase 5 ────────────────────────────────────────────────────────────────
  { phase: "05 — 2nd Floor Elevated Slab", name: "Shoring & formwork for 2nd floor 8\" RC slab", durationDays: 10, offsetDays: 98, isMilestone: false, trade: "Concrete" },
  { phase: "05 — 2nd Floor Elevated Slab", name: "Slab reinforcement — bottom mat #5@12\" EW + top", durationDays: 10, offsetDays: 105, isMilestone: false, trade: "Concrete" },
  { phase: "05 — 2nd Floor Elevated Slab", name: "MEP sleeves & embeds in deck", durationDays: 5, offsetDays: 112, isMilestone: false, trade: "MEP" },
  { phase: "05 — 2nd Floor Elevated Slab", name: "2nd floor RC slab pour (1,414 SF) & cure (7-day)", durationDays: 10, offsetDays: 119, isMilestone: false, trade: "Concrete" },
  { phase: "05 — 2nd Floor Elevated Slab", name: "Cantilevered balcony slab + carport flat deck", durationDays: 5, offsetDays: 119, isMilestone: false, trade: "Concrete" },

  // ─── Phase 6 ────────────────────────────────────────────────────────────────
  { phase: "06 — 2nd Floor Structure & Roof Deck", name: "2nd floor CMU walls — exterior", durationDays: 15, offsetDays: 133, isMilestone: false, trade: "Masonry" },
  { phase: "06 — 2nd Floor Structure & Roof Deck", name: "2nd floor CMU partitions", durationDays: 10, offsetDays: 140, isMilestone: false, trade: "Masonry" },
  { phase: "06 — 2nd Floor Structure & Roof Deck", name: "2nd floor tie columns & roof tie beams", durationDays: 10, offsetDays: 154, isMilestone: false, trade: "Concrete" },
  { phase: "06 — 2nd Floor Structure & Roof Deck", name: "Roof shoring & formwork", durationDays: 15, offsetDays: 161, isMilestone: false, trade: "Concrete" },
  { phase: "06 — 2nd Floor Structure & Roof Deck", name: "Roof RC deck pour & cure", durationDays: 10, offsetDays: 168, isMilestone: false, trade: "Concrete" },
  { phase: "06 — 2nd Floor Structure & Roof Deck", name: "Parapet walls to T.O. +15'-11½\"", durationDays: 5, offsetDays: 175, isMilestone: false, trade: "Masonry" },
  { phase: "06 — 2nd Floor Structure & Roof Deck", name: "Topping out — MILESTONE", durationDays: 0, offsetDays: 182, isMilestone: true, trade: null },

  // ─── Phase 7 ────────────────────────────────────────────────────────────────
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "Roof slope verification & substrate prep", durationDays: 5, offsetDays: 189, isMilestone: false, trade: "Roofing" },
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "R-30 rigid insulation install", durationDays: 5, offsetDays: 189, isMilestone: false, trade: "Roofing" },
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "Modified bitumen roofing install (sloped concrete deck)", durationDays: 10, offsetDays: 196, isMilestone: false, trade: "Roofing" },
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "Overflow scuppers (4) & primary roof drains (4)", durationDays: 5, offsetDays: 203, isMilestone: false, trade: "Roofing" },
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "Window/door bucks & flashing prep", durationDays: 5, offsetDays: 203, isMilestone: false, trade: "General" },
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "Standard impact windows & sliding doors install", durationDays: 10, offsetDays: 210, isMilestone: false, trade: "Windows" },
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "Entry & exterior swing doors install", durationDays: 5, offsetDays: 217, isMilestone: false, trade: "Windows" },
  { phase: "07 — Roofing, Waterproofing & Dry-In", name: "Building dry-in — MILESTONE", durationDays: 0, offsetDays: 224, isMilestone: true, trade: null },

  // ─── Phase 8 ────────────────────────────────────────────────────────────────
  { phase: "08 — MEP Rough-In", name: "Plumbing rough-in (above-grade DWV, supply)", durationDays: 20, offsetDays: 203, isMilestone: false, trade: "Plumbing" },
  { phase: "08 — MEP Rough-In", name: "Electrical rough-in — Panel A 200A, Panel B 150A", durationDays: 20, offsetDays: 210, isMilestone: false, trade: "Electrical" },
  { phase: "08 — MEP Rough-In", name: "HVAC ductwork — System 1 (Ground), System 2 (2nd floor)", durationDays: 15, offsetDays: 217, isMilestone: false, trade: "HVAC" },
  { phase: "08 — MEP Rough-In", name: "In-Law Suite mini-split refrigerant lines & sub-panel", durationDays: 10, offsetDays: 224, isMilestone: false, trade: "HVAC" },
  { phase: "08 — MEP Rough-In", name: "Low-voltage rough-in (TV/data/phone)", durationDays: 10, offsetDays: 231, isMilestone: false, trade: "Low-Voltage" },
  { phase: "08 — MEP Rough-In", name: "Pre-rock MEP inspection — MILESTONE", durationDays: 0, offsetDays: 238, isMilestone: true, trade: null },

  // ─── Phase 9 ────────────────────────────────────────────────────────────────
  { phase: "09 — Exterior Envelope & Site Walls", name: "Wall insulation — exterior CMU cavity fill + interior", durationDays: 10, offsetDays: 210, isMilestone: false, trade: "Insulation" },
  { phase: "09 — Exterior Envelope & Site Walls", name: "Exterior stucco — scratch coat (both sides of all walls)", durationDays: 10, offsetDays: 224, isMilestone: false, trade: "Stucco" },
  { phase: "09 — Exterior Envelope & Site Walls", name: "Exterior stucco — finish coat", durationDays: 10, offsetDays: 238, isMilestone: false, trade: "Stucco" },
  { phase: "09 — Exterior Envelope & Site Walls", name: "Exterior elastomeric paint (2 coats)", durationDays: 10, offsetDays: 252, isMilestone: false, trade: "Paint" },
  { phase: "09 — Exterior Envelope & Site Walls", name: "Site privacy wall (5' CBS, ~65 LF) + stucco", durationDays: 10, offsetDays: 259, isMilestone: false, trade: "Masonry" },

  // ─── Phase 10 ───────────────────────────────────────────────────────────────
  { phase: "10 — Interior Framing, Insulation & Drywall", name: "Metal stud framing — non-bearing partitions (both floors)", durationDays: 10, offsetDays: 238, isMilestone: false, trade: "Framing" },
  { phase: "10 — Interior Framing, Insulation & Drywall", name: "Insulation — batts at partitions, soundproofing where shown", durationDays: 5, offsetDays: 252, isMilestone: false, trade: "Insulation" },
  { phase: "10 — Interior Framing, Insulation & Drywall", name: "Drywall hang — walls and ceilings/soffits per RCP", durationDays: 10, offsetDays: 252, isMilestone: false, trade: "Drywall" },
  { phase: "10 — Interior Framing, Insulation & Drywall", name: "Drywall finish — Level 4 (tape, mud, sand)", durationDays: 10, offsetDays: 266, isMilestone: false, trade: "Drywall" },
  { phase: "10 — Interior Framing, Insulation & Drywall", name: "Interior paint — primer + 2 finish coats", durationDays: 10, offsetDays: 280, isMilestone: false, trade: "Paint" },

  // ─── Phase 11 ───────────────────────────────────────────────────────────────
  { phase: "11 — Interior Finishes", name: "Tile — bath floors & walls (porcelain)", durationDays: 10, offsetDays: 280, isMilestone: false, trade: "Tile" },
  { phase: "11 — Interior Finishes", name: "LVP flooring — common areas & bedrooms (~2,750 SF)", durationDays: 10, offsetDays: 294, isMilestone: false, trade: "Flooring" },
  { phase: "11 — Interior Finishes", name: "Cabinetry — kitchen, baths, In-Law kitchenette", durationDays: 10, offsetDays: 294, isMilestone: false, trade: "Millwork" },
  { phase: "11 — Interior Finishes", name: "Countertops — quartz template, fab & install", durationDays: 10, offsetDays: 301, isMilestone: false, trade: "Millwork" },
  { phase: "11 — Interior Finishes", name: "Interior solid-core doors & hardware", durationDays: 5, offsetDays: 301, isMilestone: false, trade: "Millwork" },
  { phase: "11 — Interior Finishes", name: "Baseboard, casing, trim install", durationDays: 5, offsetDays: 308, isMilestone: false, trade: "Millwork" },
  { phase: "11 — Interior Finishes", name: "Stair finish — red oak floating treads & risers", durationDays: 5, offsetDays: 308, isMilestone: false, trade: "Millwork" },

  // ─── Phase 12 ───────────────────────────────────────────────────────────────
  { phase: "12 — Long-Lead Window Delivery (Critical Path)", name: "Oversized impact windows W107/W111/W122 delivery", durationDays: 5, offsetDays: 245, isMilestone: false, trade: "Windows" },
  { phase: "12 — Long-Lead Window Delivery (Critical Path)", name: "Oversized window install + waterproofing", durationDays: 5, offsetDays: 252, isMilestone: false, trade: "Windows" },

  // ─── Phase 13 ───────────────────────────────────────────────────────────────
  { phase: "13 — MEP Trim-Out & Fixtures", name: "Plumbing trim — toilets, faucets, tubs, sinks, shower pan", durationDays: 10, offsetDays: 308, isMilestone: false, trade: "Plumbing" },
  { phase: "13 — MEP Trim-Out & Fixtures", name: "Electrical trim — devices, switches, outlets, GFCIs", durationDays: 10, offsetDays: 308, isMilestone: false, trade: "Electrical" },
  { phase: "13 — MEP Trim-Out & Fixtures", name: "Lighting fixtures install (recessed, pendants, sconces)", durationDays: 10, offsetDays: 315, isMilestone: false, trade: "Electrical" },
  { phase: "13 — MEP Trim-Out & Fixtures", name: "HVAC start-up, balance & commissioning", durationDays: 10, offsetDays: 315, isMilestone: false, trade: "HVAC" },
  { phase: "13 — MEP Trim-Out & Fixtures", name: "Smoke/CO detectors interconnect & test", durationDays: 5, offsetDays: 322, isMilestone: false, trade: "Electrical" },
  { phase: "13 — MEP Trim-Out & Fixtures", name: "Bath accessories, mirrors, towel bars", durationDays: 5, offsetDays: 322, isMilestone: false, trade: "Millwork" },
  { phase: "13 — MEP Trim-Out & Fixtures", name: "Appliances install & test (Owner-direct items)", durationDays: 5, offsetDays: 329, isMilestone: false, trade: "General" },

  // ─── Phase 14 ───────────────────────────────────────────────────────────────
  { phase: "14 — Pool (Separate Permit, Concurrent Track)", name: "Pool permit (separate from building permit)", durationDays: 25, offsetDays: 28, isMilestone: false, trade: "Pool" },
  { phase: "14 — Pool (Separate Permit, Concurrent Track)", name: "Pool excavation, shell, plumbing", durationDays: 15, offsetDays: 203, isMilestone: false, trade: "Pool" },
  { phase: "14 — Pool (Separate Permit, Concurrent Track)", name: "Pool tile, coping, equipment install", durationDays: 15, offsetDays: 259, isMilestone: false, trade: "Pool" },
  { phase: "14 — Pool (Separate Permit, Concurrent Track)", name: "Pool deck — composite manufactured wood + waterproofing", durationDays: 10, offsetDays: 315, isMilestone: false, trade: "Pool" },
  { phase: "14 — Pool (Separate Permit, Concurrent Track)", name: "Pool safety barrier (FBC 454.2.17.1.1)", durationDays: 5, offsetDays: 343, isMilestone: false, trade: "Pool" },

  // ─── Phase 15 ───────────────────────────────────────────────────────────────
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Asphalt driveway install (650 SF)", durationDays: 5, offsetDays: 336, isMilestone: false, trade: "Paving" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Concrete sidewalk & 5' parkway (900 SF)", durationDays: 5, offsetDays: 336, isMilestone: false, trade: "Concrete" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "New curb cut & swale restoration (City SD-16)", durationDays: 5, offsetDays: 343, isMilestone: false, trade: "Site" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Rolling aluminum driveway gate + 4 pedestrian gates", durationDays: 10, offsetDays: 343, isMilestone: false, trade: "Fence" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Outdoor kitchen package install (BBQ, sink, countertops)", durationDays: 10, offsetDays: 343, isMilestone: false, trade: "General" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Balcony composite wood deck + waterproofing", durationDays: 5, offsetDays: 336, isMilestone: false, trade: "Deck" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Exterior balcony horizontal railing system", durationDays: 5, offsetDays: 350, isMilestone: false, trade: "Railing" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Landscape — trees, palms, shrubs, sod (per LA-1)", durationDays: 10, offsetDays: 357, isMilestone: false, trade: "Landscape" },
  { phase: "15 — Site Work, Landscape & Exterior Finishes", name: "Gravel bed areas per site plan", durationDays: 5, offsetDays: 357, isMilestone: false, trade: "Landscape" },

  // ─── Phase 16 ───────────────────────────────────────────────────────────────
  { phase: "16 — Punch, Inspections & Closeout", name: "Pre-CO inspections — final electrical, plumbing, mech", durationDays: 5, offsetDays: 364, isMilestone: false, trade: "General" },
  { phase: "16 — Punch, Inspections & Closeout", name: "Final construction cleaning", durationDays: 5, offsetDays: 364, isMilestone: false, trade: "General" },
  { phase: "16 — Punch, Inspections & Closeout", name: "Punch list walkthrough w/ Architect & Owner", durationDays: 5, offsetDays: 371, isMilestone: false, trade: "General" },
  { phase: "16 — Punch, Inspections & Closeout", name: "Punch list completion", durationDays: 5, offsetDays: 371, isMilestone: false, trade: "General" },
  { phase: "16 — Punch, Inspections & Closeout", name: "City of Miami Final Building inspection", durationDays: 5, offsetDays: 378, isMilestone: false, trade: "General" },
  { phase: "16 — Punch, Inspections & Closeout", name: "Certificate of Occupancy issued — MILESTONE", durationDays: 0, offsetDays: 378, isMilestone: true, trade: null },
  { phase: "16 — Punch, Inspections & Closeout", name: "Closeout documents, warranties, O&M manuals", durationDays: 5, offsetDays: 385, isMilestone: false, trade: "General" },
  { phase: "16 — Punch, Inspections & Closeout", name: "SUBSTANTIAL COMPLETION — MILESTONE", durationDays: 0, offsetDays: 392, isMilestone: true, trade: null },
];

async function main() {
  console.log(`Seeding "Custom Homes V2" template (${TASKS.length} tasks)…`);

  // Remove any existing template with same name
  await prisma.scheduleSavedTemplate.deleteMany({
    where: { companyId: COMPANY_ID, name: "Custom Homes V2" },
  });

  const tpl = await prisma.scheduleSavedTemplate.create({
    data: {
      companyId: COMPANY_ID,
      name: "Custom Homes V2",
      description: "13-month custom home schedule — 16 phases from NTP to Substantial Completion. Base start: June 1, 2026.",
      tasks: TASKS.map((t, i) => ({ ...t, sortOrder: i })),
    },
  });

  console.log(`✓ Created template: ${tpl.id}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
