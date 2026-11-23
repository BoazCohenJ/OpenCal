import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import { withStoredTimes } from './eventTimes';
import { parseICS } from './ical';
import { syncEqual } from './syncEqual';

/*
 * How a subscribed calendar's events change to match its feed. Kept apart from the refresh itself
 * (subscriptions.ts) so it has no app-only imports and can be tested on its own.
 */

/** Fields the feed owns. Everything else (reminders, alarms, color, icon, pauses, Always show) is the user's. */
const FEED_FIELDS = [
  'title', 'description', 'location', 'startDate', 'endDate', 'isAllDay', 'floating', 'timeZone',
  'recurrenceRule', 'skippedDates', 'tags', 'calendarId',
] as const satisfies readonly (keyof Event)[];

const feedPart = (e: Event) => Object.fromEntries(FEED_FIELDS.map((k) => [k, e[k]]));

export interface RefreshPlan {
  save: Event[];
  remove: string[];
  /** Events in the feed. */
  total: number;
}

/** What to write so `calendar` matches `text`, keeping the user's own per-event extras. */
export function planRefresh(calendar: Calendar, text: string, current: Event[], allDayTime: number): RefreshPlan {
  const parsed = parseICS(text, allDayTime);
  if (!parsed) throw new Error('That address didn’t return a calendar (.ics) file');
  const existing = new Map(current.filter((e) => e.calendarId === calendar.id).map((e) => [e.id, e]));
  const seen = new Set<string>();
  const save: Event[] = [];
  for (const raw of parsed.events) {
    const id = `sub-${calendar.id}-${raw.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const incoming = withStoredTimes({ ...raw, id, calendarId: calendar.id }, false);
    const old = existing.get(id);
    if (old && syncEqual(feedPart(old), feedPart(incoming))) continue;
    save.push(
      old
        ? {
            ...incoming,
            reminders: old.reminders,
            alarms: old.alarms,
            alarmsInQuiet: old.alarmsInQuiet,
            color: old.color,
            emoji: old.emoji,
            pauseWindows: old.pauseWindows,
            alwaysShow: old.alwaysShow,
          }
        : {
            ...incoming,
            // Feeds rarely carry reminders; the calendar's defaults decide, and the default is none.
            reminders: incoming.reminders.length ? incoming.reminders : (calendar.defaults?.reminders ?? []),
          },
    );
  }
  const remove = [...existing.keys()].filter((id) => !seen.has(id));
  return { save, remove, total: seen.size };
}

