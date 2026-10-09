import { addDays, addMinutes, differenceInCalendarDays, endOfDay, format, startOfDay } from 'date-fns';
import type { Calendar } from '../../src/models/Calendar.ts';
import type { Event } from '../../src/models/Event.ts';
import { occurrenceDayKey, withStoredTimes } from '../../src/services/eventTimes.ts';
import { expandEvent, expandEvents, type Occurrence } from '../../src/services/occurrences.ts';
import { normalizeHex } from '../../src/utils/color.ts';
import { dayKey, deviceTimeZone, parseDayKey, parseTimestamp } from '../../src/utils/dates.ts';
import { newId } from '../../src/utils/id.ts';
import { NAMED_PALETTE } from '../../src/utils/palette.ts';
import { createRule, describeRRule, endRuleBefore } from '../../src/utils/recurrence.ts';
import type { Change, Store, Write } from './store.ts';

/*
 * Calendar operations for an AI agent (served over MCP, see mcp.ts). They work on the server's copy
 * the way the app would: the same event format, repeats worked out by the app's own code, and
 * "only this one" / "this and following" handled like the app's editor. Every change is stamped
 * so phones pick it up on their next sync, and logged so it can be undone.
 *
 * Times the agent sends are read in the server's time zone (TZ) unless they carry an offset;
 * times sent back are in that zone with the offset spelled out.
 */

export class AgentError extends Error {}

const fail = (message: string): never => {
  throw new AgentError(message);
};

export type Scope = 'this' | 'following' | 'all';

export interface EventFields {
  title?: string;
  /** `2026-10-12T14:00`, with an offset, `2026-10-12` (all day), or `14:00` to keep the date. */
  start?: string;
  end?: string;
  durationMinutes?: number;
  allDay?: boolean;
  calendar?: string;
  location?: string | null;
  description?: string | null;
  /** RRULE body (`FREQ=WEEKLY;BYDAY=MO`), or "none" to stop repeating. */
  repeat?: string | null;
  reminders?: number[];
  color?: string | null;
  tags?: string[];
}

const putEvent = (event: Event): Write => ({ kind: 'event', id: event.id, record: event });

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY = /^(\d{1,2}):(\d{2})$/;

export class CalendarAgent {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  get timeZone(): string {
    return deviceTimeZone() ?? 'UTC';
  }

  // ---------- Reading ----------

  private calendars(): Calendar[] {
    return this.store.list<Calendar>('calendar').sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  private calendarsById(): Record<string, Calendar> {
    return Object.fromEntries(this.calendars().map((c) => [c.id, c]));
  }

  /** A calendar by name (ignoring case, spaces and emoji) or id. */
  private calendar(nameOrId: string): Calendar {
    const all = this.calendars();
    const simple = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const byId = all.find((c) => c.id === nameOrId);
    if (byId) return byId;
    const named = all.filter((c) => simple(c.name) === simple(nameOrId));
    if (named.length > 1) {
      fail(`${named.length} calendars are called "${nameOrId}"; use one of their ids instead: ${named.map((c) => c.id).join(', ')}`);
    }
    return named[0] ?? fail(`No calendar called "${nameOrId}". Calendars: ${all.map((c) => c.name).join(', ')}`);
  }

  private event(id: string): Event {
    return this.store.get<Event>('event', id) ?? fail(`No event with id ${id} (it may have been deleted).`);
  }

  listCalendars() {
    const counts = new Map<string, number>();
    for (const e of this.store.list<Event>('event')) counts.set(e.calendarId, (counts.get(e.calendarId) ?? 0) + 1);
    return {
      timeZone: this.timeZone,
      now: this.local(new Date()),
      calendars: this.calendars().map((c) => ({
        name: c.name,
        id: c.id,
        color: colorName(c.color),
        events: counts.get(c.id) ?? 0,
        defaults: c.defaults && Object.keys(c.defaults).length ? c.defaults : undefined,
      })),
      colors: NAMED_PALETTE.map((c) => c.name),
    };
  }

  findEvents(input: { from?: string; to?: string; query?: string; calendar?: string; limit?: number }) {
    const from = input.from ? this.parseDay(input.from, 'from') : startOfDay(new Date());
    const to = input.to ? endOfDay(this.parseDay(input.to, 'to')) : endOfDay(addDays(from, 6));
    if (to < from) fail('"to" is before "from".');
    if (differenceInCalendarDays(to, from) > 400) fail('Search at most about a year at a time.');
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 300);
    const calendar = input.calendar ? this.calendar(input.calendar) : undefined;
    const query = input.query?.trim().toLowerCase();

    let events = this.store.list<Event>('event');
    if (calendar) events = events.filter((e) => e.calendarId === calendar.id);
    if (query) {
      events = events.filter((e) =>
        [e.title, e.description, e.location, ...(e.tags ?? [])].some((s) => s?.toLowerCase().includes(query)),
      );
    }
    const cals = this.calendarsById();
    const occurrences = expandEvents(events, cals, from, to);
    return {
      from: dayKey(from),
      to: dayKey(to),
      total: occurrences.length,
      truncated: occurrences.length > limit ? `Showing the first ${limit}; narrow the dates or search to see the rest.` : undefined,
      events: occurrences.slice(0, limit).map((o) => this.describe(o, cals)),
    };
  }

