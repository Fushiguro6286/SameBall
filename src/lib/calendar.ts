// "Add to calendar" for scheduled rooms: a Google Calendar link and an .ics file.

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const DURATION_MS = 3 * 60 * 60_000; // rough match length; people can edit it

export function googleCalendarUrl(title: string, startsAt: number, url: string): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(startsAt)}/${stamp(startsAt + DURATION_MS)}`,
    details: `Spoiler-free match room on SameBall: ${url}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const icsEscape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

export function icsFile(title: string, startsAt: number, url: string, uid: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SameBall//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@sameball`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(startsAt)}`,
    `DTEND:${stamp(startsAt + DURATION_MS)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(`Spoiler-free match room: ${url}`)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
