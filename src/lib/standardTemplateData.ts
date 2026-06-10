/** Standard CSI MasterFormat divisions and items for a new Addition/Remodel template */
export type TemplateDivisionData = {
  csiCode: string;
  name: string;
  items: { csiCode: string; name: string }[];
};

export const STANDARD_TEMPLATE_DIVISIONS: TemplateDivisionData[] = [
  {
    csiCode: "01 00 00",
    name: "General Conditions",
    items: [
      { csiCode: "01 10 00", name: "Professional Services (Architect / Engineering)" },
      { csiCode: "01 11 00", name: "Summary of Work" },
      { csiCode: "01 21 00", name: "Allowances" },
      { csiCode: "01 22 00", name: "Unit Prices" },
      { csiCode: "01 23 00", name: "Alternates" },
      { csiCode: "01 25 00", name: "Substitution Procedures" },
      { csiCode: "01 29 00", name: "Payment Procedures" },
      { csiCode: "01 31 00", name: "Project Management" },
      { csiCode: "01 32 00", name: "Construction Scheduling / Progress Documentation" },
      { csiCode: "01 33 00", name: "Submittal Procedures" },
      { csiCode: "01 35 00", name: "Special Procedures / Safety Requirements" },
      { csiCode: "01 40 00", name: "Quality Requirements" },
      { csiCode: "01 45 00", name: "Quality Control" },
      { csiCode: "01 50 00", name: "Temporary Facilities & Controls" },
      { csiCode: "01 57 00", name: "Temporary Controls" },
      { csiCode: "01 60 00", name: "Product Requirements" },
      { csiCode: "01 74 19", name: "Construction Waste Management" },
      { csiCode: "01 77 00", name: "Closeout Procedures" },
      { csiCode: "01 78 00", name: "Operation & Maintenance Data" },
    ],
  },
  {
    csiCode: "02 00 00",
    name: "Existing Conditions",
    items: [
      { csiCode: "02 20 00", name: "Site Remediation" },
      { csiCode: "02 30 00", name: "Subsurface Investigation" },
      { csiCode: "02 32 00", name: "Geotechnical Investigation" },
      { csiCode: "02 41 00", name: "Demolition" },
      { csiCode: "02 41 19", name: "Selective Demolition" },
      { csiCode: "02 70 00", name: "Environmental Protection" },
    ],
  },
  {
    csiCode: "03 00 00",
    name: "Concrete",
    items: [
      { csiCode: "03 10 00", name: "Concrete Forming" },
      { csiCode: "03 20 00", name: "Concrete Reinforcing" },
      { csiCode: "03 30 00", name: "Cast-in-Place Concrete" },
      { csiCode: "03 35 00", name: "Concrete Finishing" },
      { csiCode: "03 39 00", name: "Concrete Curing" },
    ],
  },
  {
    csiCode: "04 00 00",
    name: "Masonry",
    items: [
      { csiCode: "04 20 00", name: "Unit Masonry" },
      { csiCode: "04 22 00", name: "Concrete Masonry Units" },
      { csiCode: "04 40 00", name: "Stone Assemblies" },
      { csiCode: "04 72 00", name: "Cast Stone Masonry" },
    ],
  },
  {
    csiCode: "05 00 00",
    name: "Metals",
    items: [
      { csiCode: "05 12 00", name: "Structural Steel Framing" },
      { csiCode: "05 21 00", name: "Steel Joists" },
      { csiCode: "05 50 00", name: "Metal Fabrications" },
      { csiCode: "05 51 00", name: "Metal Stairs" },
      { csiCode: "05 52 00", name: "Metal Railings" },
    ],
  },
  {
    csiCode: "06 00 00",
    name: "Wood, Plastics, and Composites",
    items: [
      { csiCode: "06 10 00", name: "Rough Carpentry" },
      { csiCode: "06 16 00", name: "Sheathing" },
      { csiCode: "06 17 00", name: "Shop-Fabricated Structural Wood" },
      { csiCode: "06 20 00", name: "Finish Carpentry" },
      { csiCode: "06 41 00", name: "Architectural Wood Casework" },
    ],
  },
  {
    csiCode: "07 00 00",
    name: "Thermal and Moisture Protection",
    items: [
      { csiCode: "07 21 00", name: "Thermal Insulation" },
      { csiCode: "07 25 00", name: "Weather Barriers" },
      { csiCode: "07 27 00", name: "Air Barriers" },
      { csiCode: "07 31 13", name: "Asphalt Shingles" },
      { csiCode: "07 54 00", name: "Thermoplastic Roofing" },
      { csiCode: "07 60 00", name: "Flashing and Sheet Metal" },
      { csiCode: "07 92 00", name: "Joint Sealants" },
    ],
  },
  {
    csiCode: "08 00 00",
    name: "Openings",
    items: [
      { csiCode: "08 11 13", name: "Hollow Metal Doors" },
      { csiCode: "08 14 16", name: "Flush Wood Doors" },
      { csiCode: "08 41 13", name: "Aluminum Framed Entrances" },
      { csiCode: "08 51 13", name: "Aluminum Windows" },
      { csiCode: "08 53 00", name: "Plastic Windows" },
      { csiCode: "08 71 00", name: "Door Hardware" },
    ],
  },
  {
    csiCode: "09 00 00",
    name: "Finishes",
    items: [
      { csiCode: "09 21 16", name: "Gypsum Board Assemblies" },
      { csiCode: "09 29 00", name: "Gypsum Board" },
      { csiCode: "09 30 00", name: "Tiling" },
      { csiCode: "09 51 00", name: "Acoustical Ceilings" },
      { csiCode: "09 65 00", name: "Resilient Flooring" },
      { csiCode: "09 68 00", name: "Carpet" },
      { csiCode: "09 90 00", name: "Painting and Coating" },
    ],
  },
  {
    csiCode: "10 00 00",
    name: "Specialties",
    items: [
      { csiCode: "10 14 00", name: "Signage" },
      { csiCode: "10 28 00", name: "Toilet Accessories" },
      { csiCode: "10 44 00", name: "Fire Protection Specialties" },
    ],
  },
  {
    csiCode: "12 00 00",
    name: "Furnishings",
    items: [
      { csiCode: "12 32 00", name: "Manufactured Casework" },
      { csiCode: "12 35 00", name: "Countertops" },
      { csiCode: "12 48 00", name: "Entrance Floor Mats" },
    ],
  },
  {
    csiCode: "21 00 00",
    name: "Fire Suppression",
    items: [
      { csiCode: "21 13 00", name: "Fire Sprinkler Systems" },
    ],
  },
  {
    csiCode: "22 00 00",
    name: "Plumbing",
    items: [
      { csiCode: "22 05 00", name: "Plumbing General Requirements" },
      { csiCode: "22 11 00", name: "Water Distribution" },
      { csiCode: "22 13 00", name: "Sanitary Waste" },
      { csiCode: "22 33 00", name: "Electric Water Heaters" },
      { csiCode: "22 40 00", name: "Plumbing Fixtures" },
    ],
  },
  {
    csiCode: "23 00 00",
    name: "HVAC / Mechanical",
    items: [
      { csiCode: "23 05 00", name: "HVAC General" },
      { csiCode: "23 07 00", name: "HVAC Insulation" },
      { csiCode: "23 09 00", name: "HVAC Controls" },
      { csiCode: "23 31 00", name: "HVAC Ducts" },
      { csiCode: "23 34 00", name: "HVAC Fans" },
      { csiCode: "23 81 00", name: "Decentralized HVAC Units" },
    ],
  },
  {
    csiCode: "26 00 00",
    name: "Electrical",
    items: [
      { csiCode: "26 05 00", name: "Electrical General" },
      { csiCode: "26 05 19", name: "Low-Voltage Conductors" },
      { csiCode: "26 24 16", name: "Panelboards" },
      { csiCode: "26 27 26", name: "Wiring Devices" },
      { csiCode: "26 51 00", name: "Lighting" },
    ],
  },
  {
    csiCode: "31 00 00",
    name: "Earthwork",
    items: [
      { csiCode: "31 22 00", name: "Grading" },
      { csiCode: "31 23 16", name: "Excavation" },
      { csiCode: "31 23 23", name: "Fill" },
      { csiCode: "31 23 33", name: "Trenching and Backfill" },
    ],
  },
  {
    csiCode: "32 00 00",
    name: "Exterior Improvements",
    items: [
      { csiCode: "32 13 13", name: "Concrete Paving" },
      { csiCode: "32 31 00", name: "Fences and Gates" },
      { csiCode: "32 92 00", name: "Turf and Grasses" },
    ],
  },
];

