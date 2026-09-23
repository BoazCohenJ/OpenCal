import { addDays, startOfDay } from 'date-fns';
import type { Occurrence } from '../services/occurrences';
import { isMultiDay } from '../utils/dates';

export const HOUR_HEIGHT = 56;
export const PX_PER_MIN = HOUR_HEIGHT / 60;
const MIN_BLOCK_MIN = 20;

export interface PositionedOccurrence {
  occ: Occurrence;
  top: number;
  height: number;
  column: number;
  columns: number;
}

/** All-day and multi-day occurrences go in the all-day strip rather than the time grid. */
export const isAllDayLike = (o: Occurrence): boolean => o.event.isAllDay || isMultiDay(o.start, o.end);

/** Positions timed occurrences for one day, splitting overlaps into side-by-side columns. */
export function layoutTimed(occs: Occurrence[], day: Date): PositionedOccurrence[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const items = occs
    .map((occ) => {
      const s = Math.max(occ.start.getTime(), dayStart);
      const e = Math.min(Math.max(occ.end.getTime(), s + MIN_BLOCK_MIN * 60000), dayEnd);
      return { occ, s, e };
    })
    .sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s));

  const result: PositionedOccurrence[] = [];
  let cluster: { item: (typeof items)[number]; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = columnEnds.length;
    for (const { item, column } of cluster) {
      result.push({
        occ: item.occ,
        top: ((item.s - dayStart) / 60000) * PX_PER_MIN,
        height: Math.max(MIN_BLOCK_MIN, (item.e - item.s) / 60000) * PX_PER_MIN,
        column,
        columns,
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
  return result;
}
