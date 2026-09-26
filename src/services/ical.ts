import { addDays, format, startOfDay } from 'date-fns';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import { dayKey, deviceTimeZone, parseDayKey, parseTimestamp } from '../utils/dates';
import { createRule, fromFloatingUTC, toFloatingUTC } from '../utils/recurrence';
import { isFloating } from './eventTimes';
import { isDateInPauseWindows } from './occurrences';

/*
 * iCalendar (RFC 5545) import and export, so events can move to and from Google Calendar, Apple
 * Calendar, Outlook and others. Skipped dates and pause windows are written as EXDATEs of the
 * occurrences they remove, and EXDATEs come back as skipped dates. Floating events use iCalendar's own floating times (no
 * TZID, no Z); fixed ones carry the phone's time zone. The full-fidelity format is the JSON backup (backup.ts).
 */

const CRLF = '\r\n';
const UID_SUFFIX = '@opencal';

// ---------- Writing ----------

const utf8Length = (ch: string): number => {
  const c = ch.codePointAt(0) ?? 0;
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
};

/** Folds a content line at 75 octets (not characters, so Hebrew/emoji text stays valid). */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const len = utf8Length(ch);
    if (bytes + len > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += len;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const escapeText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const utcStamp = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const localStamp = (d: Date): string => format(d, "yyyyMMdd'T'HHmmss");
const dateStamp = (d: Date): string => format(d, 'yyyyMMdd');

/** `-PT10M`, `PT9H`, `-P1DT15H` … */
function icsDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  let m = Math.abs(Math.round(minutes));
  const days = Math.floor(m / 1440);
  m %= 1440;
  const hours = Math.floor(m / 60);
  m %= 60;
  let out = `${sign}P`;
  if (days) out += `${days}D`;
  if (hours || m || !days) {
    out += 'T';
    if (hours) out += `${hours}H`;
    if (m || !hours) out += `${m}M`;
  }
  return out;
}

/** Occurrences of a repeating event that are skipped or fall in its (or its calendar's) pauses. */
function excludedOccurrences(event: Event, calendar: Calendar | undefined): Date[] {
  if (!event.recurrenceRule) return [];
  const windows = [...event.pauseWindows, ...(calendar?.pauseWindows ?? [])];
  const skipped = new Set(event.skippedDates ?? []);
  // Every day that could hold an exclusion, to bound the expansion.
  const days = [...windows.flatMap((w) => [w.startDate, w.endDate]), ...skipped].sort();
  if (!days.length) return [];
  const rule = createRule(event.recurrenceRule, parseTimestamp(event.startDate));
  if (!rule) return [];
  return rule
    .between(toFloatingUTC(parseDayKey(days[0]!)), toFloatingUTC(addDays(parseDayKey(days[days.length - 1]!), 1)), true)
    .map(fromFloatingUTC)
    .filter((d) => skipped.has(dayKey(d)) || isDateInPauseWindows(d, windows));
}

function eventLines(event: Event, calendar: Calendar | undefined, allDayTime: number, tz: string | null, now: Date): string[] {
  const start = parseTimestamp(event.startDate);
  const end = parseTimestamp(event.endDate);
  const lines = ['BEGIN:VEVENT', `UID:${event.id}${UID_SUFFIX}`, `DTSTAMP:${utcStamp(now)}`, `SUMMARY:${escapeText(event.title)}`];
  // Fixed events carry the device time zone so repeats stay at the same local time across DST.
  const floating = isFloating(event);
  const when = (prop: string, d: Date) =>
    event.isAllDay
      ? `${prop};VALUE=DATE:${dateStamp(d)}`
      : floating
        ? `${prop}:${localStamp(d)}`
        : tz
          ? `${prop};TZID=${tz}:${localStamp(d)}`
          : `${prop}:${utcStamp(d)}`;
  lines.push(when('DTSTART', start));
  // All-day DTEND is exclusive: the day after the last day.
  lines.push(event.isAllDay ? when('DTEND', addDays(startOfDay(end), 1)) : when('DTEND', end));
  if (event.recurrenceRule) {
    // The app stores UNTIL as `<local date>T235959Z`. UNTIL must match DTSTART: a date for all-day
    // events, a floating time for floating ones, else the real UTC instant at the end of that day.
    const rule = event.recurrenceRule.replace(/UNTIL=(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?/i, (_, y: string, m: string, d: string) =>
      event.isAllDay
        ? `UNTIL=${y}${m}${d}`
        : floating
          ? `UNTIL=${y}${m}${d}T235959`
          : `UNTIL=${utcStamp(new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59))}`,
    );
    lines.push(`RRULE:${rule}`);
    const skipped = excludedOccurrences(event, calendar);
    if (skipped.length) {
      lines.push(
        event.isAllDay
          ? `EXDATE;VALUE=DATE:${skipped.map(dateStamp).join(',')}`
          : floating
            ? `EXDATE:${skipped.map(localStamp).join(',')}`
            : tz
            ? `EXDATE;TZID=${tz}:${skipped.map(localStamp).join(',')}`
            : `EXDATE:${skipped.map(utcStamp).join(',')}`,
      );
    }
  }
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.tags.length) lines.push(`CATEGORIES:${event.tags.map(escapeText).join(',')}`);
  if (event.color) lines.push(`X-OPENCAL-COLOR:${event.color}`);
  if (event.emoji) lines.push(`X-OPENCAL-ICON:${escapeText(event.emoji)}`);
  for (const minutes of event.reminders) {
    // All-day reminders count back from the all-day reminder time, not midnight.
    const trigger = event.isAllDay ? allDayTime - minutes : -minutes;
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(event.title)}`, `TRIGGER:${icsDuration(trigger)}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

/** An .ics file with `events`. `name`/`color` label the calendar in apps that show them. */
export function toICS(
  events: Event[],
  calendarsById: Record<string, Calendar>,
  options: { name: string; color?: string; allDayTime: number },
): string {
  const now = new Date();
  const tz = deviceTimeZone();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OpenCal//OpenCal//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(options.name)}`,
    ...(options.color ? [`X-APPLE-CALENDAR-COLOR:${options.color}`] : []),
  ];
  for (const e of events) lines.push(...eventLines(e, calendarsById[e.calendarId], options.allDayTime, tz, now));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join(CRLF) + CRLF;
}