/** CSI MasterFormat divisions and items for a Bathroom Remodeling template */
export const BATHROOM_TEMPLATE_DIVISIONS: TemplateDivisionData[] = [
  {
    csiCode: "01 00 00",
    name: "General Conditions",
    items: [
      { csiCode: "01 11 00", name: "Summary of Work & Scope" },
      { csiCode: "01 50 00", name: "Dumpsters, Debris Removal & Site Protection" },
      { csiCode: "01 74 19", name: "On-Site Cleaning & Waste Management" },
    ],
  },
  {
    csiCode: "02 00 00",
    name: "Existing Conditions",
    items: [
      { csiCode: "02 41 19", name: "Demo — Toilet, Wax Ring & Water Shutoff" },
      { csiCode: "02 41 19", name: "Demo — Vanity Cabinet, Countertop & Mirror" },
      { csiCode: "02 41 19", name: "Demo — Tub / Shower Unit Removal" },
      { csiCode: "02 41 19", name: "Demo — Existing Floor Tile & Underlayment" },
      { csiCode: "02 41 19", name: "Demo — Existing Wall Tile & Shower Surround" },
      { csiCode: "02 41 19", name: "Demo — Existing Drywall & Cement Board" },
    ],
  },
  {
    csiCode: "06 00 00",
    name: "Wood, Plastics, and Composites",
    items: [
      { csiCode: "06 10 53", name: "Rough Carpentry — Blocking & Backing (Grab Bars, Fixture Support)" },
      { csiCode: "06 22 13", name: "Finish Carpentry — Base Trim, Door Casing & Window Stool" },
      { csiCode: "06 41 16", name: "Vanity Cabinet — Supply & Installation" },
    ],
  },
  {
    csiCode: "07 00 00",
    name: "Thermal & Moisture Protection",
    items: [
      { csiCode: "07 13 26", name: "Shower Waterproofing Membrane (Schluter / RedGard / Sheet Membrane)" },
      { csiCode: "07 92 00", name: "Caulking & Joint Sealants (Tub Surround, Tile Transitions)" },
    ],
  },
  {
    csiCode: "08 00 00",
    name: "Openings",
    items: [
      { csiCode: "08 14 16", name: "Interior Bathroom Door — Supply & Installation" },
      { csiCode: "08 71 00", name: "Door Hardware — Lockset, Hinges & Door Stop" },
    ],
  },
  {
    csiCode: "09 00 00",
    name: "Finishes",
    items: [
      { csiCode: "09 21 16", name: "Cement Board / Tile Backer — Wet Areas, Shower & Tub Surround" },
      { csiCode: "09 29 00", name: "Moisture-Resistant Gypsum Board — Hang & Finish" },
      { csiCode: "09 30 13", name: "Floor Tile — Supply & Installation (Thinset & Grout Included)" },
      { csiCode: "09 30 13", name: "Shower Wall Tile — Supply & Installation" },
      { csiCode: "09 30 13", name: "Tub Surround Tile — Supply & Installation" },
      { csiCode: "09 30 33", name: "Natural Stone Tile — Supply & Installation (if applicable)" },
      { csiCode: "09 65 00", name: "LVP / LVT Flooring — Supply & Installation (if applicable)" },
      { csiCode: "09 91 23", name: "Interior Painting — Walls & Ceiling" },
    ],
  },
  {
    csiCode: "10 00 00",
    name: "Specialties",
    items: [
      { csiCode: "10 21 13", name: "Frameless Glass Shower Door / Enclosure — Supply & Installation" },
      { csiCode: "10 28 13", name: "Toilet Accessories — TP Holder, Towel Bar & Robe Hook" },
      { csiCode: "10 28 19", name: "Medicine Cabinet — Recessed or Surface-Mounted" },
      { csiCode: "10 28 16", name: "Vanity Mirror — Supply & Installation" },
    ],
  },
  {
    csiCode: "12 00 00",
    name: "Furnishings",
    items: [
      { csiCode: "12 36 61", name: "Vanity Countertop — Supply & Installation" },
    ],
  },
  {
    csiCode: "22 00 00",
    name: "Plumbing",
    items: [
      { csiCode: "22 05 00", name: "Plumbing General — Permits & Rough-In Inspection" },
      { csiCode: "22 11 16", name: "Water Distribution Piping — Supply Lines, Shut-Offs & Connections" },
      { csiCode: "22 13 16", name: "Sanitary Waste & Vent Piping — Drain Modification / New Rough-In" },
      { csiCode: "22 41 39", name: "Bathtub / Soaking Tub — Supply & Installation" },
      { csiCode: "22 42 13", name: "Water Closet (Toilet) — Supply & Installation" },
      { csiCode: "22 42 16", name: "Lavatory (Sink & Faucet) — Supply & Installation" },
      { csiCode: "22 42 39", name: "Shower Valve & Trim — Supply & Installation" },
    ],
  },
  {
    csiCode: "23 00 00",
    name: "HVAC / Mechanical",
    items: [
      { csiCode: "23 34 23", name: "Bathroom Exhaust Fan — Supply & Installation" },
    ],
  },
  {
    csiCode: "26 00 00",
    name: "Electrical",
    items: [
      { csiCode: "26 05 33", name: "Electrical Rough-In — Boxes, Conduit & New Circuits" },
      { csiCode: "26 27 26", name: "GFCI Receptacles — Supply & Install" },
      { csiCode: "26 51 13", name: "Vanity Light Fixture — Supply & Install" },
      { csiCode: "26 51 13", name: "Recessed / Overhead Lighting — Supply & Install (if applicable)" },
    ],
  },
];

