import { addDays, startOfDay } from 'date-fns';
import { newId } from '../utils/id';

/**
 * `quiet`: reminders still arrive, silently. `dnd`: reminders inside the window are not sent at all.
 */
export type FocusKind = 'quiet' | 'dnd';

/**
 * A scheduled quiet / Do Not Disturb period. Works like an event: a first occurrence plus an
 * optional repeat rule, e.g. "every Monday 17:00–18:00" or "Sept 30, all evening".
 */
export interface FocusWindow {
  id: string;
  kind: FocusKind;
  label?: string;
  /** ISO start of the first occurrence. */
  startDate: string;
  /** ISO end of the first occurrence; may be the next day for overnight windows. */
  endDate: string;
  /** RRULE body (same format as events). Undefined = one-off. */
  recurrenceRule?: string;
  enabled: boolean;
}

export interface NotificationPrefs {
  /** Master switch. When off, every scheduled reminder is cancelled. */
  enabled: boolean;
  /** Reminders pre-selected on new timed events (minutes before start). */
  defaultReminders: number[];
  /** Reminders pre-selected on new all-day events (minutes before `allDayTime`). */
  defaultAllDayReminders: number[];
  /** All-day reminders are measured from this time of day instead of midnight. Minutes since midnight. */
  allDayTime: number;
  sound: boolean;
  focusWindows: FocusWindow[];
  /** How far ahead reminders are scheduled. The app tops the queue up whenever it is opened. */
  horizonDays: number;
  /** Calendars whose events never send reminders. */
  mutedCalendarIds: string[];
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  defaultReminders: [10],
  defaultAllDayReminders: [0],
  allDayTime: 9 * 60,
  sound: true,
  focusWindows: [],
  horizonDays: 30,
  mutedCalendarIds: [],
};

const atMinutes = (day: Date, minutes: number) => new Date(startOfDay(day).getTime() + minutes * 60000);

/** A nightly window between two times of day (end on the next day when it is earlier than start). */
export function dailyFocusWindow(kind: FocusKind, startMinutes: number, endMinutes: number, label?: string): FocusWindow {
  const today = new Date();
  const start = atMinutes(today, startMinutes);
  const end = atMinutes(endMinutes <= startMinutes ? addDays(today, 1) : today, endMinutes);
  return {
    id: newId(),
    kind,
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
    enabled: true,
  };
}

interface LegacyQuietHours {
  enabled: boolean;
  start: number;
  end: number;
}

/** Merges stored prefs over the defaults so fields added in later versions get sane values. */
export function normalizeNotificationPrefs(
  stored: (Partial<NotificationPrefs> & { quietHours?: LegacyQuietHours }) | null | undefined,
): NotificationPrefs {
  const { quietHours, ...rest } = stored ?? {};
  const p = { ...DEFAULT_NOTIFICATION_PREFS, ...rest };
  let focusWindows = Array.isArray(p.focusWindows) ? p.focusWindows : [];
  // v1 stored a single daily "quiet hours" range; turn it into a repeating window.
  if (!Array.isArray(stored?.focusWindows) && quietHours?.enabled && quietHours.start !== quietHours.end) {
    focusWindows = [dailyFocusWindow('quiet', quietHours.start, quietHours.end, 'Night')];
  }
  return {
    ...p,
    focusWindows,
    defaultReminders: Array.isArray(p.defaultReminders) ? p.defaultReminders : DEFAULT_NOTIFICATION_PREFS.defaultReminders,
    defaultAllDayReminders: Array.isArray(p.defaultAllDayReminders)
      ? p.defaultAllDayReminders
      : DEFAULT_NOTIFICATION_PREFS.defaultAllDayReminders,
    mutedCalendarIds: Array.isArray(p.mutedCalendarIds) ? p.mutedCalendarIds : [],
    horizonDays: Number.isFinite(p.horizonDays) && p.horizonDays > 0 ? p.horizonDays : DEFAULT_NOTIFICATION_PREFS.horizonDays,
  };
}
