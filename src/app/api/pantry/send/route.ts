import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

// Emails the current pantry list as a statement-style HTML message.
// Uses the caller's own Gmail auth via the shared refresh token.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { to?: string; subject?: string; html?: string };
  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "Pantry list").trim() || "Pantry list";
  const html = body.html ?? "";
  if (!to || !html) return NextResponse.json({ error: "Missing to/html" }, { status: 400 });

  try {
    const oauth = await getGmailOAuth();
    const gmail = google.gmail({ version: "v1", auth: oauth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const fromEmail = profile.data.emailAddress ?? "me";

    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Pantry send failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