/** CSI MasterFormat divisions and items for a Kitchen Remodeling template */
export const KITCHEN_TEMPLATE_DIVISIONS: TemplateDivisionData[] = [
  {
    csiCode: "01 00 00",
    name: "General Conditions",
    items: [
      { csiCode: "01 11 00", name: "Summary of Work & Scope" },
      { csiCode: "01 50 00", name: "Dumpsters, Debris Removal & Site Protection" },
      { csiCode: "01 74 19", name: "On-Site Cleaning & Waste Management" },
    ],
  },
  {
    csiCode: "02 00 00",
    name: "Existing Conditions",
    items: [
      { csiCode: "02 41 19", name: "Demo — Existing Upper & Lower Cabinets" },
      { csiCode: "02 41 19", name: "Demo — Existing Countertops & Backsplash Tile" },
      { csiCode: "02 41 19", name: "Demo — Existing Sink, Faucet & Disposal" },
      { csiCode: "02 41 19", name: "Demo — Existing Appliances (Disconnect & Remove)" },
      { csiCode: "02 41 19", name: "Demo — Existing Flooring" },
      { csiCode: "02 41 19", name: "Demo — Existing Drywall / Soffit (if applicable)" },
    ],
  },
  {
    csiCode: "06 00 00",
    name: "Wood, Plastics, and Composites",
    items: [
      { csiCode: "06 10 53", name: "Rough Carpentry — Blocking, Nailers & Backing" },
      { csiCode: "06 20 00", name: "Finish Carpentry — Crown Molding, Toe Kick & Trim" },
      { csiCode: "06 22 13", name: "Interior Finish Carpentry — Base Trim & Door Casing" },
      { csiCode: "06 41 00", name: "Kitchen Cabinets (Upper & Lower) — Supply & Installation" },
      { csiCode: "06 42 16", name: "Kitchen Island / Specialty Casework — Supply & Installation" },
    ],
  },
  {
    csiCode: "07 00 00",
    name: "Thermal & Moisture Protection",
    items: [
      { csiCode: "07 92 00", name: "Caulking & Joint Sealants (Countertop to Wall, Sink Cutout)" },
    ],
  },
  {
    csiCode: "09 00 00",
    name: "Finishes",
    items: [
      { csiCode: "09 21 16", name: "Gypsum Board — Hang & Finish" },
      { csiCode: "09 30 13", name: "Backsplash Tile — Supply & Installation (Thinset & Grout Included)" },
      { csiCode: "09 30 13", name: "Kitchen Floor Tile — Supply & Installation (if applicable)" },
      { csiCode: "09 64 00", name: "Hardwood Flooring — Supply & Installation (if applicable)" },
      { csiCode: "09 65 00", name: "LVP / LVT Flooring — Supply & Installation (if applicable)" },
      { csiCode: "09 91 23", name: "Interior Painting — Walls & Ceiling" },
    ],
  },
  {
    csiCode: "11 00 00",
    name: "Equipment (Appliances)",
    items: [
      { csiCode: "11 31 13", name: "Refrigerator — Supply & Installation" },
      { csiCode: "11 31 16", name: "Range / Oven — Supply & Installation" },
      { csiCode: "11 31 26", name: "Range Hood — Supply & Installation" },
      { csiCode: "11 31 19", name: "Dishwasher — Supply & Installation" },
      { csiCode: "11 31 23", name: "Microwave / Built-In Oven — Supply & Installation" },
    ],
  },
  {
    csiCode: "12 00 00",
    name: "Furnishings",
    items: [
      { csiCode: "12 36 61", name: "Quartz / Solid Surface Countertops — Supply & Installation" },
      { csiCode: "12 36 40", name: "Natural Stone Countertops (Granite / Marble) — Supply & Installation" },
      { csiCode: "12 36 23", name: "Plastic-Laminate Countertops — Supply & Installation (if applicable)" },
    ],
  },
  {
    csiCode: "22 00 00",
    name: "Plumbing",
    items: [
      { csiCode: "22 05 00", name: "Plumbing General — Permits & Rough-In Inspection" },
      { csiCode: "22 11 16", name: "Water Distribution Piping — Supply Lines, Shut-Offs & Ice Maker Connection" },
      { csiCode: "22 13 16", name: "Sanitary Waste Piping — Drain & Vent Modification" },
      { csiCode: "22 42 16", name: "Kitchen Sink & Faucet — Supply & Installation" },
      { csiCode: "22 40 00", name: "Garbage Disposal — Supply & Installation" },
    ],
  },
  {
    csiCode: "23 00 00",
    name: "HVAC / Mechanical",
    items: [
      { csiCode: "23 31 00", name: "Range Hood Ductwork — Fabrication, Routing & Exterior Exhaust Penetration" },
    ],
  },
  {
    csiCode: "26 00 00",
    name: "Electrical",
    items: [
      { csiCode: "26 05 33", name: "Electrical Rough-In — Dedicated Circuits (Range, Dishwasher, Refrigerator, Disposal)" },
      { csiCode: "26 27 26", name: "Countertop GFCI Receptacles — Supply & Install" },
      { csiCode: "26 27 16", name: "Dimmer Switches & Lighting Controls — Supply & Install" },
      { csiCode: "26 51 13", name: "Under-Cabinet Lighting — Supply & Install" },
      { csiCode: "26 51 13", name: "Recessed Lighting / Pendant Fixtures — Supply & Install" },
    ],
  },
];