// ---------- Reading ----------

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface Component {
  type: string;
  props: Property[];
  children: Component[];
}

const unescapeText = (s: string): string => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** Splits on unescaped commas (CATEGORIES, EXDATE values). */
function splitList(s: string): string[] {
  const out: string[] = [];
  let current = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\\' && i + 1 < s.length) {
      current += ch + s[++i];
    } else if (ch === ',') {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseLine(line: string): Property | null {
  // The value starts at the first colon outside a quoted parameter value.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name = '', ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function parseComponents(text: string): Component[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const root: Component = { type: 'ROOT', props: [], children: [] };
  const stack = [root];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const prop = parseLine(raw);
    if (!prop) continue;
    const top = stack[stack.length - 1]!;
    if (prop.name === 'BEGIN') {
      const child: Component = { type: prop.value.trim().toUpperCase(), props: [], children: [] };
      top.children.push(child);
      stack.push(child);
    } else if (prop.name === 'END') {
      if (stack.length > 1) stack.pop();
    } else {
      top.props.push(prop);
    }
  }
  return root.children;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Offset of `timeZone` from UTC at `utcMs`, in ms. Throws for unknown zones. */
function zoneOffset(utcMs: number, timeZone: string): number {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  const parts = f.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - utcMs;
}

interface ParsedDate {
  date: Date;
  allDay: boolean;
  /** A time with no zone at all (no TZID, no Z): iCalendar's floating time. */
  floating: boolean;
}

function parseDate(value: string, params: Record<string, string>): ParsedDate | null {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    return { date: new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])), allDay: true, floating: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (m[7]) return { date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false, floating: false };
  const tz = params.TZID?.replace(/^\//, '');
  if (tz) {
    try {
      const guess = Date.UTC(y, mo - 1, d, h, mi, s);
      // Two passes settle the offset around DST changes.
      const first = guess - zoneOffset(guess, tz);
      return { date: new Date(guess - zoneOffset(first, tz)), allDay: false, floating: false };
    } catch {
      // Unknown zone name (e.g. a Windows zone): treat as local time.
    }
  }
  // An unknown zone is read as local time but kept fixed; only a zone-less time floats.
  return { date: new Date(y, mo - 1, d, h, mi, s), allDay: false, floating: !tz };
}

function parseDuration(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!m) return null;
  const minutes =
    Number(m[2] ?? 0) * 10080 + Number(m[3] ?? 0) * 1440 + Number(m[4] ?? 0) * 60 + Number(m[5] ?? 0) + Math.round(Number(m[6] ?? 0) / 60);
  return m[1] === '-' ? -minutes : minutes;
}

/** Stores UNTIL as the end of its local day, the way the repeat editor writes it. */
function normalizeRule(rule: string): string {
  return rule
    .replace(/^RRULE:/i, '')
    .split(';')
    .map((part) => {
      const [k, v] = part.split('=');
      if (k?.toUpperCase() !== 'UNTIL' || !v) return part;
      const parsed = parseDate(v, {});
      return parsed ? `UNTIL=${dateStamp(parsed.date)}T235959Z` : part;
    })
    .join(';');
}

