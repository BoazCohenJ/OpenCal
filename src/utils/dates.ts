import { addMinutes, differenceInCalendarDays, differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears, format, isSameDay, isSameYear, startOfDay } from 'date-fns';
import type { PauseWindow } from '../models/PauseWindow';

export const WEEK_STARTS_ON = 0 as const;

export const dayKey = (d: Date): string => format(d, 'yyyy-MM-dd');

export const parseDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/**
 * Wall-clock timestamp with no zone, e.g. `2026-10-05T09:30:00.000`. `new Date()` reads it as local
 * time wherever the phone is, which is how floating and all-day events are stored.
 */
export const toFloatingISO = (d: Date): string => format(d, "yyyy-MM-dd'T'HH:mm:ss.SSS");

/**
 * Parses a stored event timestamp. Zone-less ones (toFloatingISO) are read as local time by hand
 * rather than trusting each JS engine's `Date` parsing of them; anything else goes to `new Date`.
 */
export function parseTimestamp(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(s.trim());
  if (!m) return new Date(s);
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number) as [number, number, number, number, number];
  return new Date(y, mo - 1, d, h, mi, Number(m[6] ?? 0), Number((m[7] ?? '0').padEnd(3, '0')));
}

/** True for a timestamp stored without a zone (see toFloatingISO). */
export const isFloatingISO = (s: string): boolean => !/(Z|[+-]\d{2}:?\d{2})$/i.test(s.trim());

/** The phone's IANA time zone, e.g. `Asia/Jerusalem`, or null if it can't be read. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export const formatTime = (d: Date): string => format(d, d.getMinutes() === 0 ? 'h a' : 'h:mm a');
export const formatDate = (d: Date): string => format(d, 'EEE, MMM d');

export function formatRange(start: Date, end: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return isSameDay(start, end)
      ? `${formatDate(start)} · All day`
      : `${formatDate(start)} – ${formatDate(end)} · All day`;
  }
  if (isSameDay(start, end)) return `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  return `${formatDate(start)} ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`;
}

export function formatPauseWindow(w: PauseWindow): string {
  const s = parseDayKey(w.startDate);
  const e = parseDayKey(w.endDate);
  if (w.startDate === w.endDate) return format(s, 'MMM d, yyyy');
  return isSameYear(s, e)
    ? `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
    : `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
}

export function nextRoundedHour(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export const minutesSinceMidnight = (d: Date): number => d.getHours() * 60 + d.getMinutes();

export const atMinutes = (day: Date, minutes: number): Date => addMinutes(startOfDay(day), minutes);

/** True when the range covers more than one calendar day (an end exactly at midnight does not count). */
export const isMultiDay = (start: Date, end: Date): boolean =>
  dayKey(start) !== dayKey(new Date(Math.max(start.getTime(), end.getTime() - 1)));

const ago = (n: number, unit: string) => {
  const abs = Math.abs(n);
  const u = `${abs} ${unit}${abs === 1 ? '' : 's'}`;
  return n > 0 ? `In ${u}` : `${u} ago`;
};

/**
 * Where `cursor` sits relative to today at the granularity of the current view:
 * "Today", "Tomorrow", "In 3 days", "Last week", "In 2 months"…
 */
export function relativeLabel(mode: 'day' | 'week' | 'month' | 'schedule', cursor: Date, now = new Date()): string {
  if (mode === 'week') {
    const n = differenceInCalendarWeeks(cursor, now, { weekStartsOn: WEEK_STARTS_ON });
    if (n === 0) return 'This week';
    if (n === 1) return 'Next week';
    if (n === -1) return 'Last week';
    return Math.abs(n) < 9 ? ago(n, 'week') : ago(differenceInCalendarMonths(cursor, now), 'month');
  }
  if (mode === 'month') {
    const n = differenceInCalendarMonths(cursor, now);
    if (n === 0) return 'This month';
    if (n === 1) return 'Next month';
    if (n === -1) return 'Last month';
    return Math.abs(n) < 24 ? ago(n, 'month') : ago(differenceInCalendarYears(cursor, now), 'year');
  }
  const n = differenceInCalendarDays(cursor, now);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (Math.abs(n) < 14) return ago(n, 'day');
  if (Math.abs(n) < 63) return ago(Math.round(n / 7), 'week');
  return ago(differenceInCalendarMonths(cursor, now), 'month');
}
