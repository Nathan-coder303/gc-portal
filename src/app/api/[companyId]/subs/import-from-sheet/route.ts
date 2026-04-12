import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1681BCKzXM0U82wJm8vEw8QKLPobyAt-wQ8O4DLYtudA/export?format=csv&gid=20049418";

// Category keyword → canonical CSI division
const CATEGORY_MAP: { keywords: string[]; code: string; name: string }[] = [
  { keywords: ["demolition", "demo"], code: "02 00 00", name: "Existing Conditions" },
  { keywords: ["shell", "concrete", "foundation", "piles"], code: "03 00 00", name: "Concrete" },
  { keywords: ["masonry", "stucco", "block"], code: "04 00 00", name: "Masonry" },
  { keywords: ["metals", "steel", "structural"], code: "05 00 00", name: "Structural Steel" },
  { keywords: ["millwork", "baseboard", "carpentry", "casework", "cabinet", "trim"], code: "06 00 00", name: "Rough Carpentry" },
  { keywords: ["roof", "roofing", "insulation", "foam", "waterproof", "exterior trim", "exterior trims"], code: "07 00 00", name: "Roofing & Waterproofing" },
  { keywords: ["door", "window", "glass", "glazing", "garage"], code: "08 00 00", name: "Doors & Windows" },
  { keywords: ["drywall", "flooring", "floor", "painting", "painter", "tile", "carpet", "finish", "finishes", "ceiling"], code: "09 00 00", name: "Finishes" },
  { keywords: ["specialt", "awning", "pool", "elevator"], code: "10 00 00", name: "Specialties" },
  { keywords: ["furnishing", "furniture"], code: "12 00 00", name: "Furnishings" },
  { keywords: ["sprinkler", "fire suppression"], code: "21 00 00", name: "Fire Suppression" },
  { keywords: ["plumbing"], code: "22 00 00", name: "Plumbing" },
  { keywords: ["hvac", "mechanical", "air condition", "ac "], code: "23 00 00", name: "HVAC / Mechanical" },
  { keywords: ["electrical", "electric", "generator", "low voltage"], code: "26 00 00", name: "Electrical" },
  { keywords: ["landscaping", "landscape", "paving", "asphalt", "fence", "gate", "site work", "driveway"], code: "32 00 00", name: "Site Work" },
  { keywords: ["cleaning", "general", "permit"], code: "01 00 00", name: "General Conditions" },
];

function categoryToDivision(category: string): { code: string; name: string } {
  const lower = category.toLowerCase().trim();
  for (const entry of CATEGORY_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return { code: entry.code, name: entry.name };
    }
  }
  // Default to General Conditions if unknown
  return { code: "01 00 00", name: "General Conditions" };
}

/** Simple CSV row parser that handles quoted fields */
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(_req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the public Google Sheet CSV
  const csvRes = await fetch(SHEET_CSV_URL);
  if (!csvRes.ok) return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 502 });
  const csvText = await csvRes.text();

  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return NextResponse.json({ imported: 0, skipped: 0 });

  // Parse header row to find column indices
  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
  const idxName = headers.findIndex(h => h.includes("company") || h.includes("name"));
  const idxCat = headers.findIndex(h => h.includes("category"));
  const idxEmail = headers.findIndex(h => h.includes("email"));
  const idxPhone = headers.findIndex(h => h.includes("phone"));

  if (idxName === -1 || idxCat === -1) {
    return NextResponse.json({ error: "Could not find required columns" }, { status: 400 });
  }

  // Load existing subs for dedup
  const existing = await prisma.subContractor.findMany({
    where: { companyId: params.companyId },
    select: { name: true, divisionCode: true },
  });
  const existingKeys = new Set(existing.map(s => `${s.name.toLowerCase()}||${s.divisionCode}`));

  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const name = idxName >= 0 ? cols[idxName]?.trim() : "";
    const category = idxCat >= 0 ? cols[idxCat]?.trim() : "";
    const email = idxEmail >= 0 ? cols[idxEmail]?.trim() || null : null;
    const phone = idxPhone >= 0 ? cols[idxPhone]?.trim() || null : null;

    if (!name || !category) { skipped++; continue; }

    const { code, name: divName } = categoryToDivision(category);
    const key = `${name.toLowerCase()}||${code}`;

    if (existingKeys.has(key)) { skipped++; continue; }
    existingKeys.add(key);

    // Normalize email
    const cleanEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;

    await prisma.subContractor.create({
      data: {
        companyId: params.companyId,
        name,
        email: cleanEmail,
        phone: phone || null,
        divisionCode: code,
        divisionName: divName,
        notes: null,
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
