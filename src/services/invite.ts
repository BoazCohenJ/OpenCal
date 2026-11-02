import { addDays, endOfDay, startOfDay } from 'date-fns';
import type { Event } from '../models/Event';
import { parseICS, type ICSImport } from './ical';

/*
 * Events from a calendar invitation, in whatever form it arrives: a plain .ics file, or a whole
 * email (.eml). Invitations carry their event as a text/calendar part or an invite.ics attachment.
 * Google Calendar's "share event" emails have neither, only schema.org markup in the HTML part, so
 * that (or JSON-LD) is read when there's no calendar data. Ids come from the invite's UID, so opening
 * an updated invite updates the event instead of adding a copy.
 */

interface Part {
  headers: Record<string, string>;
  body: string;
}

const CALENDAR_TYPES = /^(text\/calendar|text\/x-vcalendar|application\/ics)$/i;

/** Splits a MIME entity into lower-cased headers (unfolded) and its body. */
function splitEntity(text: string): Part {
  const match = /\r?\n\r?\n/.exec(text);
  const head = match ? text.slice(0, match.index) : text;
  const body = match ? text.slice(match.index + match[0].length) : '';
  const headers: Record<string, string> = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] ??= line.slice(colon + 1).trim();
  }
  return { headers, body };
}

/** A header's parameter, e.g. `boundary` of `multipart/mixed; boundary="abc"`. */
function param(header: string | undefined, name: string): string | undefined {
  const m = header && new RegExp(`(?:^|;)\\s*${name}\\*?=\\s*(?:"([^"]*)"|([^;\\s]*))`, 'i').exec(header);
  return m ? (m[1] ?? m[2]) : undefined;
}

/** Bytes as text. Invalid UTF-8 falls back to Latin-1 so a mislabelled part still reads. */
function decodeBytes(bytes: number[], charset = 'utf-8'): string {
  const latin1 = () => bytes.map((b) => String.fromCharCode(b)).join('');
  if (!/^utf-?8$/i.test(charset)) return latin1();
  try {
    return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return latin1();
  }
}

/** A string's characters as UTF-8 bytes (for 8bit parts that already hold decoded text). */
function utf8Bytes(s: string): number[] {
  const bytes: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) bytes.push(c);
    else for (const hex of encodeURIComponent(ch).split('%').slice(1)) bytes.push(parseInt(hex, 16));
  }
  return bytes;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Bytes(s: string): number[] {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]!) : 0));
    const triple = (n[0]! << 18) | (n[1]! << 12) | (n[2]! << 6) | n[3]!;
    bytes.push((triple >> 16) & 255);
    if (i + 2 < clean.length) bytes.push((triple >> 8) & 255);
    if (i + 3 < clean.length) bytes.push(triple & 255);
  }
  return bytes;
}

function quotedPrintableBytes(s: string): number[] {
  // By code point, so a raw emoji (two UTF-16 units) is encoded whole.
  const chars = Array.from(s.replace(/=\r?\n/g, ''));
  const bytes: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    const hex = chars[i] === '=' ? `${chars[i + 1] ?? ''}${chars[i + 2] ?? ''}` : '';
    if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...utf8Bytes(chars[i]!));
    }
  }
  return bytes;
}

function decodeBody(part: Part): string {
  const encoding = (part.headers['content-transfer-encoding'] ?? '').toLowerCase();
  const charset = param(part.headers['content-type'], 'charset') ?? 'utf-8';
  if (encoding === 'base64') return decodeBytes(base64Bytes(part.body), charset);
  if (encoding === 'quoted-printable') return decodeBytes(quotedPrintableBytes(part.body), charset);
  return part.body;
}

