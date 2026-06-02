import { google } from "googleapis";
import { prisma } from "./prisma";

export function makeOAuthClient(refreshToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export async function getGmailOAuth(companyId?: string) {
  // Prefer env var (manually managed fresh token) over DB token
  const envToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (envToken) return makeOAuthClient(envToken);

  // Fall back to DB-stored token (set via Reconnect Gmail flow)
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { googleRefreshToken: true },
    });
    if (company?.googleRefreshToken) return makeOAuthClient(company.googleRefreshToken);
  }

  throw new Error("Gmail not configured — no refresh token");
}

export function buildGoogleAuthUrl(companyId: string) {
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!redirectUri) throw new Error("GOOGLE_OAUTH_REDIRECT_URI not set");

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
    ],
    state: companyId,
  });
}
