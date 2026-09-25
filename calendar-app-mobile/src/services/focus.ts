import { addDays } from 'date-fns';
import type { Event } from '../models/Event';
import type { FocusKind, FocusWindow } from '../models/NotificationPrefs';
import { expandEvent } from './occurrences';

export interface FocusPeriod {
  window: FocusWindow;
  kind: FocusKind;
  start: Date;
  end: Date;
}

/** Reuses the event recurrence engine by viewing a focus window as a minimal event. */
const asEvent = (w: FocusWindow): Event => ({
  id: w.id,
  title: w.label ?? '',
  startDate: w.startDate,
  endDate: w.endDate,
  isAllDay: false,
  calendarId: '',
  recurrenceRule: w.recurrenceRule,
  pauseWindows: [],
  reminders: [],
  tags: [],
});

/** Concrete periods of the enabled windows overlapping [from, to), sorted by start. */
export function expandFocusWindows(windows: FocusWindow[], from: Date, to: Date): FocusPeriod[] {
  return windows
    .filter((w) => w.enabled)
    .flatMap((w) => expandEvent(asEvent(w), undefined, from, to).map((o) => ({ window: w, kind: w.kind, start: o.start, end: o.end })))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Do Not Disturb beats quiet when periods overlap. */
export function focusStateAt(date: Date, periods: FocusPeriod[]): FocusKind | null {
  let state: FocusKind | null = null;
  for (const p of periods) {
    if (date >= p.start && date < p.end) {
      if (p.kind === 'dnd') return 'dnd';
      state = 'quiet';
    }
  }
  return state;
}

/** The period covering `date` (DND first), if any; used for "Quiet until 7:00 AM" style status. */
export function activeFocusPeriod(windows: FocusWindow[], date = new Date()): FocusPeriod | null {
  const periods = expandFocusWindows(windows, addDays(date, -2), addDays(date, 1)).filter((p) => date >= p.start && date < p.end);
  return periods.find((p) => p.kind === 'dnd') ?? periods[0] ?? null;
}