/** Every leaf part of a MIME message, depth first, with its decoded text. */
function leafParts(entity: Part, depth = 0): { type: string; fileName?: string; text: string }[] {
  const contentType = entity.headers['content-type'] ?? 'text/plain';
  const type = contentType.split(';')[0]!.trim().toLowerCase();
  const boundary = param(contentType, 'boundary');
  if (type.startsWith('multipart/') && boundary && depth < 10) {
    const sections = entity.body.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*\\r?\\n?`));
    // The first section is the preamble and the last the epilogue; neither is a part.
    return sections.slice(1, -1).flatMap((s) => leafParts(splitEntity(s), depth + 1));
  }
  const fileName = param(entity.headers['content-disposition'], 'filename') ?? param(contentType, 'name');
  return [{ type, fileName, text: decodeBody(entity) }];
}

const looksLikeEmail = (text: string): boolean => {
  const head = splitEntity(text.slice(0, 64 * 1024)).headers;
  return /^[\w-]+:/.test(text.trimStart()) && ('content-type' in head || 'mime-version' in head);
};

// ---------- schema.org markup (no calendar data in the email) ----------

const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const stripTags = (html: string): string => decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

/**
 * A schema.org date: `20261114` (a day), `20261105T061500Z`, or ISO 8601. Days have no time zone, so
 * they're read on this phone's calendar like any all-day date.
 */
function schemaDate(value: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  const day = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(v);
  if (day) return { date: new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])), allDay: true };
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  const iso = compact ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6] ?? '00'}${compact[7] ?? ''}` : v;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
}

interface SchemaEvent {
  name?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
  id?: string;
}

/** The first schema.org Event in the HTML's microdata (itemprop attributes). */
function microdataEvent(html: string): SchemaEvent | null {
  const at = html.search(/itemtype\s*=\s*["']https?:\/\/schema\.org\/Event["']/i);
  if (at < 0) return null;
  const scope = html.slice(at);
  // Nested items (the publisher, people, places) have names of their own: skip over them.
  const outside = scope.replace(/<(\w+)[^>]*itemprop\s*=\s*["'](?:publisher|organizer|attendee|performer)["'][^>]*itemscope[\s\S]*?<\/\1>/gi, '');
  const prop = (name: string, text = scope): string | undefined => {
    const tag = new RegExp(`<(\\w+)([^>]*\\bitemprop\\s*=\\s*["']${name}["'][^>]*)>`, 'i').exec(text);
    if (!tag) return undefined;
    const attrs = tag[2]!;
    const attr = /\b(?:content|datetime)\s*=\s*"([^"]*)"/i.exec(attrs) ?? /\b(?:content|datetime)\s*=\s*'([^']*)'/i.exec(attrs);
    if (attr) return decodeEntities(attr[1]!);
    const close = text.indexOf(`</${tag[1]}`, tag.index);
    return close < 0 ? undefined : stripTags(text.slice(tag.index + tag[0].length, close)) || undefined;
  };
  const placeAt = scope.search(/itemprop\s*=\s*["']location["']/i);
  const place = placeAt < 0 ? undefined : scope.slice(placeAt, placeAt + 4000);
  return {
    name: prop('name', outside),
    start: prop('startDate'),
    end: prop('endDate'),
    location: place ? (prop('name', place) ?? prop('address', place) ?? prop('location', scope)) : undefined,
    description: prop('description', outside),
    id: prop('eventId/googleCalendar') ?? prop('url', outside),
  };
}

/** The first Event in the HTML's JSON-LD (`<script type="application/ld+json">`). */
function jsonLdEvent(html: string): SchemaEvent | null {
  const scripts = html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body!);
    } catch {
      continue;
    }
    const queue: unknown[] = [data];
    while (queue.length) {
      const item = queue.shift();
      if (Array.isArray(item)) { queue.push(...item); continue; }
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const types = ([] as unknown[]).concat(o['@type']);
      if (types.some((t) => typeof t === 'string' && /Event$/.test(t)) && typeof o.startDate === 'string') {
        const loc = o.location as Record<string, unknown> | string | undefined;
        const address = typeof loc === 'object' ? loc?.address : undefined;
        return {
          name: typeof o.name === 'string' ? o.name : undefined,
          start: o.startDate,
          end: typeof o.endDate === 'string' ? o.endDate : undefined,
          location: typeof loc === 'string' ? loc : typeof loc?.name === 'string' ? loc.name : typeof address === 'string' ? address : undefined,
          description: typeof o.description === 'string' ? o.description : undefined,
          id: typeof o['@id'] === 'string' ? o['@id'] : typeof o.url === 'string' ? o.url : undefined,
        };
      }
      queue.push(...Object.values(o).filter((v) => v && typeof v === 'object'));
    }
  }
  return null;
}

/** The note the sender wrote above a shared event ("Boaz Cohen: …" in the preview line). */
function senderNote(html: string): string | undefined {
  const m = /itemtype\s*=\s*["']https?:\/\/schema\.org\/EmailMessage["'][^>]*>\s*<p[^>]*itemprop\s*=\s*["']description["'][^>]*>([\s\S]*?)<\/p>/i.exec(html);
  return m ? stripTags(m[1]!) || undefined : undefined;
}

function schemaImport(html: string): ICSImport | null {
  const found = jsonLdEvent(html) ?? microdataEvent(html);
  const start = found?.start ? schemaDate(found.start) : null;
  if (!found || !start) return null;
  const endParsed = found.end ? schemaDate(found.end) : null;
  let end: Date;
  if (start.allDay) {
    // schema.org days, like iCalendar's, end on the morning after the last day.
    const last = endParsed && endParsed.date > start.date ? addDays(endParsed.date, endParsed.allDay ? -1 : 0) : start.date;
    end = endOfDay(last);
  } else {
    end = endParsed && endParsed.date >= start.date ? endParsed.date : start.date;
  }
  const id = found.id?.trim();
  const event: Event = {
    // Google's invite UIDs are `<event id>@google.com`: share the id so a later invite matches.
    id: id ? `ics-${/^[a-z0-9_]+$/i.test(id) ? `${id}@google.com` : id}` : `ics-${start.date.getTime()}-${found.name ?? ''}`,
    title: found.name?.trim() || 'Untitled event',
    description: found.description?.trim() || senderNote(html),
    location: found.location?.trim() || undefined,
    startDate: (start.allDay ? startOfDay(start.date) : start.date).toISOString(),
    endDate: end.toISOString(),
    isAllDay: start.allDay,
    floating: false,
    calendarId: '',
    pauseWindows: [],
    skippedDates: [],
    reminders: [],
    tags: [],
  };
  return { events: [event], skipped: 0 };
}

// ---------- Entry point ----------

/**
 * Reads an .ics file or an email holding an invitation. Returns null when there's no calendar data
 * in it at all.
 */
export function parseInvite(text: string, allDayTime: number): ICSImport | null {
  if (!looksLikeEmail(text)) return parseICS(text, allDayTime);
  const parts = leafParts(splitEntity(text));
  const calendarParts = parts.filter((p) => CALENDAR_TYPES.test(p.type) || /\.ics$/i.test(p.fileName ?? ''));
  for (const part of calendarParts) {
    const data = parseICS(part.text, allDayTime);
    // An invite.ics attachment repeats the text/calendar part: the first one with events wins.
    if (data?.events.length) return data;
  }
  for (const part of parts.filter((p) => p.type === 'text/html')) {
    const data = schemaImport(part.text);
    if (data) return data;
  }
  return null;
}
