import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export const runtime = "nodejs";

const PLANHUB_EMAIL = "projectnotification@planhub.com";
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Fetch a PDF from a Vercel Blob URL and extract all email addresses from its text */
async function extractEmailsFromPdf(fileUrl: string): Promise<string[]> {
  try {
    const res = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!res.ok) return [];
    const buf = Buffer.from(await res.arrayBuffer());
    const data = await pdfParse(buf);
    const matches: string[] = data.text.match(EMAIL_REGEX) ?? [];
    const seen = new Set<string>();
    return matches.filter(e => {
      const l = e.toLowerCase();
      if (l.includes("planhub") || seen.has(l)) return false;
      seen.add(l);
      return true;
    });
  } catch {
    return [];
  }
}

async function resolveEmail(emailSource: string | null, fileUrl: string | null): Promise<string | null> {
  let email = emailSource ?? null;
  if (email?.toLowerCase() === PLANHUB_EMAIL && fileUrl) {
    const found = await extractEmailsFromPdf(fileUrl);
    email = found.length > 0 ? found[0] : null;
  }
  return email;
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  // Get all non-placeholder sub bids with a contractor name for this company
  const bids = await prisma.subBid.findMany({
    where: {
      companyId: params.companyId,
      isPlaceholder: false,
      contractorName: { not: null },
    },
    select: { contractorName: true, divisionCode: true, divisionName: true, emailSource: true, fileUrl: true },
  });

  // Get existing subs
  const existing = await prisma.subContractor.findMany({
    where: { companyId: params.companyId },
    select: { id: true, name: true, divisionCode: true, email: true },
  });
  const existingMap = new Map(existing.map(s => [`${s.name}||${s.divisionCode}`, s]));

  const seen = new Set<string>();
  let imported = 0;
  let refreshed = 0;

  for (const bid of bids) {
    if (!bid.contractorName) continue;
    const key = `${bid.contractorName}||${bid.divisionCode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existingSub = existingMap.get(key);

    if (existingSub) {
      // Refresh: re-resolve PlanHub email if current email is null or still planhub
      if (refresh && (!existingSub.email || existingSub.email.toLowerCase() === PLANHUB_EMAIL)) {
        const email = await resolveEmail(bid.emailSource, bid.fileUrl);
        if (email && email !== existingSub.email) {
          await prisma.subContractor.update({ where: { id: existingSub.id }, data: { email } });
          refreshed++;
        }
      }
    } else {
      // New — import
      const email = await resolveEmail(bid.emailSource, bid.fileUrl);
      await prisma.subContractor.create({
        data: {
          companyId: params.companyId,
          name: bid.contractorName,
          email,
          phone: null,
          divisionCode: bid.divisionCode,
          divisionName: bid.divisionName,
          notes: null,
        },
      });
      imported++;
    }
  }

  return NextResponse.json({ imported, refreshed });
}
