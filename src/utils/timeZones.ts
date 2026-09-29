/*
 * IANA time zone helpers built on Intl (no bundled tz database). A "wall clock" date here is a Date
 * whose UTC fields hold a local clock reading, the same convention as toFloatingUTC in recurrence.ts.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
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
  return f;
}

const QUARTER_HOUR = 15 * 60000;
const DAY = 86400000;

/** Offset at an instant with no milliseconds, straight from Intl (slow). */
function intlOffset(at: number, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - at;
}

/** Per zone: cached offsets keyed by UTC day (`d<n>`, null on a day the offset changes) or quarter hour (`q<n>`). */
const offsetCache = new Map<string, Map<string, number | null>>();

function cached(cache: Map<string, number | null>, key: string, compute: () => number | null): number | null {
  if (cache.has(key)) return cache.get(key)!;
  const value = compute();
  cache.set(key, value);
  return value;
}

/**
 * Offset of `timeZone` from UTC at `utcMs`, in ms. Throws for unknown zones. Intl is slow, so this
 * is cached: per UTC day when the day starts and ends on the same offset (zones change offset at
 * most once a day), otherwise per quarter hour (changes happen on quarter-hour boundaries).
 */
export function zoneOffset(utcMs: number, timeZone: string): number {
  let cache = offsetCache.get(timeZone);
  if (!cache || cache.size > 20000) {
    cache = new Map();
    offsetCache.set(timeZone, cache);
  }
  const day = Math.floor(utcMs / DAY);
  const whole = cached(cache, `d${day}`, () => {
    const start = intlOffset(day * DAY, timeZone);
    return intlOffset((day + 1) * DAY, timeZone) === start ? start : null;
  });
  if (whole !== null) return whole;
  const quarter = Math.floor(utcMs / QUARTER_HOUR);
  return cached(cache, `q${quarter}`, () => intlOffset(quarter * QUARTER_HOUR, timeZone))!;
}

/** True when this JS engine knows the zone (and can convert with it). */
export function isValidTimeZone(timeZone: string | undefined | null): timeZone is string {
  if (!timeZone) return false;
  try {
    zoneOffset(0, timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock reading of `instant` in `timeZone`. */
export const toZoneWallClock = (instant: Date, timeZone: string): Date =>
  new Date(instant.getTime() + zoneOffset(instant.getTime(), timeZone));

/** The instant at which `timeZone`'s clocks read `wall`. Two passes settle daylight-saving edges. */
export function fromZoneWallClock(wall: Date, timeZone: string): Date {
  const guess = wall.getTime();
  const first = guess - zoneOffset(guess, timeZone);
  return new Date(guess - zoneOffset(first, timeZone));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `yyyy-MM-dd` of a wall clock date. */
export const wallDayKey = (wall: Date): string =>
  `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;

/** Midnight (as a wall clock date) of a `yyyy-MM-dd` key. */
export const wallFromDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
};
