export interface QuietHours {
  enabled: boolean;
  /** Minutes since midnight. May be later than `end` (overnight window, e.g. 22:00 → 07:00). */
  start: number;
  end: number;
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
  /** Reminders that fall inside quiet hours are delivered silently. */
  quietHours: QuietHours;
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
  quietHours: { enabled: false, start: 22 * 60, end: 7 * 60 },
  horizonDays: 30,
  mutedCalendarIds: [],
};

/** Merges stored prefs over the defaults so fields added in later versions get sane values. */
export function normalizeNotificationPrefs(stored: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  const p = { ...DEFAULT_NOTIFICATION_PREFS, ...(stored ?? {}) };
  return {
    ...p,
    quietHours: { ...DEFAULT_NOTIFICATION_PREFS.quietHours, ...(stored?.quietHours ?? {}) },
    defaultReminders: Array.isArray(p.defaultReminders) ? p.defaultReminders : DEFAULT_NOTIFICATION_PREFS.defaultReminders,
    defaultAllDayReminders: Array.isArray(p.defaultAllDayReminders)
      ? p.defaultAllDayReminders
      : DEFAULT_NOTIFICATION_PREFS.defaultAllDayReminders,
    mutedCalendarIds: Array.isArray(p.mutedCalendarIds) ? p.mutedCalendarIds : [],
    horizonDays: Number.isFinite(p.horizonDays) && p.horizonDays > 0 ? p.horizonDays : DEFAULT_NOTIFICATION_PREFS.horizonDays,
  };
}

export function isInQuietHours(date: Date, quiet: QuietHours): boolean {
  if (!quiet.enabled || quiet.start === quiet.end) return false;
  const m = date.getHours() * 60 + date.getMinutes();
  return quiet.start < quiet.end ? m >= quiet.start && m < quiet.end : m >= quiet.start || m < quiet.end;
}
