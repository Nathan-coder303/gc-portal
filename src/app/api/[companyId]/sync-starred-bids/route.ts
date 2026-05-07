/**
 * POST /api/[companyId]/sync-starred-bids
 *
 * Reads starred + bid-platform emails in Gmail, uses AI to extract project info,
 * auto-creates Client records as needed, then creates SubBid records.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { STANDARD_DIVISIONS } from "@/lib/divisions";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 60;

function decodeBase64(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64(payload.body.data).toString("utf-8");
  if (payload.parts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collect = (parts: any[]) => { for (const p of parts) { all.push(p); if (p.parts) collect(p.parts); } };
    collect(payload.parts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain = all.find((p: any) => p.mimeType === "text/plain" && p.body?.data);
    if (plain) return decodeBase64(plain.body.data).toString("utf-8");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = all.find((p: any) => p.mimeType === "text/html" && p.body?.data);
    if (html) return decodeBase64(html.body.data).toString("utf-8")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

/** Strip non-ASCII characters so the prompt doesn't crash ByteString conversion in fetch */
function toAscii(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, " ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPdfParts(payload: any): any[] {
  if (!payload) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  if (
    payload.mimeType === "application/pdf" ||
    (payload.mimeType === "application/octet-stream" && payload.filename?.endsWith(".pdf")) ||
    payload.filename?.endsWith(".pdf")
  ) {
    results.push(payload);
  }
  if (payload.parts) for (const p of payload.parts) results.push(...extractPdfParts(p));
  return results;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
  const gmail = google.gmail({ version: "v1", auth: await getGmailOAuth(params.companyId) });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Load existing clients (may be empty — we'll auto-create as needed)
  const existingClients = await prisma.client.findMany({
    where: { companyId: params.companyId },
    select: { id: true, name: true, address: true, city: true, state: true },
  });

  // Load all already-imported gmail msg IDs to dedup
  const existingBids = await prisma.subBid.findMany({
    where: { companyId: params.companyId, fileUrl: { startsWith: "gmail:" } },
    select: { fileUrl: true },
  });
  const processedMsgIds = new Set(
    existingBids.map(b => b.fileUrl!.split(":")[1]).filter(Boolean)
  );

  const BID_QUERY = [
    "from:projectnotification@planhub.com after:2021/01/01",
    "from:noreply@buildingconnected.com",
    "from:noreply@smartbid.net",
    "is:starred",
    "label:7729-bids",
  ].join(" OR ");

  const allMessages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: BID_QUERY,
      maxResults: 100,
      pageToken,
    });
    allMessages.push(...(listRes.data.messages ?? []));
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken && allMessages.length < 500);

  const newMessages = allMessages.filter(m => m.id && !processedMsgIds.has(m.id));
  const toProcess = newMessages.slice(0, 40);

  const divisionList = STANDARD_DIVISIONS.map(d => `${d.code} - ${d.name}`).join("\n");

  // Build client list string for AI (may be empty on first run)
  const buildClientList = (clients: typeof existingClients) =>
    clients.length > 0
      ? clients.map(c => `${c.id} | ${c.name}${c.address ? ` | ${c.address}` : ""}${c.city ? `, ${c.city}` : ""}`).join("\n")
      : "(none yet - extract project address and name from the email)";

  let added = 0;
  let notBid = 0;
  let noInfo = 0;
  const errors: string[] = [];
  const importedBids: { contractorName: string; projectName: string | null; amount: number | null; division: string }[] = [];
  // Keep a mutable copy so newly-created clients can be matched in the same run
  const clients = [...existingClients];

  for (const msg of toProcess) {
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      const payload = full.data.payload!;
      const headers = payload.headers ?? [];
      const subject = headers.find(h => h.name === "Subject")?.value ?? "";
      const from = headers.find(h => h.name === "From")?.value ?? "";
      const bodyText = extractBody(payload);
      const pdfParts = extractPdfParts(payload);

      // Sanitize to ASCII to avoid ByteString conversion errors in fetch
      const safeSubject = toAscii(subject);
      const safeFrom = toAscii(from);
      const safeBody = toAscii(bodyText).slice(0, 3000);
      const safeClientList = toAscii(buildClientList(clients));

      const prompt = `You are helping a general contractor organize incoming subcontractor bids.

These emails may be:
- A bid/estimate sent directly from a subcontractor
- A bid notification from PlanHub (projectnotification@planhub.com) saying a sub submitted a bid. THESE COUNT AS BIDS.
- A bid notification from BuildingConnected or SmartBid. THESE COUNT AS BIDS.
- A starred email the contractor flagged as a bid

EMAIL FROM: ${safeFrom}
SUBJECT: ${safeSubject}
BODY:
${safeBody}

EXISTING CLIENTS (id | name | address):
${safeClientList}

AVAILABLE CSI DIVISIONS:
${divisionList}

Task:
1. Is this a subcontractor bid, estimate, proposal, or bid notification? (notifications count as bids)
2. Which existing client does it match? Match by street address, street number, or project name.
3. If no client matches, extract the project address and name from the email to create a new client.
4. Which CSI division best describes the work?
5. Bid amount (number only, no $)?
6. Contractor/bidding company name?

Respond ONLY with valid JSON, no markdown:
{
  "isBid": true or false,
  "existingClientId": "<id from existing clients list, or null>",
  "newClientName": "<project name if creating new client, or null>",
  "newClientAddress": "<street address only if creating new client, e.g. '7729 Carlyle Ave', or null>",
  "newClientCity": "<city if creating new client, or null>",
  "newClientState": "<state abbreviation if creating new client, or null>",
  "divisionCode": "<2-digit CSI code, or null>",
  "contractorName": "<bidding company or person name>",
  "amount": <number or null>,
  "notes": "<one sentence describing the scope of work>"
}`;

      const aiMsg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: toAscii(prompt) }],
      });

      const aiText = aiMsg.content[0].type === "text" ? aiMsg.content[0].text.trim() : "{}";
      let parsed: {
        isBid?: boolean;
        existingClientId?: string | null;
        newClientName?: string | null;
        newClientAddress?: string | null;
        newClientCity?: string | null;
        newClientState?: string | null;
        divisionCode?: string | null;
        contractorName?: string;
        amount?: number | null;
        notes?: string;
      };
      try {
        parsed = JSON.parse(aiText.replace(/```json\n?|\n?```/g, ""));
      } catch {
        errors.push(`JSON parse failed for: "${safeSubject.slice(0, 50)}"`);
        continue;
      }

      if (!parsed.isBid) {
        notBid++;
        continue;
      }

      // If there's a PDF attachment, extract amount + date from it for accuracy
      let bidDate: string | null = null;
      if (pdfParts.length > 0 && pdfParts[0].body?.attachmentId) {
        try {
          const attRes = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: msg.id!,
            id: pdfParts[0].body.attachmentId,
          });
          const pdfBase64 = (attRes.data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
          if (pdfBase64) {
            const pdfRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "pdfs-2024-09-25",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 150,
                messages: [{ role: "user", content: [
                  { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                  { type: "text", text: "Extract from this bid/proposal PDF. Respond ONLY with valid JSON: {\"amount\": <grand total as number or null>, \"date\": <proposal date as \"Mon DD, YYYY\" or null>}" },
                ]}],
              }),
            });
            const pdfJson = await pdfRes.json() as { content?: { type: string; text: string }[] };
            const pdfText = pdfJson.content?.[0]?.type === "text" ? pdfJson.content[0].text.trim() : "{}";
            const pdfData = JSON.parse(pdfText.replace(/```json\n?|\n?```/g, ""));
            if (pdfData.amount != null && Number(pdfData.amount) > 0) parsed.amount = Number(pdfData.amount);
            if (pdfData.date && pdfData.date !== "null") bidDate = String(pdfData.date);
          }
        } catch (e) {
          errors.push(`[pdf] ${String(e).slice(0, 60)}`);
        }
      }

      // Resolve which client to use
      let clientId = parsed.existingClientId ?? null;

      // Validate the existingClientId actually exists
      if (clientId && !clients.find(c => c.id === clientId)) {
        clientId = null;
      }

      // Try code-based address match if AI gave no clientId
      if (!clientId) {
        const haystack = (safeSubject + " " + safeBody).toLowerCase();
        for (const c of clients) {
          if (!c.address) continue;
          const parts = c.address.trim().split(/[\s,]+/);
          const streetNum = parts[0];
          const streetWord = parts[1] ?? "";
          if (streetNum.length >= 3 && streetWord.length >= 3) {
            if (haystack.includes((streetNum + " " + streetWord).toLowerCase())) {
              clientId = c.id;
              break;
            }
          }
          const addrSeg = c.address.split(",")[0].trim().toLowerCase();
          if (addrSeg.length > 5 && haystack.includes(addrSeg)) {
            clientId = c.id;
            break;
          }
        }
      }

      // Auto-create client if AI extracted address info and we still have no match
      if (!clientId && (parsed.newClientAddress || parsed.newClientName)) {
        const newClient = await prisma.client.create({
          data: {
            companyId: params.companyId,
            name: parsed.newClientName ?? parsed.newClientAddress ?? "Unknown Project",
            address: parsed.newClientAddress ?? null,
            city: parsed.newClientCity ?? null,
            state: parsed.newClientState ?? null,
          },
        });
        clientId = newClient.id;
        // Add to local list so later emails in this run can match it
        clients.push({
          id: newClient.id,
          name: newClient.name,
          address: newClient.address,
          city: newClient.city,
          state: newClient.state,
        });
      }

      const divCode = parsed.divisionCode ?? "01";
      const division = STANDARD_DIVISIONS.find(d => d.code === divCode) ?? STANDARD_DIVISIONS[0];

      const fileUrl = pdfParts.length > 0
        ? `gmail:${msg.id}:${pdfParts[0].body?.attachmentId ?? ""}`
        : `gmail:${msg.id}`;
      const fileName = pdfParts[0]?.filename ?? null;

      if (!clientId) {
        // Save as TRIAGE so user can manually assign to a project
        await prisma.subBid.create({
          data: {
            clientId: null,
            companyId: params.companyId,
            divisionCode: division.code,
            divisionName: division.name,
            contractorName: parsed.contractorName ?? from,
            amount: parsed.amount ?? null,
            notes: parsed.notes ?? null,
            fileUrl,
            fileName,
            status: "TRIAGE",
            emailSource: safeSubject || from,
            isPlaceholder: false,
            bidDate: bidDate,
          },
        });
        noInfo++;
        continue;
      }

      await prisma.subBid.create({
        data: {
          clientId,
          companyId: params.companyId,
          divisionCode: division.code,
          divisionName: division.name,
          contractorName: parsed.contractorName ?? from,
          amount: parsed.amount ?? null,
          notes: parsed.notes ?? null,
          fileUrl,
          fileName,
          status: "RECEIVED",
          emailSource: from,
          isPlaceholder: false,
          bidDate: bidDate,
        },
      });

      const projectName = clients.find(c => c.id === clientId)?.name ?? null;
      importedBids.push({
        contractorName: parsed.contractorName ?? from,
        projectName,
        amount: parsed.amount ?? null,
        division: division.name,
      });
      added++;
    } catch (err) {
      errors.push(String(err).slice(0, 100));
    }
  }

  const remaining = Math.max(0, newMessages.length - toProcess.length);

  return NextResponse.json({
    found: allMessages.length,
    newUnprocessed: newMessages.length,
    processed: toProcess.length,
    added,
    notBid,
    triage: noInfo,
    remaining,
    importedBids,
    errors: errors.slice(0, 10),
  });
  } catch (err) {
    console.error("Sync fatal error:", err);
    return NextResponse.json({ error: "Sync failed", detail: String(err) }, { status: 500 });
  }
}
