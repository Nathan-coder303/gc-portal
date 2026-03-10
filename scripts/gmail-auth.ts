/**
 * Run once to get your Gmail refresh token:
 *   npx tsx scripts/gmail-auth.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:4000/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

console.log('\n🔑 Opening browser for Google auth...\n');
console.log(authUrl);
console.log('\nWaiting for callback on http://localhost:4000/callback ...\n');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url ?? '', true);
  if (parsed.pathname !== '/callback') return;

  const code = parsed.query.code as string;
  if (!code) {
    res.end('No code found.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end('<h2>✅ Success! You can close this tab.</h2>');
    console.log('\n✅ Got refresh token!\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nAdd all three to Vercel env vars:');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (err) {
    res.end('❌ Error: ' + String(err));
    console.error('❌ Error:', err);
  }
  server.close();
});

server.listen(4000, () => {
  // Try to open the browser automatically
  const open = (u: string) => {
    const { execSync } = require('child_process');
    try { execSync(`open "${u}"`); } catch {}
  };
  open(authUrl);
});
