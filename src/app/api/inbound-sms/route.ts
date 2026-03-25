import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

export const runtime = "nodejs";

const ALLOWED_FROM   = process.env.SMS_LEAD_SOURCE_NUMBER ?? "+15618676301";
const COMPANY_ID     = process.env.SMS_COMPANY_ID ?? "";
const AUTH_TOKEN     = process.env.TWILIO_AUTH_TOKEN ?? "";

// ── parser ────────────────────────────────────────────────────────────────────

function field(body: string, key: string): string | null {
  // Matches "Key: value" up to the next newline
  const re = new RegExp(`^${key}:\\s*(.+)$`, "im");
  const m  = body.match(re);
  return m ? m[1].trim() : null;
}

function multilineField(body: string, key: string): string | null {
  // Captures everything after "Key:" until end of string or next "Key:" line
  const re = new RegExp(`^${key}:\\s*([\\s\\S]*?)(?=\\n[A-Za-z ]+:|$)`, "im");
  const m  = body.match(re);
  const val = m?.[1]?.trim();
  return val || null;
}

function parseFunnelLead(body: string): {
  name:    string | null;
  phone:   string | null;
  email:   string | null;
  address: string | null;
  notes:   string | null;
} {
  const name    = field(body, "Name");
  const phone   = field(body, "Phone");
  const email   = field(body, "Email");
  const address = field(body, "Address");

  const date    = field(body, "Requested Date");
  const time    = field(body, "Requested Time");
  const recap   = multilineField(body, "Conversation Recap");

  const noteParts: string[] = [];
  if (date)  noteParts.push(`Requested: ${date}${time ? " at " + time : ""}`);
  if (recap) noteParts.push(`Recap: ${recap}`);

  return { name, phone, email, address, notes: noteParts.join(" | ") || null };
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9@.]/g, "").trim();
}

// ── route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate Twilio signature
  if (AUTH_TOKEN) {
    const signature  = req.headers.get("x-twilio-signature") ?? "";
    const url        = req.nextUrl.href;
    const bodyText   = await req.text();
    const params     = Object.fromEntries(new URLSearchParams(bodyText));

    const valid = twilio.validateRequest(AUTH_TOKEN, signature, url, params);
    if (!valid) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Re-parse from already-consumed body
    const from = params["From"] ?? "";
    const body = params["Body"] ?? "";
    return handleMessage(from, body);
  }

  // No auth token yet — read body normally (dev / initial setup)
  const formData = await req.formData().catch(() => null);
  const from = formData?.get("From")?.toString() ?? "";
  const body = formData?.get("Body")?.toString() ?? "";
  return handleMessage(from, body);
}

async function handleMessage(from: string, body: string): Promise<NextResponse> {
  // Only accept messages from the configured lead source number
  const normalizedFrom = from.replace(/\D/g, "");
  const normalizedAllowed = ALLOWED_FROM.replace(/\D/g, "");
  if (normalizedFrom !== normalizedAllowed) {
    // Silently ignore — return empty TwiML
    return twiml("");
  }

  if (!body.includes("[FUNNEL LEAD]")) {
    // Not a lead message — ignore
    return twiml("");
  }

  if (!COMPANY_ID) {
    console.error("SMS_COMPANY_ID env var not set");
    return twiml("");
  }

  const { name, phone, email, address, notes } = parseFunnelLead(body);

  if (!name && !phone && !email) {
    console.warn("Could not parse any fields from SMS lead:", body);
    return twiml("");
  }

  // Deduplicate
  const existing = await prisma.lead.findMany({
    where: { companyId: COMPANY_ID },
    select: { name: true, phone: true, email: true },
  });

  const existingNames  = new Set(existing.map((l) => normalize(l.name)));
  const existingPhones = new Set(existing.map((l) => normalize(l.phone)).filter(Boolean));
  const existingEmails = new Set(existing.map((l) => normalize(l.email)).filter(Boolean));

  const isDup =
    (name  && existingNames.has(normalize(name)))  ||
    (phone && existingPhones.has(normalize(phone))) ||
    (email && existingEmails.has(normalize(email)));

  if (isDup) {
    console.log("SMS lead duplicate skipped:", name);
    return twiml("");
  }

  // Parse city / state from address
  let city:  string | null = null;
  let state: string | null = null;
  let streetAddress = address;

  if (address) {
    // "1810 NW 28th Ave, Fort Lauderdale, FL 33311, ..."
    const m = address.match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s*\d{5}/);
    if (m) {
      streetAddress = m[1]?.trim() || address;
      city          = m[2]?.trim() || null;
      state         = m[3]?.trim() || null;
    }
  }

  await prisma.lead.create({
    data: {
      companyId: COMPANY_ID,
      name:      name ?? "Unknown",
      phone,
      email,
      address:   streetAddress,
      city,
      state,
      message:   notes,
      source:    "funnel",
      status:    "NEW",
    },
  });

  console.log("SMS lead created:", name, phone);
  return twiml("");
}

function twiml(msg: string): NextResponse {
  const body = msg
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
