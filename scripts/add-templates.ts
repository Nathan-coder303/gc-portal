import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const COMPANY_ID = "cmmij161r000004jm8il8bd0e";

async function createTemplate(
  name: string,
  description: string,
  sortOrder: number,
  adminId: string,
  divisions: {
    csiCode: string | null;
    name: string;
    sortOrder: number;
    groups: {
      name: string;
      sortOrder: number;
      items: { name: string; unit: string; sortOrder: number }[];
    }[];
  }[]
) {
  const existing = await prisma.estimateTemplate.findFirst({
    where: { companyId: COMPANY_ID, name },
  });
  if (existing) {
    console.log(`Template "${name}" already exists — skipping`);
    return;
  }

  const template = await prisma.estimateTemplate.create({
    data: {
      companyId: COMPANY_ID,
      name,
      description,
      sortOrder,
      createdBy: adminId,
      updatedBy: adminId,
    },
  });

  for (const divData of divisions) {
    const division = await prisma.estimateTemplateDivision.create({
      data: {
        templateId: template.id,
        csiCode: divData.csiCode,
        name: divData.name,
        sortOrder: divData.sortOrder,
      },
    });

    for (const grpData of divData.groups) {
      const group = await prisma.estimateTemplateGroup.create({
        data: {
          divisionId: division.id,
          name: grpData.name,
          sortOrder: grpData.sortOrder,
        },
      });

      for (const itemData of grpData.items) {
        await prisma.estimateTemplateItem.create({
          data: {
            divisionId: division.id,
            groupId: group.id,
            name: itemData.name,
            unit: itemData.unit,
            sortOrder: itemData.sortOrder,
          },
        });
      }
    }
  }

  console.log(`✓ Created template "${name}" with ${divisions.length} divisions`);
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { companyId: COMPANY_ID, role: "ADMIN" } });
  if (!admin) throw new Error("Admin user not found");
  const adminId = admin.id;

  // ─── Bathroom Remodeling ────────────────────────────────────────────────────
  await createTemplate("Bathroom Remodeling", "Full bathroom remodel — demo through finish", 1, adminId, [
    {
      csiCode: "02", name: "Existing Conditions", sortOrder: 0,
      groups: [
        {
          name: "Demolition", sortOrder: 0,
          items: [
            { name: "Demo Existing Tile & Backer", unit: "SF", sortOrder: 0 },
            { name: "Demo Vanity & Fixtures", unit: "LS", sortOrder: 1 },
            { name: "Demo Tub / Shower Unit", unit: "EA", sortOrder: 2 },
            { name: "Debris Hauling & Disposal", unit: "LS", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "06", name: "Carpentry & Substrates", sortOrder: 1,
      groups: [
        {
          name: "Backer & Blocking", sortOrder: 0,
          items: [
            { name: "Cement Backer Board (walls)", unit: "SF", sortOrder: 0 },
            { name: "Cement Backer Board (floor)", unit: "SF", sortOrder: 1 },
            { name: "Blocking for Grab Bars", unit: "LS", sortOrder: 2 },
          ],
        },
      ],
    },
    {
      csiCode: "07", name: "Waterproofing", sortOrder: 2,
      groups: [
        {
          name: "Waterproofing", sortOrder: 0,
          items: [
            { name: "Shower Pan Liner / Membrane", unit: "SF", sortOrder: 0 },
            { name: "RedGard / Waterproof Coating", unit: "SF", sortOrder: 1 },
            { name: "Caulking & Sealants", unit: "LS", sortOrder: 2 },
          ],
        },
      ],
    },
    {
      csiCode: "09", name: "Finishes", sortOrder: 3,
      groups: [
        {
          name: "Tile", sortOrder: 0,
          items: [
            { name: "Floor Tile (material + install)", unit: "SF", sortOrder: 0 },
            { name: "Shower Wall Tile (material + install)", unit: "SF", sortOrder: 1 },
            { name: "Tub Surround Tile", unit: "SF", sortOrder: 2 },
            { name: "Niche / Accent Tile", unit: "EA", sortOrder: 3 },
            { name: "Tile Grout & Sealer", unit: "LS", sortOrder: 4 },
          ],
        },
        {
          name: "Drywall & Paint", sortOrder: 1,
          items: [
            { name: "Drywall Repair / Hang", unit: "SF", sortOrder: 0 },
            { name: "Interior Paint (walls & ceiling)", unit: "SF", sortOrder: 1 },
          ],
        },
      ],
    },
    {
      csiCode: "10", name: "Specialties", sortOrder: 4,
      groups: [
        {
          name: "Accessories", sortOrder: 0,
          items: [
            { name: "Towel Bars & TP Holder", unit: "LS", sortOrder: 0 },
            { name: "Mirror / Medicine Cabinet", unit: "EA", sortOrder: 1 },
            { name: "Shower Door / Enclosure", unit: "EA", sortOrder: 2 },
            { name: "Grab Bars", unit: "EA", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "15", name: "Plumbing", sortOrder: 5,
      groups: [
        {
          name: "Rough Plumbing", sortOrder: 0,
          items: [
            { name: "Rough Plumbing (supply & drain)", unit: "LS", sortOrder: 0 },
            { name: "Shower Valve Rough-in", unit: "EA", sortOrder: 1 },
            { name: "Tub / Shower Pan", unit: "EA", sortOrder: 2 },
          ],
        },
        {
          name: "Finish Plumbing", sortOrder: 1,
          items: [
            { name: "Vanity & Sink", unit: "EA", sortOrder: 0 },
            { name: "Faucet & Drain", unit: "EA", sortOrder: 1 },
            { name: "Toilet", unit: "EA", sortOrder: 2 },
            { name: "Shower Trim Kit", unit: "EA", sortOrder: 3 },
            { name: "Exhaust Fan", unit: "EA", sortOrder: 4 },
          ],
        },
      ],
    },
    {
      csiCode: "16", name: "Electrical", sortOrder: 6,
      groups: [
        {
          name: "Electrical", sortOrder: 0,
          items: [
            { name: "GFCI Outlets", unit: "EA", sortOrder: 0 },
            { name: "Vanity Light Fixture", unit: "EA", sortOrder: 1 },
            { name: "Recessed Lights", unit: "EA", sortOrder: 2 },
            { name: "Exhaust Fan Wiring", unit: "EA", sortOrder: 3 },
            { name: "Heated Floor (electric mat)", unit: "SF", sortOrder: 4 },
          ],
        },
      ],
    },
  ]);

  // ─── Kitchen Remodeling ─────────────────────────────────────────────────────
  await createTemplate("Kitchen Remodeling", "Full kitchen remodel — demo through finish", 2, adminId, [
    {
      csiCode: "02", name: "Existing Conditions", sortOrder: 0,
      groups: [
        {
          name: "Demolition", sortOrder: 0,
          items: [
            { name: "Demo Existing Cabinets", unit: "LS", sortOrder: 0 },
            { name: "Demo Countertops", unit: "LF", sortOrder: 1 },
            { name: "Demo Flooring", unit: "SF", sortOrder: 2 },
            { name: "Demo Appliances (disconnect & remove)", unit: "LS", sortOrder: 3 },
            { name: "Debris Hauling & Disposal", unit: "LS", sortOrder: 4 },
          ],
        },
      ],
    },
    {
      csiCode: "06", name: "Cabinetry & Millwork", sortOrder: 1,
      groups: [
        {
          name: "Cabinets", sortOrder: 0,
          items: [
            { name: "Base Cabinets (supply & install)", unit: "LF", sortOrder: 0 },
            { name: "Upper Cabinets (supply & install)", unit: "LF", sortOrder: 1 },
            { name: "Island / Peninsula", unit: "LS", sortOrder: 2 },
            { name: "Pantry / Tall Cabinet", unit: "EA", sortOrder: 3 },
          ],
        },
        {
          name: "Millwork", sortOrder: 1,
          items: [
            { name: "Crown Molding on Uppers", unit: "LF", sortOrder: 0 },
            { name: "Light Rail Molding", unit: "LF", sortOrder: 1 },
            { name: "Under-Cabinet Lighting Blocking", unit: "LS", sortOrder: 2 },
          ],
        },
      ],
    },
    {
      csiCode: "09", name: "Finishes", sortOrder: 2,
      groups: [
        {
          name: "Countertops", sortOrder: 0,
          items: [
            { name: "Quartz Countertop (supply & install)", unit: "SF", sortOrder: 0 },
            { name: "Granite Countertop (supply & install)", unit: "SF", sortOrder: 1 },
            { name: "Butcher Block", unit: "LF", sortOrder: 2 },
          ],
        },
        {
          name: "Backsplash", sortOrder: 1,
          items: [
            { name: "Tile Backsplash (material + install)", unit: "SF", sortOrder: 0 },
            { name: "Grout & Sealer", unit: "LS", sortOrder: 1 },
          ],
        },
        {
          name: "Flooring", sortOrder: 2,
          items: [
            { name: "LVP / LVT Flooring", unit: "SF", sortOrder: 0 },
            { name: "Tile Flooring", unit: "SF", sortOrder: 1 },
            { name: "Hardwood Flooring", unit: "SF", sortOrder: 2 },
          ],
        },
        {
          name: "Paint", sortOrder: 3,
          items: [
            { name: "Interior Paint (walls & ceiling)", unit: "SF", sortOrder: 0 },
            { name: "Cabinet Paint / Refinish", unit: "LS", sortOrder: 1 },
          ],
        },
      ],
    },
    {
      csiCode: "11", name: "Appliances", sortOrder: 3,
      groups: [
        {
          name: "Appliances", sortOrder: 0,
          items: [
            { name: "Refrigerator (supply & install)", unit: "EA", sortOrder: 0 },
            { name: "Range / Cooktop (supply & install)", unit: "EA", sortOrder: 1 },
            { name: "Oven / Wall Oven", unit: "EA", sortOrder: 2 },
            { name: "Dishwasher (supply & install)", unit: "EA", sortOrder: 3 },
            { name: "Microwave / Hood (supply & install)", unit: "EA", sortOrder: 4 },
            { name: "Garbage Disposal", unit: "EA", sortOrder: 5 },
          ],
        },
      ],
    },
    {
      csiCode: "15", name: "Plumbing", sortOrder: 4,
      groups: [
        {
          name: "Plumbing", sortOrder: 0,
          items: [
            { name: "Rough Plumbing (supply & drain)", unit: "LS", sortOrder: 0 },
            { name: "Kitchen Sink (supply & install)", unit: "EA", sortOrder: 1 },
            { name: "Faucet (supply & install)", unit: "EA", sortOrder: 2 },
            { name: "Pot Filler", unit: "EA", sortOrder: 3 },
            { name: "Ice Maker / Refrigerator Line", unit: "EA", sortOrder: 4 },
          ],
        },
      ],
    },
    {
      csiCode: "16", name: "Electrical", sortOrder: 5,
      groups: [
        {
          name: "Electrical", sortOrder: 0,
          items: [
            { name: "20A Circuits (appliances)", unit: "EA", sortOrder: 0 },
            { name: "GFCI Outlets", unit: "EA", sortOrder: 1 },
            { name: "Under-Cabinet Lighting", unit: "LF", sortOrder: 2 },
            { name: "Recessed Lights", unit: "EA", sortOrder: 3 },
            { name: "Pendant / Island Lights", unit: "EA", sortOrder: 4 },
            { name: "Range Hood Wiring", unit: "EA", sortOrder: 5 },
          ],
        },
      ],
    },
  ]);

  // ─── Custom Homes ───────────────────────────────────────────────────────────
  await createTemplate("Custom Homes", "Complete custom home construction — site work through finish", 3, adminId, [
    {
      csiCode: "01", name: "General Requirements", sortOrder: 0,
      groups: [
        {
          name: "Supervision & Admin", sortOrder: 0,
          items: [
            { name: "Site Superintendent", unit: "MO", sortOrder: 0 },
            { name: "PM / Admin", unit: "MO", sortOrder: 1 },
            { name: "Building Permits & Fees", unit: "LS", sortOrder: 2 },
            { name: "Surveys & Engineering", unit: "LS", sortOrder: 3 },
          ],
        },
        {
          name: "Temporary Facilities", sortOrder: 1,
          items: [
            { name: "Temporary Power", unit: "MO", sortOrder: 0 },
            { name: "Portable Toilets", unit: "MO", sortOrder: 1 },
            { name: "Dumpster", unit: "MO", sortOrder: 2 },
            { name: "Site Fencing", unit: "LF", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "02", name: "Site Work", sortOrder: 1,
      groups: [
        {
          name: "Site Preparation", sortOrder: 0,
          items: [
            { name: "Clearing & Grubbing", unit: "AC", sortOrder: 0 },
            { name: "Rough Grading", unit: "CY", sortOrder: 1 },
            { name: "Fine Grading", unit: "SF", sortOrder: 2 },
            { name: "Erosion Control", unit: "LS", sortOrder: 3 },
          ],
        },
        {
          name: "Utilities", sortOrder: 1,
          items: [
            { name: "Water Service (meter to house)", unit: "LF", sortOrder: 0 },
            { name: "Sewer / Septic", unit: "LS", sortOrder: 1 },
            { name: "Electric Service (from pole)", unit: "LS", sortOrder: 2 },
            { name: "Driveway (base + paving)", unit: "SF", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "03", name: "Concrete", sortOrder: 2,
      groups: [
        {
          name: "Foundation", sortOrder: 0,
          items: [
            { name: "Excavation", unit: "CY", sortOrder: 0 },
            { name: "Footings", unit: "CY", sortOrder: 1 },
            { name: "Foundation Walls / Stem Walls", unit: "CY", sortOrder: 2 },
            { name: "Slab on Grade", unit: "SF", sortOrder: 3 },
            { name: "Waterproof Foundation", unit: "SF", sortOrder: 4 },
          ],
        },
        {
          name: "Flatwork", sortOrder: 1,
          items: [
            { name: "Garage Slab", unit: "SF", sortOrder: 0 },
            { name: "Patio / Walkways", unit: "SF", sortOrder: 1 },
            { name: "Pool Deck (if applicable)", unit: "SF", sortOrder: 2 },
          ],
        },
      ],
    },
    {
      csiCode: "06", name: "Wood & Plastics", sortOrder: 3,
      groups: [
        {
          name: "Rough Framing", sortOrder: 0,
          items: [
            { name: "Framing Labor & Material", unit: "SF", sortOrder: 0 },
            { name: "Structural Beams & Headers", unit: "LF", sortOrder: 1 },
            { name: "Floor Trusses / Joists", unit: "SF", sortOrder: 2 },
            { name: "Roof Trusses", unit: "SF", sortOrder: 3 },
            { name: "Sheathing (walls & roof)", unit: "SF", sortOrder: 4 },
            { name: "Hurricane Straps & Hardware", unit: "LS", sortOrder: 5 },
          ],
        },
        {
          name: "Finish Carpentry", sortOrder: 1,
          items: [
            { name: "Interior Doors & Frames", unit: "EA", sortOrder: 0 },
            { name: "Door Casings", unit: "EA", sortOrder: 1 },
            { name: "Base Molding", unit: "LF", sortOrder: 2 },
            { name: "Crown Molding", unit: "LF", sortOrder: 3 },
            { name: "Window Stools & Aprons", unit: "EA", sortOrder: 4 },
            { name: "Closet Shelving", unit: "LF", sortOrder: 5 },
            { name: "Stair System", unit: "LS", sortOrder: 6 },
          ],
        },
      ],
    },
    {
      csiCode: "07", name: "Thermal & Moisture Protection", sortOrder: 4,
      groups: [
        {
          name: "Roofing", sortOrder: 0,
          items: [
            { name: "Shingle / Tile Roofing", unit: "SQ", sortOrder: 0 },
            { name: "Underlayment & Ice Shield", unit: "SQ", sortOrder: 1 },
            { name: "Ridge Vent", unit: "LF", sortOrder: 2 },
            { name: "Skylights", unit: "EA", sortOrder: 3 },
          ],
        },
        {
          name: "Insulation", sortOrder: 1,
          items: [
            { name: "Wall Insulation (batts)", unit: "SF", sortOrder: 0 },
            { name: "Attic Insulation (blown)", unit: "SF", sortOrder: 1 },
            { name: "Spray Foam (rim joist / details)", unit: "BF", sortOrder: 2 },
          ],
        },
        {
          name: "Moisture & Weather Barrier", sortOrder: 2,
          items: [
            { name: "House Wrap / WRB", unit: "SF", sortOrder: 0 },
            { name: "Flashing (windows, roof, wall)", unit: "LS", sortOrder: 1 },
            { name: "Caulking & Sealants", unit: "LS", sortOrder: 2 },
          ],
        },
      ],
    },
    {
      csiCode: "08", name: "Openings", sortOrder: 5,
      groups: [
        {
          name: "Exterior Doors", sortOrder: 0,
          items: [
            { name: "Front Entry Door", unit: "EA", sortOrder: 0 },
            { name: "Exterior Doors (other)", unit: "EA", sortOrder: 1 },
            { name: "Garage Door & Opener", unit: "EA", sortOrder: 2 },
            { name: "Sliding / French Doors", unit: "EA", sortOrder: 3 },
          ],
        },
        {
          name: "Windows", sortOrder: 1,
          items: [
            { name: "Windows (impact / standard)", unit: "EA", sortOrder: 0 },
            { name: "Window Screens", unit: "LS", sortOrder: 1 },
          ],
        },
      ],
    },
    {
      csiCode: "09", name: "Finishes", sortOrder: 6,
      groups: [
        {
          name: "Exterior Finishes", sortOrder: 0,
          items: [
            { name: "Stucco / EIFS", unit: "SF", sortOrder: 0 },
            { name: "Siding (Hardie / Vinyl)", unit: "SF", sortOrder: 1 },
            { name: "Exterior Paint", unit: "SF", sortOrder: 2 },
          ],
        },
        {
          name: "Drywall", sortOrder: 1,
          items: [
            { name: "Drywall Hang & Finish (Level 4)", unit: "SF", sortOrder: 0 },
            { name: "Smooth Finish / Level 5 (optional)", unit: "SF", sortOrder: 1 },
          ],
        },
        {
          name: "Flooring", sortOrder: 2,
          items: [
            { name: "Hardwood Flooring", unit: "SF", sortOrder: 0 },
            { name: "Tile Flooring", unit: "SF", sortOrder: 1 },
            { name: "LVP / LVT", unit: "SF", sortOrder: 2 },
            { name: "Carpet", unit: "SY", sortOrder: 3 },
          ],
        },
        {
          name: "Tile (Wet Areas)", sortOrder: 3,
          items: [
            { name: "Master Bath Tile", unit: "SF", sortOrder: 0 },
            { name: "Secondary Bath Tile", unit: "SF", sortOrder: 1 },
          ],
        },
        {
          name: "Paint", sortOrder: 4,
          items: [
            { name: "Interior Paint (walls / ceilings)", unit: "SF", sortOrder: 0 },
            { name: "Interior Trim Paint", unit: "LF", sortOrder: 1 },
          ],
        },
      ],
    },
    {
      csiCode: "11", name: "Equipment & Appliances", sortOrder: 7,
      groups: [
        {
          name: "Appliances", sortOrder: 0,
          items: [
            { name: "Refrigerator", unit: "EA", sortOrder: 0 },
            { name: "Range / Cooktop + Oven", unit: "EA", sortOrder: 1 },
            { name: "Dishwasher", unit: "EA", sortOrder: 2 },
            { name: "Microwave / Hood", unit: "EA", sortOrder: 3 },
            { name: "Washer / Dryer", unit: "EA", sortOrder: 4 },
          ],
        },
      ],
    },
    {
      csiCode: "15", name: "Mechanical", sortOrder: 8,
      groups: [
        {
          name: "Plumbing", sortOrder: 0,
          items: [
            { name: "Rough Plumbing", unit: "LS", sortOrder: 0 },
            { name: "Finish Plumbing (fixtures)", unit: "LS", sortOrder: 1 },
            { name: "Water Heater / Tankless", unit: "EA", sortOrder: 2 },
            { name: "Gas Piping", unit: "LF", sortOrder: 3 },
          ],
        },
        {
          name: "HVAC", sortOrder: 1,
          items: [
            { name: "AC Units & Air Handlers", unit: "TON", sortOrder: 0 },
            { name: "Ductwork", unit: "LS", sortOrder: 1 },
            { name: "Registers & Grilles", unit: "EA", sortOrder: 2 },
            { name: "Thermostats", unit: "EA", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "16", name: "Electrical", sortOrder: 9,
      groups: [
        {
          name: "Rough Electrical", sortOrder: 0,
          items: [
            { name: "Panel & Service Entrance", unit: "EA", sortOrder: 0 },
            { name: "Rough Wiring & Boxes", unit: "LS", sortOrder: 1 },
            { name: "Low Voltage (data, TV, audio)", unit: "LS", sortOrder: 2 },
          ],
        },
        {
          name: "Finish Electrical", sortOrder: 1,
          items: [
            { name: "Devices & Cover Plates", unit: "LS", sortOrder: 0 },
            { name: "Recessed Lights", unit: "EA", sortOrder: 1 },
            { name: "Ceiling Fans", unit: "EA", sortOrder: 2 },
            { name: "Exterior Lighting", unit: "EA", sortOrder: 3 },
            { name: "Smart Home / Security", unit: "LS", sortOrder: 4 },
          ],
        },
      ],
    },
  ]);

  // ─── Roofing ────────────────────────────────────────────────────────────────
  await createTemplate("Roofing", "Full roofing replacement — tear-off through finish", 4, adminId, [
    {
      csiCode: "02", name: "Existing Conditions", sortOrder: 0,
      groups: [
        {
          name: "Tear-off", sortOrder: 0,
          items: [
            { name: "Tear-off Existing Shingles (1 layer)", unit: "SQ", sortOrder: 0 },
            { name: "Tear-off Existing Shingles (2 layers)", unit: "SQ", sortOrder: 1 },
            { name: "Debris Hauling & Disposal", unit: "LS", sortOrder: 2 },
            { name: "Deck Inspection & Repair", unit: "SF", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "07", name: "Roofing System", sortOrder: 1,
      groups: [
        {
          name: "Underlayment & Decking", sortOrder: 0,
          items: [
            { name: "Synthetic Underlayment", unit: "SQ", sortOrder: 0 },
            { name: "Ice & Water Shield", unit: "SQ", sortOrder: 1 },
            { name: "Decking Replacement (OSB / Plywood)", unit: "SF", sortOrder: 2 },
          ],
        },
        {
          name: "Shingles", sortOrder: 1,
          items: [
            { name: "Architectural Shingles (30-yr)", unit: "SQ", sortOrder: 0 },
            { name: "Architectural Shingles (50-yr)", unit: "SQ", sortOrder: 1 },
            { name: "Metal Roofing (standing seam)", unit: "SQ", sortOrder: 2 },
            { name: "Tile Roofing", unit: "SQ", sortOrder: 3 },
            { name: "Flat / Mod-bit Roofing", unit: "SQ", sortOrder: 4 },
          ],
        },
        {
          name: "Flashing & Trim", sortOrder: 2,
          items: [
            { name: "Step Flashing", unit: "LF", sortOrder: 0 },
            { name: "Counter / Chimney Flashing", unit: "LS", sortOrder: 1 },
            { name: "Valley Flashing", unit: "LF", sortOrder: 2 },
            { name: "Drip Edge", unit: "LF", sortOrder: 3 },
            { name: "Pipe Boot Flashings", unit: "EA", sortOrder: 4 },
          ],
        },
        {
          name: "Ventilation", sortOrder: 3,
          items: [
            { name: "Ridge Vent", unit: "LF", sortOrder: 0 },
            { name: "Box Vents / Turtle Vents", unit: "EA", sortOrder: 1 },
            { name: "Soffit Vents", unit: "LF", sortOrder: 2 },
            { name: "Power Attic Ventilator", unit: "EA", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "07", name: "Gutters & Drainage", sortOrder: 2,
      groups: [
        {
          name: "Gutters", sortOrder: 0,
          items: [
            { name: "Gutters (5\" K-style aluminum)", unit: "LF", sortOrder: 0 },
            { name: "Gutters (6\" K-style aluminum)", unit: "LF", sortOrder: 1 },
            { name: "Downspouts", unit: "LF", sortOrder: 2 },
            { name: "Gutter Guards / Leaf Protection", unit: "LF", sortOrder: 3 },
          ],
        },
      ],
    },
    {
      csiCode: "07", name: "Skylight & Penetrations", sortOrder: 3,
      groups: [
        {
          name: "Skylights", sortOrder: 0,
          items: [
            { name: "Skylight (supply & install)", unit: "EA", sortOrder: 0 },
            { name: "Skylight Flashing Kit", unit: "EA", sortOrder: 1 },
            { name: "Solar Tube / Tubular Skylight", unit: "EA", sortOrder: 2 },
          ],
        },
      ],
    },
  ]);

  console.log("\nAll done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