  getEvent(id: string) {
    const e = this.event(id);
    const cals = this.calendarsById();
    const start = parseTimestamp(e.startDate);
    const end = parseTimestamp(e.endDate);
    return {
      eventId: e.id,
      title: e.title,
      calendar: cals[e.calendarId]?.name ?? e.calendarId,
      ...this.span(start, end, e.isAllDay),
      timing: e.isAllDay ? 'all day' : e.floating ? 'floating (same clock time in any time zone)' : `fixed in ${e.timeZone ?? this.timeZone}`,
      repeat: e.recurrenceRule,
      repeats: e.recurrenceRule ? describeRRule(e.recurrenceRule, start) : undefined,
      skippedDates: e.skippedDates?.length ? e.skippedDates : undefined,
      pauses: e.pauseWindows.length ? e.pauseWindows : undefined,
      location: e.location,
      description: e.description,
      reminders: e.reminders,
      color: e.color ? colorName(e.color) : undefined,
      tags: e.tags.length ? e.tags : undefined,
    };
  }

  // ---------- Changing ----------

  createEvent(fields: EventFields & { title: string; start: string; calendar: string }) {
    if (!fields.title?.trim()) fail('A title is required.');
    const calendar = this.calendar(fields.calendar);
    const allDay = fields.allDay ?? DATE_ONLY.test(fields.start.trim());
    const base: Event = {
      id: newId(),
      title: fields.title.trim(),
      startDate: '',
      endDate: '',
      isAllDay: allDay,
      floating: false,
      calendarId: calendar.id,
      pauseWindows: [],
      skippedDates: [],
      reminders: calendar.defaults?.reminders ?? (allDay ? [] : [10]),
      location: calendar.defaults?.location,
      tags: [...(calendar.defaults?.tags ?? [])],
    };
    const start = this.parseWhen(fields.start, new Date(), 'start');
    const timed = { ...base, startDate: start.toISOString(), endDate: start.toISOString() };
    const event = this.apply(timed, { ...fields, start: fields.start, allDay }, true);
    const changeId = this.store.write([putEvent(event)], 'agent', `Created "${event.title}"`);
    return { changeId, created: this.getEvent(event.id) };
  }

