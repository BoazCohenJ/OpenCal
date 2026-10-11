import type { Birthday } from '../models/Birthday';
import type { Calendar } from '../models/Calendar';
import type { ColorRule } from '../models/ColorRule';
import { BIRTHDAYS_CALENDAR_ID, expandBirthdays } from '../services/birthdays';
import * as db from '../services/database';
import { expandEvents, type Occurrence } from '../services/occurrences';
import { BIRTHDAYS_KEY, COLOR_RULES_KEY, HIDDEN_CALENDARS_KEY, THEME_MODE_KEY } from '../services/settingKeys';
import type { ThemeMode } from '../theme';

/** Widget-only state, kept on this phone (sync only carries the settings it lists). */
const WIDGET_PAGES_KEY = 'widgetPages';

let opened = false;

/**
 * Widgets render in the background, sometimes before the app has run this launch, so they read
 * straight from the database rather than from CalendarContext.
 */
function open(): void {
  if (opened) return;
  db.initDatabase();
  opened = true;
}

/** Occurrences in [start, end) the way the calendar shows them: hidden calendars left out, birthdays in. */
export function loadOccurrences(start: Date, end: Date): Occurrence[] {
  open();
  const hidden = new Set(db.getSetting<string[]>(HIDDEN_CALENDARS_KEY, []));
  const calendarsById: Record<string, Calendar> = {};
  for (const c of db.loadCalendars()) calendarsById[c.id] = c;
  const events = db.loadEvents().filter((e) => !hidden.has(e.calendarId));
  const occurrences = expandEvents(events, calendarsById, start, end, db.getSetting<ColorRule[]>(COLOR_RULES_KEY, []));
  const birthdays = db.getSetting<Birthday[]>(BIRTHDAYS_KEY, []);
  if (!birthdays.length || hidden.has(BIRTHDAYS_CALENDAR_ID)) return occurrences;
  return [...expandBirthdays(birthdays, start, end), ...occurrences].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  );
}

export function loadThemeMode(): ThemeMode {
  open();
  return db.getSetting<ThemeMode>(THEME_MODE_KEY, 'system');
}

/** How many weeks/months a Week or Month widget has been paged away from today. */
export function getWidgetPage(widgetId: number): number {
  open();
  return db.getSetting<Record<string, number>>(WIDGET_PAGES_KEY, {})[widgetId] ?? 0;
}

/** Sets a widget's page; null forgets the widget (removed from the home screen). */
export function setWidgetPage(widgetId: number, page: number | null): void {
  open();
  const pages = { ...db.getSetting<Record<string, number>>(WIDGET_PAGES_KEY, {}) };
  if (page) pages[widgetId] = page;
  else delete pages[widgetId];
  db.setSetting(WIDGET_PAGES_KEY, pages);
}
