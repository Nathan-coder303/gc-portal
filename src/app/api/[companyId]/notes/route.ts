import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

export const runtime = "nodejs";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

const MIKE_SIGNATURE = `Mike Baruh
Founder/CEO | MIBH Construction
Certified & Licensed General Contractor CGC 1527069
Certified & Licensed Roofer CCC 1336817

📱 Cell: 305.746.7307
📧 Email: mike@mibhconstruction.com
📍 Address: 2950 N 28 Terr, Hollywood, FL 33020
🌐 Website: www.mibhconstruction.com
📸 Instagram: @mibh_construction`;

// GET /api/[companyId]/notes?leadId=...  OR  ?clientId=...
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  const clientId = req.nextUrl.searchParams.get("clientId");

  if (!leadId && !clientId) {
    return NextResponse.json({ error: "leadId or clientId required" }, { status: 400 });
  }

  const notes = await prisma.note.findMany({
    where: {
      companyId: params.companyId,
      ...(leadId ? { leadId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { noteDate: "desc" },
  });

  return NextResponse.json(notes);
}

// POST /api/[companyId]/notes
// body: { leadId?, clientId?, content, noteDate? }
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { leadId, clientId, content, noteDate } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (!leadId && !clientId) {
    return NextResponse.json({ error: "leadId or clientId required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      companyId: params.companyId,
      leadId: leadId || null,
      clientId: clientId || null,
      content: content.trim(),
      noteDate: noteDate ? new Date(noteDate) : new Date(),
      createdBy: session.user.id,
    },
  });

  // Auto-email client when note is on a client record
  if (clientId) {
    try {
      const client = await prisma.client.findFirst({
        where: { id: clientId, companyId: params.companyId },
        select: { name: true, email: true, address: true },
      });

      if (client?.email) {
        const firstName = client.name.split(" ")[0];
        const subject = `Your Scope at ${client.address ?? "Your Project"}`;
        const emailBody = `Dear ${firstName},\n\nWe have an exciting update on your project.\n\n${content.trim()}\n\n${MIKE_SIGNATURE}`;

        const oauth2Client = getOAuthClient();
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        const fromEmail = profile.data.emailAddress ?? "me";

        const encodedSubject = /^[\x00-\x7F]*$/.test(subject)
          ? subject
          : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

        const mimeLines = [
          `From: ${fromEmail}`,
          `To: ${client.email}`,
          `Cc: mikebaruh@gmail.com`,
          `Subject: ${encodedSubject}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          emailBody,
        ];
        const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
        await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      }
    } catch (err) {
      // Don't fail the note save if email fails — just log
      console.error("Note email send failed:", err);
    }
  }

  return NextResponse.json(note);
}

// DELETE /api/[companyId]/notes?noteId=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const noteId = req.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  await prisma.note.deleteMany({
    where: { id: noteId, companyId: params.companyId },
  });

  return NextResponse.json({ success: true });
}
