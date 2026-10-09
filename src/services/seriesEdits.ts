import { differenceInCalendarDays } from 'date-fns';
import type { Event } from '../models/Event';
import { dayKey, parseDayKey, parseTimestamp } from '../utils/dates';
import { newId } from '../utils/id';
import { createRuleAt, endRuleBefore, WEEKDAY_CODES } from '../utils/recurrence';
import { wallDayKey } from '../utils/timeZones';
import { eventClock, occurrenceDayKey } from './eventTimes';

/** Which occurrences of a repeating event a change or delete applies to. */
export type SeriesScope = 'this' | 'following' | 'all';

export interface SeriesChange {
  /** Events to save (updated series and any new events split from it). */
  save: Event[];
  /** Events to delete. */
  deleteIds: string[];
}

const shiftDayKey = (key: string, days: number): string => {
  if (!days) return key;
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
};

/** Moves every weekday in a weekly BYDAY by `days` (a Monday occurrence moved to Tuesday keeps repeating on Tuesdays). */
function shiftWeekdays(rule: string, days: number): string {
  const step = ((days % 7) + 7) % 7;
  if (!step) return rule;
  return rule
    .replace(/^RRULE:/i, '')
    .split(';')
    .map((part) => {
      const [k, v] = part.split('=');
      if (k?.toUpperCase() !== 'BYDAY' || !v) return part;
      const shifted = v.split(',').map((code) => {
        const m = /^([+-]?\d*)([A-Z]{2})$/i.exec(code.trim());
        const i = m ? WEEKDAY_CODES.indexOf(m[2]!.toUpperCase()) : -1;
        return m && i >= 0 ? `${m[1]}${WEEKDAY_CODES[(i + step) % 7]}` : code;
      });
      return `BYDAY=${shifted.join(',')}`;
    })
    .join(';');
}

/** The rule's COUNT reduced by the repeats before `occurrenceStart`, for a series continuing from there. */
function remainingCount(series: Event, rule: string, occurrenceStart: Date): string {
  const count = /(?:^|;)COUNT=(\d+)/i.exec(rule);
  if (!count) return rule;
  const clock = eventClock(series);
  const r = createRuleAt(rule, clock.toWall(parseTimestamp(series.startDate)));
  if (!r) return rule;
  const before = clock.toWall(occurrenceStart).getTime();
  const done = r.all((d) => d.getTime() < before).filter((d) => d.getTime() < before).length;
  return rule.replace(/COUNT=\d+/i, `COUNT=${Math.max(1, Number(count[1]) - done)}`);
}

/**
 * Applies an edit made to one occurrence of a repeating event.
 *
 * `edited` is the series as the editor left it, with the occurrence's own (possibly changed) start
 * and end. `occurrenceStart` is where that occurrence originally started.
 * - `this`: the series skips that day and a one-off copy with the changes takes its place.
 * - `following`: the series ends the day before and a new series with the changes starts at the
 *   occurrence (keeping later skipped days, and what's left of a COUNT).
 * - `all`: the whole series takes the changes; a time change moves every occurrence by the same
 *   amount, and a weekly series moved to another weekday repeats on that weekday instead.
 */
export function editSeries(series: Event, edited: Event, occurrenceStart: Date, scope: SeriesScope): SeriesChange {
  const rule = series.recurrenceRule;
  if (!rule) return { save: [{ ...edited, id: series.id }], deleteIds: [] };

  const occKey = occurrenceDayKey(series, occurrenceStart);
  const editedStart = parseTimestamp(edited.startDate);
  const editedEnd = parseTimestamp(edited.endDate);
  const oldClock = eventClock(series);
  const newClock = eventClock(edited);
  const dayShift = differenceInCalendarDays(
    parseDayKey(wallDayKey(newClock.toWall(editedStart))),
    parseDayKey(wallDayKey(oldClock.toWall(occurrenceStart))),
  );
  const ruleUnchanged = edited.recurrenceRule === rule;
  const carryRule = (r: string | undefined) => (r && ruleUnchanged ? shiftWeekdays(r, dayShift) : r);

  if (scope === 'this') {
    return {
      save: [
        { ...series, skippedDates: [...new Set([...(series.skippedDates ?? []), occKey])].sort() },
        { ...edited, id: newId(), recurrenceRule: undefined, pauseWindows: [], skippedDates: [] },
      ],
      deleteIds: [],
    };
  }

  const seriesStart = parseTimestamp(series.startDate);
  const firstKey = occurrenceDayKey(series, seriesStart);

  if (scope === 'all' || occKey <= firstKey) {
    // Turning repeat off for the whole series leaves one event, the one being edited.
    if (!edited.recurrenceRule) return { save: [{ ...edited, id: series.id, skippedDates: [] }], deleteIds: [] };
    // Move the first occurrence by the same wall-clock amount the edited one moved.
    const wallDelta = newClock.toWall(editedStart).getTime() - oldClock.toWall(occurrenceStart).getTime();
    const start = newClock.fromWall(new Date(oldClock.toWall(seriesStart).getTime() + wallDelta));
    const end = new Date(start.getTime() + Math.max(0, editedEnd.getTime() - editedStart.getTime()));
    return {
      save: [
        {
          ...edited,
          id: series.id,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          recurrenceRule: carryRule(edited.recurrenceRule),
          skippedDates: (edited.skippedDates ?? []).map((k) => shiftDayKey(k, dayShift)),
        },
      ],
      deleteIds: [],
    };
  }

  // This and following: end the old series the day before, start a new one here.
  const skipped = edited.skippedDates ?? [];
  const ended: Event = {
    ...series,
    recurrenceRule: endRuleBefore(rule, parseDayKey(occKey)),
    skippedDates: skipped.filter((k) => k < occKey),
  };
  const nextRule = edited.recurrenceRule && ruleUnchanged ? remainingCount(series, rule, occurrenceStart) : edited.recurrenceRule;
  const continued: Event = {
    ...edited,
    id: newId(),
    recurrenceRule: carryRule(nextRule),
    pauseWindows: edited.recurrenceRule ? edited.pauseWindows : [],
    skippedDates: edited.recurrenceRule ? skipped.filter((k) => k > occKey).map((k) => shiftDayKey(k, dayShift)) : [],
  };
  return { save: [ended, continued], deleteIds: [] };
}

/**
 * Deletes one occurrence (`day` = its occurrenceDayKey date at local midnight), it and the ones
 * after, or the whole series. "This and following" from the first day deletes the series.
 */
export function deleteFromSeries(series: Event, day: Date, scope: SeriesScope): SeriesChange {
  if (!series.recurrenceRule) return { save: [], deleteIds: [series.id] };
  const firstDay = parseDayKey(occurrenceDayKey(series, parseTimestamp(series.startDate)));
  if (scope === 'all' || (scope === 'following' && day <= firstDay)) return { save: [], deleteIds: [series.id] };
  if (scope === 'this') {
    return { save: [{ ...series, skippedDates: [...new Set([...(series.skippedDates ?? []), dayKey(day)])].sort() }], deleteIds: [] };
  }
  return { save: [{ ...series, recurrenceRule: endRuleBefore(series.recurrenceRule, day) }], deleteIds: [] };
}
