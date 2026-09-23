import { addDays, startOfDay } from 'date-fns';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { PauseWindow } from '../models/PauseWindow';
import { DEFAULT_EVENT_COLOR } from '../utils/color';
import { dayKey } from '../utils/dates';
import { createRule, fromFloatingUTC, toFloatingUTC } from '../utils/recurrence';

export interface Occurrence {
  /** Unique per occurrence: `${eventId}@${startMs}` */
  key: string;
  event: Event;
  start: Date;
  end: Date;
  color: string;
}

export const isDateInPauseWindows = (date: Date, windows: PauseWindow[]): boolean => {
  const k = dayKey(date);
  return windows.some((w) => k >= w.startDate && k <= w.endDate);
};

export const getEffectiveColor = (event: Event, calendar?: Calendar): string =>
  event.color || calendar?.color || DEFAULT_EVENT_COLOR;

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  if (end.getTime() <= start.getTime()) return start >= rangeStart && start < rangeEnd;
  return start < rangeEnd && end > rangeStart;
}

/**
 * Expands an event into concrete occurrences overlapping [rangeStart, rangeEnd).
 * An occurrence of a recurring event is skipped when its start date falls in either
 * the event's own pause windows or its calendar's pause windows.
 */
export function expandEvent(event: Event, calendar: Calendar | undefined, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const duration = Math.max(0, end.getTime() - start.getTime());
  const color = getEffectiveColor(event, calendar);
  const make = (s: Date): Occurrence => ({
    key: `${event.id}@${s.getTime()}`,
    event,
    start: s,
    end: new Date(s.getTime() + duration),
    color,
  });

  const rule = event.recurrenceRule ? createRule(event.recurrenceRule, start) : null;
  if (!rule) return overlaps(start, end, rangeStart, rangeEnd) ? [make(start)] : [];

  const pauses = [...event.pauseWindows, ...(calendar?.pauseWindows ?? [])];
  const from = toFloatingUTC(new Date(rangeStart.getTime() - duration));
  const to = toFloatingUTC(rangeEnd);
  return rule
    .between(from, to, true)
    .map(fromFloatingUTC)
    .filter((s) => !isDateInPauseWindows(s, pauses))
    .map(make)
    .filter((o) => overlaps(o.start, o.end, rangeStart, rangeEnd));
}

export function expandEvents(
  events: Event[],
  calendarsById: Record<string, Calendar>,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) out.push(...expandEvent(e, calendarsById[e.calendarId], rangeStart, rangeEnd));
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

export function occurrencesForDay(occs: Occurrence[], day: Date): Occurrence[] {
  const s = startOfDay(day);
  const e = addDays(s, 1);
  return occs.filter((o) => overlaps(o.start, o.end, s, e));
}

/** Next occurrence at or after `from` (searches up to 5 years ahead). */
export function nextOccurrence(event: Event, calendar: Calendar | undefined, from: Date): Occurrence | null {
  for (const days of [31, 366, 366 * 5]) {
    const occs = expandEvent(event, calendar, from, addDays(from, days));
    if (occs.length) return occs[0] ?? null;
  }
  return null;
}

export function isPausedOn(event: Event, calendar: Calendar | undefined, date: Date): boolean {
  if (!event.recurrenceRule) return false;
  return isDateInPauseWindows(date, [...event.pauseWindows, ...(calendar?.pauseWindows ?? [])]);
}
