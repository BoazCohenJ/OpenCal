import { addDays, startOfDay } from 'date-fns';
import type { RRule } from 'rrule';
import type { Calendar } from '../models/Calendar';
import type { ColorRule } from '../models/ColorRule';
import type { Event } from '../models/Event';
import type { PauseWindow } from '../models/PauseWindow';
import { DEFAULT_EVENT_COLOR } from '../utils/color';
import { dayKey, deviceTimeZone, parseTimestamp } from '../utils/dates';
import { createRuleAt } from '../utils/recurrence';
import { wallDayKey } from '../utils/timeZones';
import { eventClock, type EventClock } from './eventTimes';

export interface Occurrence {
  /** Unique per occurrence: `${eventId}@${startMs}` */
  key: string;
  event: Event;
  start: Date;
  end: Date;
  color: string;
}

export const isDayInPauseWindows = (key: string, windows: PauseWindow[]): boolean =>
  windows.some((w) => key >= w.startDate && key <= w.endDate);

export const isDateInPauseWindows = (date: Date, windows: PauseWindow[]): boolean => isDayInPauseWindows(dayKey(date), windows);

export const NO_COLOR_RULES: ColorRule[] = [];

/** The first rule whose keyword is in the title, if any. */
export function matchColorRule(title: string, rules: ColorRule[]): ColorRule | undefined {
  if (!rules.length) return undefined;
  const t = title.toLowerCase();
  return rules.find((r) => r.keyword && t.includes(r.keyword.toLowerCase()));
}

/** An event's own color, else the first matching keyword rule, else its calendar's color. */
export const getEffectiveColor = (event: Event, calendar?: Calendar, rules: ColorRule[] = NO_COLOR_RULES): string =>
  event.color || matchColorRule(event.title, rules)?.color || calendar?.color || DEFAULT_EVENT_COLOR;

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return overlapsMs(start.getTime(), end.getTime(), rangeStart.getTime(), rangeEnd.getTime());
}

/** Everything about an event that doesn't depend on the range asked for, worked out once. */
interface Prepared {
  /** What it was prepared against; a change to either means preparing again. */
  calendar: Calendar | undefined;
  rules: ColorRule[];
  zone: string | null;
  start: number;
  end: number;
  duration: number;
  color: string;
  clock: EventClock;
  rule: RRule | null;
  pauses: PauseWindow[];
  skipped: Set<string>;
  /** Start instants (ms) of the repeats whose date on the event's clock falls in each year, filled on demand. */
  years: Map<number, number[]>;
}

// Keyed by the event object itself: stored events are replaced, never mutated, when they change.
const prepared = new WeakMap<Event, Prepared>();

function prepare(event: Event, calendar: Calendar | undefined, zone: string | null, rules: ColorRule[]): Prepared | null {
  const cached = prepared.get(event);
  if (cached && cached.calendar === calendar && cached.zone === zone && cached.rules === rules) return cached;
  const start = parseTimestamp(event.startDate).getTime();
  const end = parseTimestamp(event.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const clock = eventClock(event);
  const p: Prepared = {
    calendar,
    rules,
    zone,
    start,
    end,
    duration: Math.max(0, end - start),
    color: getEffectiveColor(event, calendar, rules),
    clock,
    rule: event.recurrenceRule ? createRuleAt(event.recurrenceRule, clock.toWall(new Date(start))) : null,
    pauses: [...event.pauseWindows, ...(calendar?.pauseWindows ?? [])],
    skipped: new Set(event.skippedDates ?? []),
    years: new Map(),
  };
  prepared.set(event, p);
  return p;
}

/** Repeats starting in `year` on the event's clock, minus paused and skipped days. */
function repeatsInYear(p: Prepared, rule: RRule, year: number): number[] {
  let list = p.years.get(year);
  if (!list) {
    const walls = rule.between(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1) - 1), true);
    list = [];
    for (const wall of walls) {
      const k = wallDayKey(wall);
      if (!p.skipped.has(k) && !isDayInPauseWindows(k, p.pauses)) list.push(p.clock.fromWall(wall).getTime());
    }
    p.years.set(year, list);
  }
  return list;
}