  updateEvent(input: EventFields & { eventId: string; occurrenceDate?: string; scope?: Scope }) {
    const series = this.event(input.eventId);
    const { eventId: _id, occurrenceDate, scope: _scope, ...fields } = input;
    if (!Object.values(fields).some((v) => v !== undefined)) fail('Nothing to change.');
    const scope = this.scopeFor(series, occurrenceDate, input.scope);
    const writes: Write[] = [];
    let result: Event;

    if (scope === 'all') {
      result = this.apply(series, fields, false);
      writes.push(putEvent(result));
    } else {
      const occ = this.occurrenceOn(series, occurrenceDate!);
      const day = occurrenceDayKey(series, occ.start);
      if (scope === 'this') {
        // Like moving one occurrence in the app: the series skips that day, a one-off takes its place.
        const skippedDates = [...new Set([...(series.skippedDates ?? []), day])].sort();
        writes.push(putEvent({ ...series, skippedDates }));
        const single: Event = {
          ...series,
          id: newId(),
          recurrenceRule: undefined,
          pauseWindows: [],
          skippedDates: [],
          startDate: occ.start.toISOString(),
          endDate: occ.end.toISOString(),
        };
        result = this.apply(single, { ...fields, repeat: undefined }, false);
      } else {
        // The series ends the day before; a copy carries on from this occurrence with the changes.
        writes.push(putEvent({ ...series, recurrenceRule: endRuleBefore(series.recurrenceRule!, parseDayKey(day)) }));
        const rest: Event = {
          ...series,
          id: newId(),
          recurrenceRule: series.recurrenceRule!.split(';').filter((p) => !/^COUNT=/i.test(p)).join(';'),
          skippedDates: (series.skippedDates ?? []).filter((d) => d > day),
          startDate: occ.start.toISOString(),
          endDate: occ.end.toISOString(),
        };
        result = this.apply(rest, fields, false);
      }
      writes.push(putEvent(result));
    }
    const what = scope === 'all' ? '' : scope === 'this' ? ` on ${occurrenceDate}` : ` from ${occurrenceDate} on`;
    const changeId = this.store.write(writes, 'agent', `Changed "${series.title}"${what}`);
    return { changeId, scope, updated: this.getEvent(result.id) };
  }

  deleteEvent(input: { eventId: string; occurrenceDate?: string; scope?: Scope }) {
    const event = this.event(input.eventId);
    const scope = this.scopeFor(event, input.occurrenceDate, input.scope);
    let write: Write;
    let summary: string;
    if (scope === 'all') {
      write = { kind: 'event', id: event.id, record: null };
      summary = `Deleted "${event.title}"${event.recurrenceRule ? ' (whole series)' : ''}`;
    } else {
      const occ = this.occurrenceOn(event, input.occurrenceDate!);
      const day = occurrenceDayKey(event, occ.start);
      const firstDay = occurrenceDayKey(event, parseTimestamp(event.startDate));
      if (scope === 'this') {
        write = putEvent({ ...event, skippedDates: [...new Set([...(event.skippedDates ?? []), day])].sort() });
        summary = `Deleted "${event.title}" on ${day}`;
      } else if (day <= firstDay) {
        write = { kind: 'event', id: event.id, record: null };
        summary = `Deleted "${event.title}" (whole series)`;
      } else {
        write = putEvent({ ...event, recurrenceRule: endRuleBefore(event.recurrenceRule!, parseDayKey(day)) });
        summary = `Deleted "${event.title}" from ${day} on`;
      }
    }
    const changeId = this.store.write([write], 'agent', summary);
    return { changeId, deleted: summary };
  }

  recentChanges(limit = 10) {
    return this.store.changes(Math.min(Math.max(limit, 1), 50)).map((c) => ({
      changeId: c.id,
      at: this.local(new Date(c.at)),
      summary: c.summary,
      undone: c.undoneBy ? `undone by change ${c.undoneBy}` : undefined,
    }));
  }

  /** Puts back what a change replaced. Refuses records edited since, unless forced. */
  undo(changeId: number, force = false) {
    const change: Change = this.store.change(changeId) ?? fail(`No change ${changeId}.`);
    if (change.undoneBy) fail(`Change ${changeId} was already undone (by change ${change.undoneBy}).`);
    const writes: Write[] = [];
    const conflicts: string[] = [];
    for (const item of change.items) {
      const current = this.store.get<{ id: string }>(item.kind, item.id) ?? null;
      if (JSON.stringify(current) !== JSON.stringify(item.after)) conflicts.push(item.id);
      writes.push({ kind: item.kind, id: item.id, record: item.before as { id: string } | null });
    }
    if (conflicts.length && !force) {
      fail(`Changed again since change ${changeId} (on a phone or by another change): ${conflicts.join(', ')}. Pass force: true to undo anyway.`);
    }
    const undoId = this.store.write(writes, 'agent', `Undid change ${changeId}: ${change.summary}`);
    this.store.markUndone(changeId, undoId);
    return { changeId: undoId, undid: change.summary };
  }

