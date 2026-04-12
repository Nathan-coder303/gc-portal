import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { google } from "googleapis";
import { STANDARD_TEMPLATE_DIVISIONS } from "@/lib/standardTemplateData";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export const runtime = "nodejs";
export const maxDuration = 120;

const PLANHUB_EMAIL = "projectnotification@planhub.com";

const CANONICAL_DIVISIONS = STANDARD_TEMPLATE_DIVISIONS.map(d => ({ code: d.csiCode, name: d.name }));

/** Normalize a divisionCode to the canonical "XX 00 00" format */
function normalizeDivision(code: string, name: string): { code: string; name: string } {
  const exact = CANONICAL_DIVISIONS.find(d => d.code === code);
  if (exact) return { code: exact.code, name: exact.name };
  // Match by first two digits
  const digits = code.replace(/\D/g, "");
  const prefix = digits.slice(0, 2).padStart(2, "0");
  const byPrefix = CANONICAL_DIVISIONS.find(d => d.code.startsWith(prefix + " "));
  if (byPrefix) return { code: byPrefix.code, name: byPrefix.name };
  return { code, name };
}
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

/** Parse gmail:msgId:attachmentId and return PDF buffer via Gmail API */
async function fetchGmailPdf(fileUrl: string): Promise<Buffer | null> {
  if (!fileUrl.startsWith("gmail:")) return null;
  const parts = fileUrl.split(":");
  const msgId = parts[1];
  const attachmentId = parts[2];
  if (!msgId || !attachmentId) return null;
  try {
    const gmail = google.gmail({ version: "v1", auth: getOAuthClient() });
    const attRes = await gmail.users.messages.attachments.get({ userId: "me", messageId: msgId, id: attachmentId });
    const b64 = (attRes.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

type PdfData = { emails: string[]; phones: string[] };

async function extractFromPdf(fileUrl: string | null): Promise<PdfData> {
  if (!fileUrl) return { emails: [], phones: [] };
  try {
    const buf = await fetchGmailPdf(fileUrl);
    if (!buf) return { emails: [], phones: [] };
    const data = await pdfParse(buf);
    const text: string = data.text;

    const emailSeen = new Set<string>();
    const emails = (text.match(EMAIL_REGEX) ?? []).filter(e => {
      const l = e.toLowerCase();
      if (l.includes("planhub") || emailSeen.has(l)) return false;
      emailSeen.add(l);
      return true;
    });

    // Extract phone numbers and normalize to (XXX) XXX-XXXX
    const phoneSeen = new Set<string>();
    const phones: string[] = [];
    let m: RegExpExecArray | null;
    const phoneRe = new RegExp(PHONE_REGEX.source, "g");
    while ((m = phoneRe.exec(text)) !== null) {
      const normalized = `(${m[1]}) ${m[2]}-${m[3]}`;
      if (!phoneSeen.has(normalized)) { phoneSeen.add(normalized); phones.push(normalized); }
    }

    return { emails, phones };
  } catch {
    return { emails: [], phones: [] };
  }
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const session = await auth();
  if (!session || session.user.companyId !== params.companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  const bids = await prisma.subBid.findMany({
    where: { companyId: params.companyId, isPlaceholder: false, contractorName: { not: null } },
    select: { contractorName: true, divisionCode: true, divisionName: true, emailSource: true, fileUrl: true },
  });

  const existing = await prisma.subContractor.findMany({
    where: { companyId: params.companyId },
    select: { id: true, name: true, divisionCode: true, email: true, phone: true },
  });
  const existingMap = new Map(existing.map(s => [`${s.name}||${s.divisionCode}`, s]));

  const seen = new Set<string>();
  let imported = 0;
  let refreshed = 0;

  for (const bid of bids) {
    if (!bid.contractorName) continue;
    const { code: divCode, name: divName } = normalizeDivision(bid.divisionCode, bid.divisionName);
    const key = `${bid.contractorName}||${divCode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existingSub = existingMap.get(key);
    const needsEmail = !existingSub?.email || existingSub.email.toLowerCase() === PLANHUB_EMAIL;
    const needsPhone = !existingSub?.phone;
    const isPlanhub = bid.emailSource?.toLowerCase() === PLANHUB_EMAIL;

    if (existingSub) {
      if (!refresh) continue;
      // Only re-process if email or phone is missing
      if (!needsEmail && !needsPhone) continue;

      let email = existingSub.email;
      let phone = existingSub.phone;

      if (isPlanhub && bid.fileUrl && (needsEmail || needsPhone)) {
        const extracted = await extractFromPdf(bid.fileUrl);
        if (needsEmail && extracted.emails.length > 0) email = extracted.emails[0];
        else if (needsEmail) email = null;
        if (needsPhone && extracted.phones.length > 0) phone = extracted.phones[0];
      } else if (needsEmail && bid.emailSource && !isPlanhub) {
        email = bid.emailSource;
      }

      if (email !== existingSub.email || phone !== existingSub.phone) {
        await prisma.subContractor.update({ where: { id: existingSub.id }, data: { email, phone } });
        refreshed++;
      }
    } else {
      // New sub — import with email + phone from PDF if planhub
      let email = bid.emailSource ?? null;
      let phone: string | null = null;

      if (isPlanhub && bid.fileUrl) {
        const extracted = await extractFromPdf(bid.fileUrl);
        if (extracted.emails.length > 0) email = extracted.emails[0];
        else email = null;
        if (extracted.phones.length > 0) phone = extracted.phones[0];
      }

      await prisma.subContractor.create({
        data: { companyId: params.companyId, name: bid.contractorName, email, phone, divisionCode: divCode, divisionName: divName, notes: null },
      });
      imported++;
    }
  }

  return NextResponse.json({ imported, refreshed });
}
