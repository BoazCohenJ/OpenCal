import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import type { GestureResponderEvent } from 'react-native';
import type { Occurrence } from '../services/occurrences';
import { isMultiDay } from '../utils/dates';

export const HOUR_HEIGHT = 56;
export const PX_PER_MIN = HOUR_HEIGHT / 60;
/** Shortest drawn height of an event: room for a one-line title. */
export const MIN_BLOCK_PX = 22;

export interface PositionedOccurrence {
  occ: Occurrence;
  top: number;
  height: number;
  column: number;
  columns: number;
  /** Horizontal start and width as fractions of the day column. */
  x: number;
  w: number;
}

/**
 * Minutes since midnight (snapped down to 30) for a tap on a time grid.
 * React Native Web leaves `locationY` undefined on Pressable events, so fall back to the DOM `offsetY`.
 */
export function slotMinutesFromPress(e: GestureResponderEvent): number {
  const native = e.nativeEvent as GestureResponderEvent['nativeEvent'] & { offsetY?: number };
  const y = Number.isFinite(native.locationY) ? native.locationY : (native.offsetY ?? 0);
  const minutes = Math.floor(y / PX_PER_MIN / 30) * 30;
  return Math.min(Math.max(Number.isFinite(minutes) ? minutes : 0, 0), 24 * 60 - 30);
}

/** All-day and multi-day occurrences go in the all-day strip rather than the time grid. */
export const isAllDayLike = (o: Occurrence): boolean => o.event.isAllDay || isMultiDay(o.start, o.end);

/**
 * Positions timed occurrences for one day, splitting only events that really overlap into
 * side-by-side columns. Events that follow each other never share a row. A short event is drawn at
 * least `minHeight` tall so its title is readable; whatever starts right after it is nudged down
 * (keeping its true end) instead of being squeezed beside it.
 */
export function layoutTimed(occs: Occurrence[], day: Date, minHeight = MIN_BLOCK_PX): PositionedOccurrence[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const items = occs
    .map((occ) => {
      const s = Math.max(occ.start.getTime(), dayStart);
      const e = Math.min(Math.max(occ.end.getTime(), s + 60000), dayEnd);
      return { occ, s, e };
    })
    .sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s));

  const result: (PositionedOccurrence & { trueBottom: number })[] = [];
  let cluster: { item: (typeof items)[number]; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = columnEnds.length;
    for (const { item, column } of cluster) {
      const top = ((item.s - dayStart) / 60000) * PX_PER_MIN;
      const trueHeight = ((item.e - item.s) / 60000) * PX_PER_MIN;
      result.push({
        occ: item.occ,
        top,
        height: Math.max(minHeight, trueHeight),
        trueBottom: top + trueHeight,
        column,
        columns,
        x: column / columns,
        w: 1 / columns,
      });
    }
    cluster = [];
    columnEnds = [];
  };

  for (const item of items) {
    if (cluster.length && item.s >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= item.s);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.e);
    } else {
      columnEnds[column] = item.e;
    }
    cluster.push({ item, column });
    clusterEnd = cluster.length === 1 ? item.e : Math.max(clusterEnd, item.e);
  }
  if (cluster.length) flush();

  // Make room for enlarged short events: later blocks that only touch them start below them.
  result.sort((a, b) => a.top - b.top);
  for (let i = 0; i < result.length; i++) {
    const a = result[i]!;
    for (let j = i + 1; j < result.length; j++) {
      const b = result[j]!;
      const sideBySide = a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6;
      if (sideBySide || a.trueBottom > b.top + 0.5 || a.top + a.height <= b.top) continue;
      const bottom = b.top + b.height;
      b.top = a.top + a.height;
      b.height = Math.max(minHeight, bottom - b.top);
    }
  }
  return result;
}

/** First and last calendar day an occurrence covers (an end exactly at midnight belongs to the day before). */
function dayRange(o: Occurrence): { first: Date; last: Date } {
  return { first: startOfDay(o.start), last: startOfDay(new Date(Math.max(o.start.getTime(), o.end.getTime() - 1))) };
}

/** Where `day` falls in a multi-day occurrence ("2 of 3"), or null for one that fits in a day. */
export function spanInfo(o: Occurrence, day: Date): { current: number; total: number } | null {
  const { first, last } = dayRange(o);
  const total = differenceInCalendarDays(last, first) + 1;
  if (total < 2) return null;
  return { current: Math.min(total, Math.max(1, differenceInCalendarDays(day, first) + 1)), total };
}

export interface SpanSegment {
  occ: Occurrence;
  /** First column (day) of the row it covers, and how many columns it runs across. */
  col: number;
  length: number;
  lane: number;
  /** Continues from the previous row / into the next one, so that end is drawn square. */
  fromPrev: boolean;
  toNext: boolean;
}

/**
 * All-day and multi-day occurrences as bars across one row of `columns` days starting at `rowStart`
 * (a week). Each bar is one long piece over the days it covers, stacked in lanes so they never overlap.
 */
export function layoutSpans(occs: Occurrence[], rowStart: Date, columns = 7): { segments: SpanSegment[]; lanes: number } {
  const start = startOfDay(rowStart);
  const segments: SpanSegment[] = [];
  for (const occ of occs) {
    if (!isAllDayLike(occ)) continue;
    const { first, last } = dayRange(occ);
    const a = differenceInCalendarDays(first, start);
    const b = differenceInCalendarDays(last, start);
    if (b < 0 || a >= columns) continue;
    const col = Math.max(0, a);
    segments.push({ occ, col, length: Math.min(columns - 1, b) - col + 1, lane: 0, fromPrev: a < 0, toNext: b > columns - 1 });
  }
  segments.sort((x, y) => x.col - y.col || y.length - x.length || x.occ.start.getTime() - y.occ.start.getTime());
  const laneEnds: number[] = [];
  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end < seg.col);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = seg.col + seg.length - 1;
    seg.lane = lane;
  }
  return { segments, lanes: laneEnds.length };
}
