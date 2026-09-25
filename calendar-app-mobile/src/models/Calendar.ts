import type { PauseWindow } from './PauseWindow';

/**
 * Values new events in this calendar start with. Each field is optional; unset fields fall back to
 * the app-wide defaults. Events copy these at creation, so later edits to an event are its own.
 */
export interface CalendarDefaults {
  /** Minutes before start. `undefined` = use the app-wide notification defaults. */
  reminders?: number[];
  /** RRULE body, e.g. `FREQ=WEEKLY;INTERVAL=1`. */
  recurrenceRule?: string;
  location?: string;
  tags?: string[];
}

export interface Calendar {
  id: string;
  name: string;
  /** Default hex color inherited by events without an override. */
  color: string;
  sortOrder: number;
  /** Pauses every recurring event in this calendar. Composes with per-event pauses. */
  pauseWindows: PauseWindow[];
  defaults?: CalendarDefaults;
}
