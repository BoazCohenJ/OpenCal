import { addMinutes } from 'date-fns';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { NotificationPrefs } from '../models/NotificationPrefs';
import type { EventDraft } from '../navigation/types';
import { nextRoundedHour, parseTimestamp } from '../utils/dates';
import { newId } from '../utils/id';

/** Fields a calendar can pre-fill. Once the user edits one, switching calendars leaves it alone. */
export type InheritedField = 'reminders' | 'recurrenceRule' | 'location' | 'tags';
export const INHERITED: InheritedField[] = ['reminders', 'recurrenceRule', 'location', 'tags'];

export function defaultRemindersFor(calendar: Calendar | undefined, allDay: boolean, prefs: NotificationPrefs): number[] {
  return [...(calendar?.defaults?.reminders ?? (allDay ? prefs.defaultAllDayReminders : prefs.defaultReminders))];
}

/** What a new event in `calendar` starts with for each inherited field. */
export function inheritedValues(calendar: Calendar | undefined, allDay: boolean, prefs: NotificationPrefs): Pick<Event, InheritedField> {
  return {
    reminders: defaultRemindersFor(calendar, allDay, prefs),
    recurrenceRule: calendar?.defaults?.recurrenceRule,
    location: calendar?.defaults?.location,
    tags: [...(calendar?.defaults?.tags ?? [])],
  };
}

/**
 * A new, unsaved event from a draft: blank fields, then the draft's values, then the calendar's
 * defaults for anything the draft leaves out. Lasts `defaultMinutes` unless the draft says otherwise.
 */
export function buildNewEvent(
  draft: EventDraft | undefined,
  defaultCalendarId: string,
  calendarsById: Record<string, Calendar>,
  prefs: NotificationPrefs,
  defaultMinutes = 60,
): Event {
  const start = draft?.startDate ? parseTimestamp(draft.startDate) : nextRoundedHour();
  const merged: Event = {
    id: newId(),
    title: '',
    startDate: start.toISOString(),
    endDate: addMinutes(start, defaultMinutes).toISOString(),
    isAllDay: false,
    calendarId: defaultCalendarId,
    pauseWindows: [],
    reminders: [],
    tags: [],
  };
  if (draft) {
    for (const [k, v] of Object.entries(draft)) {
      if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
    }
  }
  const calendar = calendarsById[merged.calendarId] ?? calendarsById[defaultCalendarId];
  const inherited = inheritedValues(calendar, merged.isAllDay, prefs);
  for (const field of INHERITED) {
    if (draft?.[field] === undefined) (merged as unknown as Record<string, unknown>)[field] = inherited[field];
  }
  return merged;
}