  // ---------- Helpers ----------

  private scopeFor(event: Event, occurrenceDate: string | undefined, scope: Scope | undefined): Scope {
    if (!event.recurrenceRule) return 'all';
    if (!occurrenceDate) {
      if (scope && scope !== 'all') fail('Give occurrenceDate (yyyy-MM-dd) to change one occurrence or the ones after it.');
      return 'all';
    }
    if (!DATE_ONLY.test(occurrenceDate)) fail('occurrenceDate must look like 2026-10-12.');
    return scope ?? fail('This event repeats: say scope "this" (only that day), "following" (that day and after) or "all".');
  }

  private occurrenceOn(event: Event, day: string): Occurrence {
    const d = parseDayKey(day);
    const occs = expandEvent(event, this.calendarsById()[event.calendarId], addDays(d, -1), addDays(d, 2));
    return occs.find((o) => occurrenceDayKey(event, o.start) === day) ?? fail(`"${event.title}" doesn't happen on ${day}.`);
  }

  /** The event with `fields` applied, in the app's stored format. */
  private apply(event: Event, fields: EventFields, isNew: boolean): Event {
    const e: Event = { ...event };
    if (fields.title !== undefined) e.title = fields.title.trim() || fail('The title can’t be empty.');
    if (fields.calendar !== undefined) e.calendarId = this.calendar(fields.calendar).id;
    if (fields.location !== undefined) e.location = fields.location?.trim() || undefined;
    if (fields.description !== undefined) e.description = fields.description?.trim() || undefined;
    if (fields.tags !== undefined) e.tags = fields.tags.map((t) => t.trim()).filter(Boolean);
    if (fields.reminders !== undefined) {
      if (!fields.reminders.every((m) => Number.isInteger(m) && m >= 0)) fail('Reminders are whole minutes before the start.');
      e.reminders = [...new Set(fields.reminders)].sort((a, b) => a - b);
    }
    if (fields.color !== undefined) e.color = fields.color === null || fields.color === '' ? undefined : parseColor(fields.color);

    // Times: the current span, moved and resized by start / end / duration / all-day.
    const oldStart = parseTimestamp(e.startDate);
    const oldEnd = parseTimestamp(e.endDate);
    const allDay = fields.allDay ?? e.isAllDay;
    if (e.isAllDay && !allDay && (fields.start === undefined || DATE_ONLY.test(fields.start.trim()))) {
      fail('To make an all-day event timed, give a start time too (e.g. 2026-10-12T14:00 or 14:00).');
    }
    let start = fields.start !== undefined ? this.parseWhen(fields.start, oldStart, 'start') : oldStart;
    let end: Date;
    if (fields.end !== undefined) end = this.parseWhen(fields.end, fields.start !== undefined ? start : oldEnd, 'end');
    else if (fields.durationMinutes !== undefined) end = addMinutes(start, fields.durationMinutes);
    else if (isNew) end = allDay ? start : addMinutes(start, 60);
    else end = new Date(start.getTime() + (oldEnd.getTime() - oldStart.getTime()));
    if (allDay) {
      start = startOfDay(start);
      // An all-day end given as a date is the last day; a moved event keeps its number of days.
      end = endOfDay(end < start ? start : end);
    } else if (end <= start) {
      fail('The end has to be after the start.');
    }
    e.isAllDay = allDay;
    e.startDate = start.toISOString();
    e.endDate = end.toISOString();

    if (fields.repeat !== undefined) {
      const rule = fields.repeat?.trim().replace(/^RRULE:/i, '');
      if (!rule || /^none$/i.test(rule)) {
        e.recurrenceRule = undefined;
        e.skippedDates = [];
      } else {
        if (!/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i.test(rule) || /DTSTART/i.test(rule) || !createRule(rule, start)) {
          fail(`"${fields.repeat}" isn't a repeat rule the app understands. Use an RRULE body like FREQ=WEEKLY;BYDAY=MO or FREQ=DAILY;UNTIL=20261231T235959Z.`);
        }
        e.recurrenceRule = rule.toUpperCase();
      }
    }
    // Fixed events are scheduled in the server's zone; floating and all-day ones keep a clock time.
    return withStoredTimes({ ...e, timeZone: e.isAllDay || e.floating ? undefined : (e.timeZone ?? this.timeZone) }, false);
  }

