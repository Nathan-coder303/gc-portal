export const STANDARD_DIVISIONS = [
  { code: "01", name: "General Conditions" },
  { code: "02", name: "Site Work" },
  { code: "03", name: "Concrete" },
  { code: "04", name: "Masonry" },
  { code: "05", name: "Structural Steel" },
  { code: "06", name: "Rough Carpentry" },
  { code: "07", name: "Roofing & Waterproofing" },
  { code: "08", name: "Doors & Windows" },
  { code: "09", name: "Finishes" },
  { code: "10", name: "Specialties" },
  { code: "11", name: "HVAC / Mechanical" },
  { code: "15", name: "Plumbing" },
  { code: "16", name: "Electrical" },
  { code: "18", name: "Cabinetry & Millwork" },
] as const;

/** Full CSI MasterFormat codes keyed by normalized division name */
export const CSI_CODE_LOOKUP: Record<string, string> = {
  // Division 01 — General Requirements
  "general conditions":                  "01 00 00",
  "general requirements":                "01 00 00",
  // Division 02 — Existing Conditions / Demolition
  "existing conditions":                 "02 00 00",
  "demolition":                          "02 41 00",
  // Division 03 — Concrete
  "concrete":                            "03 00 00",
  // Division 04 — Masonry
  "masonry":                             "04 00 00",
  // Division 05 — Metals
  "structural steel":                    "05 00 00",
  "metals":                              "05 00 00",
  "structural steel / metals":           "05 00 00",
  // Division 06 — Wood, Plastics & Composites
  "rough carpentry":                     "06 00 00",
  "wood":                                "06 00 00",
  "carpentry":                           "06 00 00",
  "wood & plastics":                     "06 00 00",
  "wood and plastics":                   "06 00 00",
  "wood, plastics & composites":         "06 00 00",
  "wood plastics and composites":        "06 00 00",
  "cabinetry & millwork":                "06 40 00",
  "cabinetry and millwork":              "06 40 00",
  "millwork":                            "06 40 00",
  "casework":                            "06 40 00",
  "interior trim & millwork":            "06 40 00",
  "interior trim and millwork":          "06 40 00",
  // Division 07 — Thermal & Moisture Protection
  "roofing & waterproofing":             "07 00 00",
  "roofing and waterproofing":           "07 00 00",
  "roofing":                             "07 00 00",
  "waterproofing":                       "07 00 00",
  "thermal and moisture":                "07 00 00",
  "thermal & moisture protection":       "07 00 00",
  "thermal and moisture protection":     "07 00 00",
  "insulation":                          "07 00 00",
  // Division 08 — Openings
  "doors & windows":                     "08 00 00",
  "doors and windows":                   "08 00 00",
  "openings":                            "08 00 00",
  "windows":                             "08 00 00",
  "doors":                               "08 00 00",
  // Division 09 — Finishes
  "finishes":                            "09 00 00",
  "flooring":                            "09 00 00",
  "painting":                            "09 90 00",
  "drywall":                             "09 29 00",
  "gypsum":                              "09 29 00",
  // Division 10 — Specialties
  "specialties":                         "10 00 00",
  // Division 11 — Equipment
  "equipment":                           "11 00 00",
  // Division 12 — Furnishings
  "furnishings":                         "12 00 00",
  // Division 22 — Plumbing
  "plumbing":                            "22 00 00",
  // Division 23 — HVAC
  "hvac":                                "23 00 00",
  "hvac / mechanical":                   "23 00 00",
  "hvac/mechanical":                     "23 00 00",
  "mechanical":                          "23 00 00",
  "hvac mechanical":                     "23 00 00",
  // Division 26 — Electrical
  "electrical":                          "26 00 00",
  // Division 31 — Earthwork / Site Work
  "site work":                           "31 00 00",
  "sitework":                            "31 00 00",
  "earthwork":                           "31 00 00",
  "grading":                             "31 00 00",
};

/**
 * Upgrade old short codes (01, 03, 16…) to full CSI codes using the division name.
 * Falls back to a code-only mapping if the name isn't in the lookup.
 */
const SHORT_CODE_UPGRADE: Record<string, string> = {
  "01": "01 00 00",
  "02": "31 00 00",
  "03": "03 00 00",
  "04": "04 00 00",
  "05": "05 00 00",
  "06": "06 00 00",
  "07": "07 00 00",
  "08": "08 00 00",
  "09": "09 00 00",
  "10": "10 00 00",
  "11": "11 00 00",
  "12": "12 00 00",
  "15": "22 00 00", // Plumbing
  "16": "26 00 00", // Electrical
  "18": "06 40 00", // Cabinetry & Millwork
  "22": "22 00 00",
  "23": "23 00 00",
  "26": "26 00 00",
  "31": "31 00 00",
};

/** Returns true if the code is a legacy short code that needs upgrading */
function isShortCode(code: string): boolean {
  return /^\d{1,2}$/.test(code.trim());
}

/** Returns the proper full CSI code for a division, or undefined if already correct / not found */
export function getCorrectCsiCode(name: string, currentCode: string | null): string | undefined {
  // Name-based lookup always wins (most accurate)
  const byName = CSI_CODE_LOOKUP[name.toLowerCase().trim()];
  if (byName) {
    return byName === currentCode ? undefined : byName;
  }
  // Upgrade old short codes
  if (currentCode && isShortCode(currentCode)) {
    const upgraded = SHORT_CODE_UPGRADE[currentCode.trim()];
    return upgraded ?? undefined;
  }
  return undefined;
}

/** Returns the CSI code for a division name, or undefined if not found */
export function lookupCsiCode(name: string): string | undefined {
  return CSI_CODE_LOOKUP[name.toLowerCase().trim()];
}
