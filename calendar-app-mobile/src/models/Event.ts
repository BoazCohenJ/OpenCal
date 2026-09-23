import type { PauseWindow } from './PauseWindow';

export type { PauseWindow } from './PauseWindow';

export interface Event {
  id: string;
  title: string;
  description?: string;
  /** ISO timestamp. All-day events: local midnight of the first day. */
  startDate: string;
  /** ISO timestamp. All-day events: local end of the last day. */
  endDate: string;
  isAllDay: boolean;
  location?: string;
  calendarId: string;
  /** Hex override. Falls back to the calendar color when unset. */
  color?: string;
  /** RRULE body without DTSTART, e.g. `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO`. Undefined = one-off. */
  recurrenceRule?: string;
  pauseWindows: PauseWindow[];
  /** Minutes before start. */
  reminders: number[];
  emoji?: string;
  tags: string[];
}
