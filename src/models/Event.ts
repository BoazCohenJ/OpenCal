import type { PauseWindow } from './PauseWindow';

export type { PauseWindow } from './PauseWindow';

export interface Event {
  id: string;
  title: string;
  description?: string;
  /**
   * ISO timestamp: a UTC instant for fixed-time events, a zone-less wall-clock time for floating and
   * all-day events (see toFloatingISO). All-day events: local midnight of the first day.
   */
  startDate: string;
  /** Same format as startDate. All-day events: local end of the last day. */
  endDate: string;
  isAllDay: boolean;
  /**
   * Floating time: the event stays at the same clock time in any time zone (9:00 stays 9:00 when
   * you travel) instead of the same moment. All-day events always float. Undefined only on events
   * that haven't been saved yet; saving applies the app-wide default.
   */
  floating?: boolean;
  location?: string;
  calendarId: string;
  /** Hex override. Falls back to the calendar color when unset. */
  color?: string;
  /** RRULE body without DTSTART, e.g. `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO`. Undefined = one-off. */
  recurrenceRule?: string;
  pauseWindows: PauseWindow[];
  /**
   * Days (`yyyy-MM-dd`) whose occurrence of a repeating event was deleted on its own ("only this
   * event"). Kept apart from pauses, which the user sets up on purpose. iCalendar calls these EXDATEs.
   */
  skippedDates?: string[];
  /** Minutes before start. */
  reminders: number[];
  emoji?: string;
  tags: string[];
}