  /** A date for find_events: `2026-10-12`, or any timestamp (its day is used). */
  private parseDay(input: string, name: string): Date {
    const s = input.trim();
    const d = DATE_ONLY.test(s) ? parseDayKey(s) : parseTimestamp(s);
    return Number.isNaN(d.getTime()) ? fail(`"${input}" isn't a date (${name}); use 2026-10-12.`) : startOfDay(d);
  }

  /** A start or end: a full timestamp, a date (all day), or `HH:mm` on `base`'s date. */
  private parseWhen(input: string, base: Date, name: string): Date {
    const s = input.trim();
    const time = TIME_ONLY.exec(s);
    let d: Date;
    if (time) {
      d = new Date(base);
      d.setHours(Number(time[1]), Number(time[2]), 0, 0);
    } else if (DATE_ONLY.test(s)) {
      d = parseDayKey(s);
    } else {
      d = parseTimestamp(s);
    }
    return Number.isNaN(d.getTime()) ? fail(`"${input}" isn't a valid ${name}; use 2026-10-12T14:00, 2026-10-12 or 14:00.`) : d;
  }

  /** `2026-10-12T14:00+03:00` in the server's zone. */
  private local(d: Date): string {
    return format(d, "yyyy-MM-dd'T'HH:mmxxx");
  }

  private span(start: Date, end: Date, allDay: boolean) {
    if (allDay) {
      const last = new Date(end.getTime() - 1);
      const days = differenceInCalendarDays(last, start) + 1;
      return {
        start: dayKey(start),
        end: dayKey(last),
        allDay: true,
        when: `${format(start, 'EEE d MMM yyyy')}${days > 1 ? ` – ${format(last, 'EEE d MMM yyyy')}` : ''} (all day)`,
      };
    }
    const sameDay = dayKey(start) === dayKey(end);
    return {
      start: this.local(start),
      end: this.local(end),
      allDay: false,
      when: `${format(start, 'EEE d MMM yyyy, HH:mm')}–${format(end, sameDay ? 'HH:mm' : 'EEE d MMM, HH:mm')}`,
    };
  }

  private describe(o: Occurrence, cals: Record<string, Calendar>) {
    const e = o.event;
    return {
      eventId: e.id,
      title: e.title,
      calendar: cals[e.calendarId]?.name ?? e.calendarId,
      ...this.span(o.start, o.end, e.isAllDay),
      occurrenceDate: e.recurrenceRule ? occurrenceDayKey(e, o.start) : undefined,
      repeats: e.recurrenceRule ? describeRRule(e.recurrenceRule, parseTimestamp(e.startDate)) : undefined,
      location: e.location,
      description: e.description ? (e.description.length > 300 ? `${e.description.slice(0, 300)}…` : e.description) : undefined,
    };
  }
}

/** A palette name (`Cherry`) or hex; returns `#RRGGBB`. */
function parseColor(input: string): string {
  const named = NAMED_PALETTE.find((c) => c.name.toLowerCase() === input.trim().toLowerCase());
  return (
    named?.hex ??
    normalizeHex(input) ??
    fail(`"${input}" isn't a color. Use a hex like #EF4444 or one of: ${NAMED_PALETTE.map((c) => c.name).join(', ')}.`)
  );
}

const colorName = (hex: string): string => NAMED_PALETTE.find((c) => c.hex === hex.toUpperCase())?.name ?? hex;
