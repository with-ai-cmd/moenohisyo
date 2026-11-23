import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, '../data/google_token.json');

function getAuthorizedClient() {
  if (!existsSync(TOKEN_PATH)) {
    throw new Error('Google認証が未完了です。/auth/google にアクセスして認証してください。');
  }
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  const tokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  client.setCredentials(tokens);
  return client;
}

function extractSpreadsheetId(urlOrId) {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrId;
}

export async function appendAttendance({ spreadsheetUrl, sheetName, row }) {
  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  const range = `${sheetName}!A:Z`;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function getSheetNames(spreadsheetUrl) {
  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);

  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return res.data.sheets.map(s => s.properties.title);
}
