import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

export const runtime = "nodejs";
export const maxDuration = 30;

const MIKE_SIGNATURE = `Mike Baruh
Founder/CEO | MIBH Construction
Certified & Licensed General Contractor CGC 1527069
Certified & Licensed Roofer CCC 1336817

📱 Cell: 305.746.7307
📧 Email: mike@mibhconstruction.com
📍 Address: 2950 N 28 Terr, Hollywood, FL 33020
🌐 Website: www.mibhconstruction.com`;

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

async function sendNoteEmail(toEmail: string, clientName: string, scope: string, stageLabel: string, note: string) {
  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const firstName = clientName.split(" ")[0];
    const subject = `Progress on your ${scope} - ${stageLabel}`;
    const body = `Dear ${firstName},\n\nWe wanted to let you know that today ${note} happened.\n\n${MIKE_SIGNATURE}`;

      const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Cc: mikebaruh@gmail.com`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    console.error("sendNoteEmail error:", err);
  }
}

// PATCH — update pipeline card fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: { companyId: string; cardId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const card = await prisma.pipelineCard.findFirst({
    where: { id: params.cardId, companyId: params.companyId },
    include: { client: { select: { id: true, name: true, email: true } } },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { stage, displayName, estimateValue, notes, sortOrder, clientId, source, stageLabel } = body;

  const updated = await prisma.pipelineCard.update({
    where: { id: params.cardId },
    data: {
      ...(stage !== undefined ? { stage } : {}),
      ...(displayName !== undefined ? { displayName } : {}),
      ...(estimateValue !== undefined ? { estimateValue: estimateValue != null ? estimateValue : null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(clientId !== undefined ? { clientId: clientId || null } : {}),
      ...(source !== undefined ? { source: source || null } : {}),
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      lead: { select: { id: true, name: true, email: true, phone: true, projectType: true, receivedAt: true } },
    },
  });

  // Send email notification when a note is added to a project pipeline card
  if (notes && notes !== card.notes && card.pipelineType === "project") {
    const clientEmail = updated.client?.email ?? card.client?.email;
    const clientName = updated.client?.name ?? card.displayName;
    if (clientEmail) {
      const scope = card.displayName;
      const stageName = stageLabel ?? stage ?? card.stage;
      await sendNoteEmail(clientEmail, clientName, scope, stageName, notes);
    }
  }

  return NextResponse.json(updated);
}

// DELETE — delete a pipeline card
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { companyId: string; cardId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const card = await prisma.pipelineCard.findFirst({
    where: { id: params.cardId, companyId: params.companyId },
  });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pipelineCard.delete({ where: { id: params.cardId } });

  return NextResponse.json({ success: true });
}
