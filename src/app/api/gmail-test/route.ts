import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  const envToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  try {
    const oauth2Client = await getGmailOAuth(companyId || undefined);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return NextResponse.json({ ok: true, email: profile.data.emailAddress, tokenPrefix: envToken?.slice(0, 12), clientIdPrefix: clientId?.slice(0, 20) });
  } catch (err: unknown) {
    const detail = err instanceof Error ? { message: err.message, stack: err.stack?.slice(0, 300) } : String(err);
    return NextResponse.json({ ok: false, error: detail, tokenPrefix: envToken?.slice(0, 12), clientIdPrefix: clientId?.slice(0, 20) });
  }
}
