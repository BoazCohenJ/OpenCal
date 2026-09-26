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

/** Offset of `timeZone` from UTC at `utcMs`, in ms. Throws for unknown zones. */
export function zoneOffset(utcMs: number, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  // formatToParts drops milliseconds; keep them so round trips are exact.
  return asUtc - (utcMs - (((utcMs % 1000) + 1000) % 1000));
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
