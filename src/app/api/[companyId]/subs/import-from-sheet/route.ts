import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1681BCKzXM0U82wJm8vEw8QKLPobyAt-wQ8O4DLYtudA/export?format=csv&gid=20049418";

// Comprehensive CSI division number → name map
const CSI_NAMES: Record<string, string> = {
  "01": "General Conditions",
  "02": "Existing Conditions",
  "03": "Concrete",
  "04": "Masonry",
  "05": "Structural Steel",
  "06": "Rough Carpentry",
  "07": "Roofing & Waterproofing",
  "08": "Doors & Windows",
  "09": "Finishes",
  "10": "Specialties",
  "11": "Equipment",
  "12": "Furnishings",
  "13": "Special Construction",
  "14": "Conveying Equipment",
  "21": "Fire Suppression",
  "22": "Plumbing",
  "23": "HVAC / Mechanical",
  "25": "Integrated Automation",
  "26": "Electrical",
  "27": "Communications / Low Voltage",
  "28": "Electronic Safety & Security",
  "31": "Earthwork",
  "32": "Site Work",
  "33": "Utilities",
  "34": "Transportation",
  "35": "Waterway Construction",
  "40": "Process Integration",
  "41": "Material Processing",
};

/** Parse "Div X" or "Div XX" → "XX 00 00" and look up name */
function parseCsiDivision(raw: string): { code: string; name: string } | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^div\.?\s*/i, "").trim();
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return null;
  const padded = String(num).padStart(2, "0");
  const code = `${padded} 00 00`;
  const name = CSI_NAMES[padded] ?? `Division ${padded}`;
  return { code, name };
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

  const csvRes = await fetch(SHEET_CSV_URL);
  if (!csvRes.ok) return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 502 });
  const csvText = await csvRes.text();

  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return NextResponse.json({ imported: 0, skipped: 0 });

  // Parse header to find column indices
  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
  const idxName = headers.findIndex(h => h.includes("company") || h.includes("name"));
  const idxCsi = headers.findIndex(h => h.includes("csi") || h.includes("division"));
  const idxEmail = headers.findIndex(h => h.includes("email"));
  const idxPhone = headers.findIndex(h => h.includes("phone"));

  if (idxName === -1 || idxCsi === -1) {
    return NextResponse.json({ error: `Could not find required columns. Headers found: ${headers.join(", ")}` }, { status: 400 });
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
    const csiRaw = idxCsi >= 0 ? cols[idxCsi]?.trim() : "";
    const email = idxEmail >= 0 ? cols[idxEmail]?.trim() || null : null;
    const phone = idxPhone >= 0 ? cols[idxPhone]?.trim() || null : null;

    if (!name || !csiRaw) { skipped++; continue; }

    const div = parseCsiDivision(csiRaw);
    if (!div) { skipped++; continue; }

    const key = `${name.toLowerCase()}||${div.code}`;
    if (existingKeys.has(key)) { skipped++; continue; }
    existingKeys.add(key);

    const cleanEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;

    await prisma.subContractor.create({
      data: {
        companyId: params.companyId,
        name,
        email: cleanEmail,
        phone: phone || null,
        divisionCode: div.code,
        divisionName: div.name,
        notes: null,
      },
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