export interface ICSImport {
  /** X-WR-CALNAME, if the file has one. */
  calendarName?: string;
  calendarColor?: string;
  /** Events without a calendar yet (`calendarId` is empty). */
  events: Event[];
  /** VEVENTs that couldn't be read (no valid start date). */
  skipped: number;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Parses an .ics file. Returns null when the text isn't iCalendar at all. */
export function parseICS(text: string, allDayTime: number): ICSImport | null {
  const calendars = parseComponents(text).filter((c) => c.type === 'VCALENDAR');
  if (!calendars.length) return null;
  const result: ICSImport = { events: [], skipped: 0 };
  const masters = new Map<string, Event>();
  const overrides: { uid: string; recurrenceId: ParsedDate; event: Event | null }[] = [];

  for (const cal of calendars) {
    const calProp = (name: string) => cal.props.find((p) => p.name === name)?.value;
    result.calendarName ??= calProp('X-WR-CALNAME') ? unescapeText(calProp('X-WR-CALNAME')!) : undefined;
    const color = (calProp('X-APPLE-CALENDAR-COLOR') ?? calProp('COLOR'))?.slice(0, 7);
    if (color && HEX.test(color)) result.calendarColor ??= color.toUpperCase();

    for (const vevent of cal.children.filter((c) => c.type === 'VEVENT')) {
      const all = (name: string) => vevent.props.filter((p) => p.name === name);
      const one = (name: string) => all(name)[0];
      const dtstart = one('DTSTART');
      const start = dtstart ? parseDate(dtstart.value, dtstart.params) : null;
      if (!start) {
        result.skipped++;
        continue;
      }
      const cancelled = one('STATUS')?.value.trim().toUpperCase() === 'CANCELLED';
      const uid = one('UID')?.value.trim() || `${dtstart!.value}-${one('SUMMARY')?.value ?? ''}`;
      const recurrenceIdProp = one('RECURRENCE-ID');
      const recurrenceId = recurrenceIdProp ? parseDate(recurrenceIdProp.value, recurrenceIdProp.params) : null;
      if (cancelled && !recurrenceId) continue;

      // End: DTEND, else DURATION, else the same instant (timed) or one day (all-day).
      const dtend = one('DTEND');
      const duration = one('DURATION') ? parseDuration(one('DURATION')!.value) : null;
      let end = dtend ? parseDate(dtend.value, dtend.params)?.date ?? null : null;
      if (!end && duration !== null) end = new Date(start.date.getTime() + duration * 60000);
      if (start.allDay) {
        const last = end && end > start.date ? addDays(startOfDay(end), end.getHours() || end.getMinutes() ? 0 : -1) : start.date;
        end = new Date(addDays(startOfDay(last), 1).getTime() - 1);
      } else if (!end || end < start.date) {
        end = start.date;
      }

      const reminders = new Set<number>();
      for (const alarm of vevent.children.filter((c) => c.type === 'VALARM')) {
        const trigger = alarm.props.find((p) => p.name === 'TRIGGER');
        if (!trigger || trigger.params.VALUE === 'DATE-TIME' || trigger.params.RELATED === 'END') continue;
        const offset = parseDuration(trigger.value);
        if (offset === null) continue;
        reminders.add(Math.max(0, start.allDay ? allDayTime - offset : -offset));
      }

      const skippedDays = new Set<string>();
      for (const ex of all('EXDATE')) {
        for (const v of splitList(ex.value)) {
          const d = parseDate(v, ex.params);
          if (d) skippedDays.add(dayKey(d.date));
        }
      }
      const rrule = one('RRULE')?.value.trim();
      const rule = rrule && !recurrenceId && createRule(normalizeRule(rrule), start.date) ? normalizeRule(rrule) : undefined;
      const color = (one('X-OPENCAL-COLOR') ?? one('COLOR'))?.value.trim();
      const baseId = uid.endsWith(UID_SUFFIX) ? uid.slice(0, -UID_SUFFIX.length) : `ics-${uid}`;

      const event: Event = {
        id: recurrenceId ? `${baseId}-${recurrenceIdProp!.value.trim()}` : baseId,
        title: unescapeText(one('SUMMARY')?.value ?? '').trim() || 'Untitled event',
        description: one('DESCRIPTION') ? unescapeText(one('DESCRIPTION')!.value).trim() || undefined : undefined,
        location: one('LOCATION') ? unescapeText(one('LOCATION')!.value).trim() || undefined : undefined,
        startDate: start.date.toISOString(),
        endDate: end.toISOString(),
        isAllDay: start.allDay,
        floating: !start.allDay && start.floating,
        calendarId: '',
        color: color && HEX.test(color) ? color.toUpperCase() : undefined,
        recurrenceRule: rule,
        pauseWindows: [],
        skippedDates: rule ? [...skippedDays].sort() : [],
        reminders: [...reminders].sort((a, b) => a - b),
        emoji: one('X-OPENCAL-ICON') ? unescapeText(one('X-OPENCAL-ICON')!.value).trim() || undefined : undefined,
        tags: [...new Set(all('CATEGORIES').flatMap((p) => splitList(p.value).map(unescapeText)))],
      };
      if (recurrenceId) overrides.push({ uid: baseId, recurrenceId, event: cancelled ? null : event });
      else masters.set(baseId, event);
    }
  }

  // A changed or cancelled instance of a repeating event: skip that day in the series and keep
  // the changed instance as its own one-off event.
  for (const o of overrides) {
    const master = masters.get(o.uid);
    if (master?.recurrenceRule) {
      master.skippedDates = [...new Set([...(master.skippedDates ?? []), dayKey(o.recurrenceId.date)])].sort();
    }
    if (o.event) result.events.push(o.event);
  }
  result.events.unshift(...masters.values());
  return result;
}
