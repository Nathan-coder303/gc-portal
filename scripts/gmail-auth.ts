/**
 * Run once to get your Gmail refresh token:
 *   npx tsx scripts/gmail-auth.ts
 *
 * Prerequisites:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create project → Enable "Gmail API"
 * 3. OAuth consent screen → External → Add your email as test user
 * 4. Credentials → Create → OAuth 2.0 Client ID → Desktop app
 * 5. Download JSON or copy Client ID + Client Secret
 * 6. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file
 */

import 'dotenv/config';
import { google } from 'googleapis';
import * as readline from 'readline';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // Desktop flow

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify', // to mark as read
];

const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

console.log('\n🔑 Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste the code from Google here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Success! Add this to your Vercel environment variables:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nAlso make sure these are set:');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log('\nThen add them to Vercel: vercel env add GOOGLE_REFRESH_TOKEN');
  } catch (err) {
    console.error('❌ Error getting token:', err);
  }
});
