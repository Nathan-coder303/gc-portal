import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGmailOAuth } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const envToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const tokenPrefix = envToken?.slice(0, 12) ?? "MISSING";
  const clientIdPrefix = clientId?.slice(0, 20) ?? "MISSING";
  try {
    const oauth2Client = await getGmailOAuth(params.companyId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return NextResponse.json({ ok: true, email: profile.data.emailAddress, tokenPrefix, clientIdPrefix, companyId: params.companyId });
  } catch (err: unknown) {
    const detail = err instanceof Error ? { message: err.message, stack: err.stack?.slice(0, 300) } : String(err);
    return NextResponse.json({ ok: false, error: detail, tokenPrefix, clientIdPrefix, companyId: params.companyId });
  }
}
