import type { Event } from '../models/Event';
import { parseTimestamp, toFloatingISO } from '../utils/dates';

/** All-day events always float; others when the user turned floating time on. */
export const isFloating = (event: Event): boolean => event.isAllDay || event.floating === true;

/**
 * Puts an event's times in their stored format: zone-less wall-clock times for floating and all-day
 * events, UTC instants otherwise. Events that don't say yet get `floatingByDefault`.
 */
export function withStoredTimes(event: Event, floatingByDefault: boolean): Event {
  const e = { ...event, floating: event.floating ?? floatingByDefault };
  const convert = isFloating(e) ? toFloatingISO : (d: Date) => d.toISOString();
  return { ...e, startDate: convert(parseTimestamp(e.startDate)), endDate: convert(parseTimestamp(e.endDate)) };
}

const MINUTE = 60000;
const DAY_MS = 1440 * MINUTE;
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/**
 * Converts a pre-1.3.0 all-day timestamp to wall-clock format without using the phone's current
 * zone. Those were stored as the UTC instant of local midnight (start) or local 23:59:59.999 (end)
 * in whatever zone the event was created in. At local midnight the UTC time of day is minus that
 * zone's offset, so the offset, and with it the original date, can be read back from the instant.
 * Real offsets span 26 hours (−12 to +14) but the time of day only distinguishes 24, so the window
 * is −10:15 to +13:45: that keeps Hawaii (−10), New Zealand and Tonga (+13) and the Chatham Islands
 * (+13:45), losing only Niue and American Samoa (−11) and Kiribati's Line Islands (+14). Anything
 * that isn't on a boundary falls back to the phone's zone.
 */
function legacyAllDayTimestamp(iso: string, isEnd: boolean): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const midnight = isEnd ? t + 1 : t;
  const msOfDay = ((midnight % DAY_MS) + DAY_MS) % DAY_MS;
  // Zone offsets are whole multiples of 15 minutes; anything else wasn't a local midnight.
  if (msOfDay % (15 * MINUTE) !== 0) return toFloatingISO(new Date(t));
  let offset = -msOfDay; // local = UTC + offset, taken in (−10:15, +13:45]
  if (offset <= -(10 * 60 + 15) * MINUTE) offset += DAY_MS;
  // UTC fields of this instant read as the original local wall clock.
  const wall = new Date((isEnd ? midnight - 1 : midnight) + offset);
  const date = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;
  return `${date}T${isEnd ? '23:59:59.999' : '00:00:00.000'}`;
}

/** One-time 1.3.0 migration of an all-day event stored the old way (see legacyAllDayTimestamp). */
export const migrateLegacyAllDay = (event: Event): Event => ({
  ...event,
  startDate: legacyAllDayTimestamp(event.startDate, false),
  endDate: legacyAllDayTimestamp(event.endDate, true),
});
