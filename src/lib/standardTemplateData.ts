/** Standard CSI MasterFormat divisions and items for a new Addition/Remodel template */
export const STANDARD_TEMPLATE_DIVISIONS: {
  csiCode: string;
  name: string;
  items: { csiCode: string; name: string }[];
}[] = [
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
    name: "Structural Steel",
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
    name: "Rough Carpentry",
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
    name: "Roofing & Waterproofing",
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
    name: "Doors & Windows",
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
    csiCode: "32 00 00",
    name: "Site Work",
    items: [
      { csiCode: "32 13 13", name: "Concrete Paving" },
      { csiCode: "32 31 00", name: "Fences and Gates" },
      { csiCode: "32 92 00", name: "Turf and Grasses" },
    ],
  },
];
