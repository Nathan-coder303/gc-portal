import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1n4wWSjBMdFFxlp3m6JYQA_moKvwqAK29DXNR5NrriFg/export?format=csv&gid=1792561800";

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  // Parse a single CSV line respecting quoted fields
  function parseLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "_"));
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the sheet
  let csvText: string;
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
  } catch (e) {
    return NextResponse.json({ error: `Failed to fetch sheet: ${e}` }, { status: 502 });
  }

  // Filter out rows where name is clearly not a person/company name
  // (e.g. property descriptions like "500 sq ft", "living in Florida...")
  function looksLikeName(n: string): boolean {
    if (!n || n.trim().length < 2) return false;
    if (/\d+\s*(sq\s*ft|sqft|lot|acre)/i.test(n)) return false; // property measurement
    if (/^(living|located|built|property|home|house|roof)/i.test(n)) return false; // description sentence
    if (/^[\d\s,.()\-]+$/.test(n)) return false; // only numbers/punctuation
    return true;
  }
  const rows = parseCSV(csvText).filter((r) => r.name && looksLikeName(r.name.trim()));

  if (rows.length === 0) {
    return NextResponse.json({ added: 0, skipped: 0, message: "No data rows found in sheet" });
  }

  // Load existing leads to deduplicate
  const existing = await prisma.lead.findMany({
    where: { companyId: params.companyId },
    select: { name: true, phone: true, email: true },
  });

  const existingNames  = new Set(existing.map((l) => normalize(l.name)));
  const existingPhones = new Set(existing.map((l) => normalize(l.phone)).filter(Boolean));
  const existingEmails = new Set(existing.map((l) => normalize(l.email)).filter(Boolean));

  let added = 0;
  let skipped = 0;
  const skippedNames: string[] = [];

  for (const row of rows) {
    const name  = row.name?.trim() || null;
    const phone = row.number?.trim() || null;
    const email = row.email?.trim() || null;
    const addr  = row.address?.trim() || null;
    const notes = [row.notes, row.mike_s_notes, row.status]
      .filter(Boolean)
      .join(" | ")
      .trim() || null;

    if (!name) continue;

    // Skip duplicates — match on name OR phone OR email
    const isDup =
      existingNames.has(normalize(name)) ||
      (phone && existingPhones.has(normalize(phone))) ||
      (email && existingEmails.has(normalize(email)));

    if (isDup) {
      skipped++;
      skippedNames.push(name);
      continue;
    }

    // Parse address into parts if possible
    // Format: "123 Street City STATE ZIP" — best effort
    let address = addr;
    let city: string | null = null;
    let state: string | null = null;

    if (addr) {
      // Try to detect city/state at the end: "... Hollywood FL" or "... Davie 33325"
      const cityStateMatch = addr.match(/^(.*?),?\s+([A-Za-z\s]+?)(?:\s+([A-Z]{2}))?\s*(\d{5})?$/);
      if (cityStateMatch) {
        address = cityStateMatch[1]?.trim() || addr;
        city    = cityStateMatch[2]?.trim() || null;
        state   = cityStateMatch[3]?.trim() || null;
      }
    }

    await prisma.lead.create({
      data: {
        companyId: params.companyId,
        name,
        phone,
        email,
        address,
        city,
        state,
        message: notes,
        source:  "fyrd_up",
        status:  "NEW",
      },
    });

    // Track for dedup within this batch
    existingNames.add(normalize(name));
    if (phone) existingPhones.add(normalize(phone));
    if (email) existingEmails.add(normalize(email));

    added++;
  }

  return NextResponse.json({
    added,
    skipped,
    skippedNames,
    message: `${added} new leads imported · ${skipped} duplicates skipped`,
  });
}
