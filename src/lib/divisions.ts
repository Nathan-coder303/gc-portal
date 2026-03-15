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

/** CSI codes for specific item names */
export const ITEM_CSI_LOOKUP: Record<string, string> = {
  // Division 01 — General Requirements
  "site superintendent":                    "01 10 00",
  "safety officer":                         "01 10 00",
  "pm / admin":                             "01 10 00",
  "pm/admin":                               "01 10 00",
  "project manager":                        "01 10 00",
  "general conditions":                     "01 10 00",
  "project supervision":                    "01 10 00",
  "permits & municipal fees":               "01 32 00",
  "permits":                                "01 32 00",
  "building permits":                       "01 32 00",
  "temporary power":                        "01 50 00",
  "portable toilets":                       "01 50 00",
  "site fencing":                           "01 50 00",
  "temporary facilities":                   "01 50 00",
  "dumpster (2 pulls)":                     "01 74 00",
  "dumpster":                               "01 74 00",
  "final cleaning":                         "01 74 00",
  "construction waste management":          "01 74 00",
  "debris removal & disposal":              "01 74 00",
  "debris removal":                         "01 74 00",
  // Division 02 — Existing Conditions / Demolition
  "demolition existing wood structure":     "02 41 00",
  "site demolition & clearing":             "02 41 00",
  "selective demolition":                   "02 41 00",
  "demo":                                   "02 41 00",
  // Division 03 — Concrete
  "footings & foundation walls":            "03 30 00",
  "slab on grade":                          "03 30 00",
  "concrete slab":                          "03 30 00",
  "cast-in-place concrete":                 "03 30 00",
  "concrete foundations":                   "03 30 00",
  "reinforcing steel":                      "03 20 00",
  "rebar":                                  "03 20 00",
  "concrete steps":                         "03 41 00",
  "concrete patio / apron":                 "32 13 13",
  "concrete flatwork":                      "32 13 13",
  "concrete paving":                        "32 13 13",
  // Division 05 — Metals
  "structural steel":                       "05 10 00",
  "structural beams / headers":             "05 10 00",
  "structural beams":                       "05 10 00",
  "steel beams":                            "05 10 00",
  "misc metals":                            "05 50 00",
  "misc framing hardware":                  "06 10 00",
  // Division 06 — Wood, Plastics & Composites
  "framing labor & material":               "06 10 00",
  "rough framing":                          "06 10 00",
  "exterior sheathing":                     "06 10 00",
  "hurricane straps & hardware":            "06 10 00",
  "blocking":                               "06 10 00",
  "fascia / soffit":                        "06 22 13",
  "fascia":                                 "06 22 13",
  "soffit":                                 "06 22 13",
  "corner boards":                          "06 22 13",
  "trim boards":                            "06 22 13",
  "interior door casings":                  "06 22 13",
  "base molding":                           "06 22 13",
  "window stools & aprons":                 "06 22 13",
  "crown molding (optional)":               "06 22 13",
  "crown molding":                          "06 22 13",
  "baseboard trim":                         "06 22 13",
  "kitchen cabinets":                       "06 41 00",
  "cabinets":                               "06 41 00",
  "bathroom vanity cabinets":               "06 41 16",
  "vanity cabinets":                        "06 41 16",
  // Division 07 — Thermal & Moisture Protection
  "shingle roofing (tear-off + install)":   "07 31 00",
  "shingle roofing":                        "07 31 00",
  "asphalt shingles":                       "07 31 00",
  "underlayment & ice shield":              "07 31 00",
  "ridge vent":                             "07 72 00",
  "batt insulation (walls / ceiling)":      "07 21 00",
  "batt insulation":                        "07 21 00",
  "wall & roof insulation":                 "07 21 00",
  "spray foam (rim joist / transitions)":   "07 21 00",
  "spray foam":                             "07 21 00",
  "flashing (step, counter, base)":         "07 62 00",
  "flashing":                               "07 62 00",
  "caulking & sealants":                    "07 92 00",
  "sealants":                               "07 92 00",
  "waterproofing":                          "07 10 00",
  "below-grade waterproofing":              "07 10 00",
  "air barrier / building wrap":            "07 27 00",
  "building wrap":                          "07 27 00",
  "exterior stucco":                        "09 24 00",
  // Division 08 — Openings
  "exterior entry door & hardware":         "08 11 13",
  "exterior entry door":                    "08 11 13",
  "interior doors & hardware":              "08 14 00",
  "interior doors":                         "08 14 00",
  "exterior door frames":                   "08 11 13",
  "windows (installed)":                    "08 51 13",
  "windows":                                "08 51 13",
  "window screens & accessories":           "08 51 13",
  "door hardware":                          "08 71 00",
  "garage door":                            "08 33 23",
  "roll-up door":                           "08 33 23",
  "glass shower enclosures":               "08 83 13",
  // Division 09 — Finishes
  "drywall hang & finish (level 4)":        "09 29 00",
  "drywall hang & finish":                  "09 29 00",
  "drywall":                                "09 29 00",
  "gwb framing & drywall":                  "09 29 00",
  "blueboard & skim coat (optional)":       "09 29 00",
  "blueboard & skim coat":                  "09 29 00",
  "bathroom tile (floor / wall)":           "09 30 00",
  "bathroom tile":                          "09 30 00",
  "kitchen backsplash":                     "09 30 00",
  "tile":                                   "09 30 00",
  "porcelain tile":                         "09 30 00",
  "hardwood (install + sand + finish)":     "09 64 00",
  "engineered hardwood":                    "09 64 00",
  "hardwood":                               "09 64 00",
  "lvp / lvt":                              "09 65 00",
  "lvp":                                    "09 65 00",
  "vinyl plank":                            "09 65 00",
  "carpet":                                 "09 68 00",
  "interior paint (walls / ceilings / trim)": "09 91 00",
  "interior paint":                         "09 91 00",
  "paint":                                  "09 91 00",
  "exterior paint / stain":                 "09 96 00",
  "exterior paint":                         "09 96 00",
  "primer coat":                            "09 91 00",
  // Division 10 — Specialties
  "bathroom accessories (tp holder, towel bars)": "10 28 00",
  "bathroom accessories":                   "10 28 00",
  "medicine cabinet":                       "10 28 00",
  "mirrors":                                "10 28 16",
  "bathroom mirrors":                       "10 28 16",
  // Division 12 — Furnishings
  "kitchen countertops":                    "12 36 61",
  "countertops":                            "12 36 61",
  "bathroom vanity tops":                   "12 36 61",
  // Division 21 — Fire Suppression
  "fire sprinkler system":                  "21 13 00",
  "fire sprinklers":                        "21 13 00",
  // Division 22 — Plumbing
  "rough plumbing":                         "22 00 00",
  "finish plumbing (fixtures)":             "22 00 00",
  "finish plumbing":                        "22 00 00",
  "plumbing rough-in":                      "22 00 00",
  "water heater":                           "22 33 00",
  "water heaters":                          "22 33 00",
  "soaking tub":                            "22 41 39",
  "bathtub":                                "22 41 39",
  "toilet":                                 "22 42 13",
  "water closets":                          "22 42 13",
  "kitchen sink":                           "22 42 16",
  "lavatory":                               "22 42 16",
  "shower valve":                           "22 42 39",
  "faucets":                                "22 42 39",
  // Division 23 — HVAC
  "hvac equipment & install":               "23 81 26",
  "hvac equipment":                         "23 81 26",
  "ductwork & registers":                   "23 31 00",
  "ductwork":                               "23 31 00",
  "thermostat":                             "23 09 00",
  "programmable thermostats":               "23 09 00",
  "exhaust fans":                           "23 34 00",
  // Division 26 — Electrical
  "electrical panel upgrade":               "26 24 13",
  "main distribution panel":               "26 24 13",
  "rough wiring & boxes":                   "26 27 26",
  "rough wiring":                           "26 27 26",
  "branch wiring":                          "26 27 26",
  "devices & cover plates":                 "26 27 26",
  "outlets & switches":                     "26 27 26",
  "fixtures & lighting":                    "26 51 00",
  "lighting fixtures":                      "26 51 00",
  "ceiling fans":                           "26 51 00",
  "fire alarm system":                      "28 31 00",
  // Division 31 — Earthwork
  "excavation":                             "31 20 00",
  "earthwork & grading":                    "31 20 00",
  "grading":                                "31 20 00",
  "excavation export & haul-off":           "31 25 00",
  // Division 32 — Exterior Improvements
  "landscape planting":                     "32 80 00",
  "irrigation system":                      "32 84 00",
  // Division 33 — Utilities
  "site drainage":                          "33 40 00",
  "utility connections":                    "33 40 00",
};

/** Returns the CSI code for an item name, or undefined if not found */
export function lookupItemCsiCode(name: string): string | undefined {
  return ITEM_CSI_LOOKUP[name.toLowerCase().trim()];
}
