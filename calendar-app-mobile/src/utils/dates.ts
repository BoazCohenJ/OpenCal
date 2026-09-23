import { addMinutes, format, isSameDay, isSameYear, startOfDay } from 'date-fns';
import type { PauseWindow } from '../models/PauseWindow';

export const WEEK_STARTS_ON = 0 as const;

export const dayKey = (d: Date): string => format(d, 'yyyy-MM-dd');

export const parseDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

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
