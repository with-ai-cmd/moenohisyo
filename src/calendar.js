import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, '../data/google_token.json');

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

export async function saveToken(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  return tokens;
}

function getAuthorizedClient() {
  if (!existsSync(TOKEN_PATH)) {
    throw new Error('Google認証が未完了です。/auth/google にアクセスして認証してください。');
  }
  const client = createOAuth2Client();
  const tokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  client.setCredentials(tokens);

  client.on('tokens', (newTokens) => {
    const updated = { ...tokens, ...newTokens };
    writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2), 'utf8');
  });

  return client;
}

export async function createCalendarEvent({ title, date, startTime, endTime, description, calendarId }) {
  const auth = getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const calId = calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary';
  const timeZone = 'Asia/Tokyo';

  const event = {
    summary: title,
    description: description || '',
    start: startTime
      ? { dateTime: `${date}T${startTime}:00`, timeZone }
      : { date },
    end: endTime
      ? { dateTime: `${date}T${endTime}:00`, timeZone }
      : { date },
  };

  const result = await calendar.events.insert({ calendarId: calId, requestBody: event });
  return result.data;
}

export async function getAvailableSlots(dates) {
  const auth = getAuthorizedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const results = [];

  for (const date of dates) {
    const timeMin = new Date(`${date}T00:00:00+09:00`).toISOString();
    const timeMax = new Date(`${date}T23:59:59+09:00`).toISOString();

    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items || [];
    const busySlots = events.map(e => ({
      start: e.start.dateTime || e.start.date,
      end: e.end.dateTime || e.end.date,
      summary: e.summary,
    }));

    results.push({ date, busy: busySlots, hasFreeTime: busySlots.length === 0 });
  }

  return results;
}
