import type { Calendar, CalendarFold } from '../models/Calendar';
import type { Event } from '../models/Event';
import { dayKey, isMultiDay } from '../utils/dates';
import type { Occurrence } from './occurrences';

/**
 * Folding: a calendar's back-to-back events on one day (lessons, meetings) drawn as one block named
 * after the calendar. Only the views do this; reminders, sync and the assistant still see every event.
 */
export interface FoldInfo {
  calendarId: string;
  /** `yyyy-MM-dd` of the day the block is on; unfolding works per calendar and day. */
  day: string;
  /** Events the block stands for, exceptions included. */
  members: Occurrence[];
  /** Exceptions shown on top of the folded block. */
  shown: number;
  /** True for an unfolded block: drawn as a thin rail with a Fold button, its events drawn as usual. */
  expanded: boolean;
}

export type FoldedOccurrence = Occurrence & {
  /** Set on the block itself (a stand-in occurrence, not a real event). */
  fold?: FoldInfo;
  /** Set on a real event drawn inside a block (an exception, or any event of an unfolded block). */
  inFold?: 'folded' | 'expanded';
};

export const FOLD_ID_PREFIX = 'fold:';

/** A block stands in for events; it isn't one, so it can't be opened, selected or moved. */
export const isFoldBlock = (o: Occurrence): o is FoldedOccurrence & { fold: FoldInfo } => !!(o as FoldedOccurrence).fold;
export const foldOf = (o: Occurrence): FoldInfo | undefined => (o as FoldedOccurrence).fold;
export const inFoldOf = (o: Occurrence): FoldedOccurrence['inFold'] => (o as FoldedOccurrence).inFold;

/** `calendarId|yyyy-MM-dd`, the unit that unfolds. */
export const foldKey = (calendarId: string, day: string): string => `${calendarId}|${day}`;

export interface FoldOptions {
  /** Calendar/day pairs (see foldKey) the user tapped open. */
  expanded?: ReadonlySet<string>;
  /** Treat every calendar as unfolded (the "Show all events" switch, or a widget set to show everything). */
  unfoldAll?: boolean;
}

/** Whether an event stays visible on top of its calendar's folded block. */
export function breaksThrough(event: Event, fold: CalendarFold): boolean {
  if (event.alwaysShow) return true;
  if (fold.showOneOffs && !event.recurrenceRule) return true;
  if (fold.keywords.length) {
    const title = event.title.toLowerCase();
    return fold.keywords.some((k) => k.trim() && title.includes(k.trim().toLowerCase()));
  }
  return false;
}

const foldable = (o: Occurrence): boolean => !o.event.isAllDay && !isMultiDay(o.start, o.end);

/**
 * Replaces runs of back-to-back events in folded calendars with one block each. A run needs at least
 * two events; gaps up to the calendar's `maxGapMinutes` keep it going. The result stays sorted by
 * start (longest first on ties), with each block just before the events drawn on it.
 */
export function foldOccurrences(
  occurrences: Occurrence[],
  calendarsById: Record<string, Calendar | undefined>,
  options: FoldOptions = {},
): Occurrence[] {
  if (options.unfoldAll) return occurrences;
  const groups = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const fold = calendarsById[o.event.calendarId]?.fold;
    if (!fold?.enabled || !foldable(o)) continue;
    const key = foldKey(o.event.calendarId, dayKey(o.start));
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }
  if (!groups.size) return occurrences;

  const replaced = new Map<string, FoldedOccurrence[]>();
  const removed = new Set<string>();
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const calendar = calendarsById[list[0]!.event.calendarId]!;
    const fold = calendar.fold!;
    const day = key.slice(key.indexOf('|') + 1);
    const expanded = options.expanded?.has(key) ?? false;
    const gap = Math.max(0, fold.maxGapMinutes) * 60000;
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
    const runs: Occurrence[][] = [];
    let current: Occurrence[] | null = null;
    let runEnd = -Infinity;
    for (const o of sorted) {
      if (current && o.start.getTime() - runEnd <= gap) {
        current.push(o);
        runEnd = Math.max(runEnd, o.end.getTime());
      } else {
        current = [o];
        runs.push(current);
        runEnd = o.end.getTime();
      }
    }
    for (const run of runs) {
      if (run.length < 2) continue;
      const start = run[0]!.start;
      const end = new Date(Math.max(...run.map((o) => o.end.getTime())));
      const exceptions = expanded ? run : run.filter((o) => breaksThrough(o.event, fold));
      const block: FoldedOccurrence = {
        key: `${FOLD_ID_PREFIX}${calendar.id}@${start.getTime()}`,
        start,
        end,
        color: calendar.color,
        event: {
          id: `${FOLD_ID_PREFIX}${calendar.id}@${start.getTime()}`,
          title: calendar.name,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          isAllDay: false,
          calendarId: calendar.id,
          pauseWindows: [],
          reminders: [],
          tags: [],
        },
        fold: { calendarId: calendar.id, day, members: run, shown: expanded ? run.length : exceptions.length, expanded },
      };
      for (const o of run) removed.add(o.key);
      // The block goes where its first event was; the events drawn on it follow.
      replaced.set(run[0]!.key, [block, ...exceptions.map((o) => ({ ...o, inFold: expanded ? ('expanded' as const) : ('folded' as const) }))]);
    }
  }
  if (!removed.size) return occurrences;
  const out: Occurrence[] = [];
  for (const o of occurrences) {
    const swap = replaced.get(o.key);
    if (swap) out.push(...swap);
    else if (!removed.has(o.key)) out.push(o);
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || (isFoldBlock(b) ? 1 : 0) - (isFoldBlock(a) ? 1 : 0) || b.end.getTime() - a.end.getTime());
}
