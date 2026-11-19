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

/**
 * Folding: on Day, Week and Schedule, back-to-back events of this calendar (a school day of lessons,
 * a day of meetings) show as one block named after the calendar until it's tapped open. Kept even
 * while `enabled` is off, so turning folding back on restores the same choices.
 */
export interface CalendarFold {
  enabled: boolean;
  /** Events this close (or overlapping) join the same block. */
  maxGapMinutes: number;
  /** One-off events (not part of a repeat) stay visible on top of the block. */
  showOneOffs: boolean;
  /** Events whose title contains one of these (case ignored) stay visible on top of the block. */
  keywords: string[];
}

export const DEFAULT_FOLD: CalendarFold = { enabled: true, maxGapMinutes: 60, showOneOffs: false, keywords: [] };

export interface Calendar {
  id: string;
  name: string;
  /** Default hex color inherited by events without an override. */
  color: string;
  sortOrder: number;
  /** Pauses every recurring event in this calendar. Composes with per-event pauses. */
  pauseWindows: PauseWindow[];
  defaults?: CalendarDefaults;
  fold?: CalendarFold;
}
