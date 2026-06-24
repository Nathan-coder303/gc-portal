import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

async function getAuthedClient(companyId: string) {
  // Prefer the env-level refresh token (same source used by Gmail) so a single token
  // rotation covers both Gmail + Calendar. Fall back to the per-company DB token.
  let refreshToken = process.env.GOOGLE_REFRESH_TOKEN ?? null;
  if (!refreshToken) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { googleRefreshToken: true },
    });
    refreshToken = company?.googleRefreshToken ?? null;
  }
  if (!refreshToken) return null;

  const auth = getOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

// Parse "10:30 AM" → { hour: 10, minute: 30 }
function parseTime(timeStr: string | null): { hour: number; minute: number } {
  if (!timeStr) return { hour: 9, minute: 0 };
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return { hour: 9, minute: 0 };
  let hour = parseInt(m[1]);
  const minute = parseInt(m[2]);
  const meridiem = m[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

export async function createCalendarEvent(
  companyId: string,
  opts: {
    title: string;
    date: Date; // The appointment date (dueDate)
    timeStr: string | null; // e.g. "10:30 AM"
    address: string | null;
    notes: string | null;
    durationMinutes?: number;
  }
): Promise<string | null> {
  const auth = await getAuthedClient(companyId);
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth });

  const { hour, minute } = parseTime(opts.timeStr);
  const start = new Date(opts.date);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (opts.durationMinutes ?? 60));

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: opts.title,
        location: opts.address ?? undefined,
        description: opts.notes ?? undefined,
        start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
        end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[GCal] createCalendarEvent error:", err);
    return null;
  }
}

export async function updateCalendarEvent(
  companyId: string,
  eventId: string,
  opts: {
    title: string;
    date: Date;
    timeStr: string | null;
    address: string | null;
    notes: string | null;
    durationMinutes?: number;
  }
): Promise<void> {
  const auth = await getAuthedClient(companyId);
  if (!auth) return;

  const calendar = google.calendar({ version: "v3", auth });

  const { hour, minute } = parseTime(opts.timeStr);
  const start = new Date(opts.date);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (opts.durationMinutes ?? 60));

  try {
    await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: {
        summary: opts.title,
        location: opts.address ?? undefined,
        description: opts.notes ?? undefined,
        start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
        end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
      },
    });
  } catch (err) {
    console.error("[GCal] updateCalendarEvent error:", err);
  }
}

export async function deleteCalendarEvent(
  companyId: string,
  eventId: string
): Promise<void> {
  const auth = await getAuthedClient(companyId);
  if (!auth) return;

  const calendar = google.calendar({ version: "v3", auth });
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err) {
    console.error("[GCal] deleteCalendarEvent error:", err);
  }
}
