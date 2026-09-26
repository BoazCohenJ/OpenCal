import type { Event } from '../models/Event';
import { parseTimestamp, toFloatingISO } from '../utils/dates';

/** All-day events always float; others when the user turned floating time on. */
export const isFloating = (event: Event): boolean => event.isAllDay || event.floating === true;

/**
 * Puts an event's times in their stored format: zone-less wall-clock times for floating and all-day
 * events, UTC instants otherwise. Events that don't say yet get `floatingByDefault`.
 */
export function withStoredTimes(event: Event, floatingByDefault: boolean): Event {
  const e = { ...event, floating: event.floating ?? floatingByDefault };
  const convert = isFloating(e) ? toFloatingISO : (d: Date) => d.toISOString();
  return { ...e, startDate: convert(parseTimestamp(e.startDate)), endDate: convert(parseTimestamp(e.endDate)) };
}
