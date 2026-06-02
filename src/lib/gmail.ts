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
  const envToken = process.env.GOOGLE_REFRESH_TOKEN;

  // Try DB-stored token first, fall back to env var if it fails
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { googleRefreshToken: true },
    });
    if (company?.googleRefreshToken) {
      const client = makeOAuthClient(company.googleRefreshToken);
      try {
        // Validate by refreshing — if token is stale this throws
        await client.getAccessToken();
        return client;
      } catch {
        // DB token invalid — fall through to env var
      }
    }
  }

  if (!envToken) throw new Error("Gmail not configured — no refresh token");
  return makeOAuthClient(envToken);
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
