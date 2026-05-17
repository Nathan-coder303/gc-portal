import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/google-oauth/callback?code=xxx&state=companyId
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const companyId = searchParams.get("state");

  if (!code || !companyId) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json({ error: "GOOGLE_OAUTH_REDIRECT_URI not configured" }, { status: 500 });
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  try {
    const { tokens } = await client.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      return NextResponse.json({
        error: "Google did not return a refresh_token. Try revoking access at myaccount.google.com/permissions and re-authorizing."
      }, { status: 400 });
    }

    const updated = await prisma.company.updateMany({
      where: { id: companyId },
      data: { googleRefreshToken: refreshToken },
    });

    if (updated.count === 0) {
      // Try raw SQL as fallback
      await prisma.$executeRawUnsafe(
        `UPDATE "Company" SET "googleRefreshToken" = $1 WHERE id = $2`,
        refreshToken,
        companyId,
      );
    }

    // Redirect back to subs page with success notice
    const base = req.url.split("/api/")[0];
    return NextResponse.redirect(`${base}/${companyId}/subs?gmail=connected`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to exchange code: \ncompanyId received: "${companyId}"\n${msg}` }, { status: 500 });
  }
}