const overlapsMs = (start: number, end: number, rangeStart: number, rangeEnd: number): boolean =>
  end <= start ? start >= rangeStart && start < rangeEnd : start < rangeEnd && end > rangeStart;

/**
 * Expands an event into concrete occurrences overlapping [rangeStart, rangeEnd).
 * Repeats are worked out on the event's own clock (its time zone for fixed events, see eventClock).
 * An occurrence of a recurring event is skipped when its date (on that clock) falls in either
 * the event's own pause windows or its calendar's pause windows, or is one of its skipped dates.
 * Parsed dates, the rule and the repeats of each year are cached per event object.
 */
export function expandEvent(
  event: Event,
  calendar: Calendar | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  rules: ColorRule[] = NO_COLOR_RULES,
): Occurrence[] {
  return expandPrepared(event, calendar, rangeStart.getTime(), rangeEnd.getTime(), deviceTimeZone(), rules);
}

function expandPrepared(
  event: Event,
  calendar: Calendar | undefined,
  rs: number,
  re: number,
  zone: string | null,
  rules: ColorRule[],
): Occurrence[] {
  const p = prepare(event, calendar, zone, rules);
  if (!p) return [];
  const make = (s: number): Occurrence => ({
    key: `${event.id}@${s}`,
    event,
    start: new Date(s),
    end: new Date(s + p.duration),
    color: p.color,
  });
  if (!p.rule) return overlapsMs(p.start, p.end, rs, re) ? [make(p.start)] : [];
  // Nothing repeats before the first occurrence.
  if (re <= p.start) return [];

  const out: Occurrence[] = [];
  const first = p.clock.toWall(new Date(Math.max(rs - p.duration, p.start))).getUTCFullYear();
  const last = p.clock.toWall(new Date(re)).getUTCFullYear();
  for (let year = first; year <= last; year++) {
    for (const s of repeatsInYear(p, p.rule, year)) {
      if (overlapsMs(s, s + p.duration, rs, re)) out.push(make(s));
    }
  }
  return out;
}

export function expandEvents(
  events: Event[],
  calendarsById: Record<string, Calendar>,
  rangeStart: Date,
  rangeEnd: Date,
  rules: ColorRule[] = NO_COLOR_RULES,
): Occurrence[] {
  const out: Occurrence[] = [];
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  const zone = deviceTimeZone();
  for (const e of events) {
    for (const o of expandPrepared(e, calendarsById[e.calendarId], rs, re, zone, rules)) out.push(o);
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

export function occurrencesForDay(occs: Occurrence[], day: Date): Occurrence[] {
  const s = startOfDay(day);
  const e = addDays(s, 1);
  return occs.filter((o) => overlaps(o.start, o.end, s, e));
}

/**
 * `occurrencesForDay` for `count` consecutive days from `from` at once: one list per day, each in
 * the order of `occs`. Goes through the occurrences once instead of once per day.
 */
export function occurrencesByDay(occs: Occurrence[], from: Date, count: number): Occurrence[][] {
  const first = startOfDay(from);
  const bounds = Array.from({ length: count + 1 }, (_, i) => addDays(first, i).getTime());
  const lists: Occurrence[][] = Array.from({ length: count }, () => []);
  for (const o of occs) {
    const s = o.start.getTime();
    const e = o.end.getTime();
    // First day that ends after the start, then every day it still overlaps.
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bounds[mid + 1]! <= s) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < count && bounds[i]! < Math.max(e, s + 1); i++) {
      if (overlapsMs(s, e, bounds[i]!, bounds[i + 1]!)) lists[i]!.push(o);
    }
  }
  return lists;
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
