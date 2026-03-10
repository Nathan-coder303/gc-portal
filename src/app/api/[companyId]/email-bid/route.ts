import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { STANDARD_DIVISIONS } from "@/lib/divisions";

export const runtime = "nodejs";

// Webhook for inbound email (Mailgun/SendGrid format)
// Set your email service to POST to: /api/[companyId]/email-bid
export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  // Verify secret
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  // body.subject, body.bodyText, body.from, body.attachments (array of {filename, url})
  const { subject = "", bodyText = "", from = "", clientAddress = "", attachments = [] } = body;

  // Find client by address match
  const clients = await prisma.client.findMany({
    where: { companyId: params.companyId },
    select: { id: true, name: true, address: true },
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Use AI to parse the email
  const prompt = `You are parsing a construction subcontractor bid email.

Email from: ${from}
Subject: ${subject}
Body: ${bodyText.slice(0, 3000)}
Client address hint: ${clientAddress}

Available clients: ${clients.map((c) => `${c.name} (${c.address ?? "no address"})`).join(", ")}

Available divisions: ${STANDARD_DIVISIONS.map((d) => `${d.code} - ${d.name}`).join(", ")}

Extract:
1. Which client this bid is for (match by address in subject/body)
2. Which division this bid covers (best match from the list)
3. Contractor/company name (from sender)
4. Bid amount (number only, no $ sign)
5. Any notes

Respond with JSON only:
{"clientId": "...", "divisionCode": "...", "contractorName": "...", "amount": 12345.00, "notes": "..."}
If you cannot determine something, use null.`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ""));

    if (!parsed.clientId || !parsed.divisionCode) {
      return NextResponse.json({ status: "skipped", reason: "could not determine client or division" });
    }

    // Find matching client
    const client = clients.find((c) => c.id === parsed.clientId || c.name === parsed.clientId);
    if (!client) return NextResponse.json({ status: "skipped", reason: "client not found" });

    // Find matching division
    const division = STANDARD_DIVISIONS.find((d) => d.code === parsed.divisionCode);
    if (!division) return NextResponse.json({ status: "skipped", reason: "division not found" });

    const fileUrl = attachments[0]?.url ?? null;
    const fileName = attachments[0]?.filename ?? null;

    await prisma.subBid.create({
      data: {
        clientId: client.id,
        companyId: params.companyId,
        divisionCode: division.code,
        divisionName: division.name,
        contractorName: parsed.contractorName,
        amount: parsed.amount,
        notes: parsed.notes,
        fileUrl,
        fileName,
        status: "RECEIVED",
        emailSource: from,
        isPlaceholder: false,
      },
    });

    return NextResponse.json({ status: "ok", client: client.name, division: division.name, amount: parsed.amount });
  } catch (e) {
    return NextResponse.json({ status: "error", error: String(e) }, { status: 500 });
  }
}
