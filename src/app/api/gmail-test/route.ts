import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  try {
    const oauth2Client = await getGmailOAuth(companyId || undefined);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return NextResponse.json({ ok: true, email: profile.data.emailAddress, messagesTotal: profile.data.messagesTotal });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
