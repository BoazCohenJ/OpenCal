import type { Birthday } from '../models/Birthday';
import type { Calendar } from '../models/Calendar';
import type { ColorRule } from '../models/ColorRule';
import type { Event } from '../models/Event';
import { BIRTHDAY_COLOR, BIRTHDAYS_CALENDAR_ID, expandBirthdays } from '../services/birthdays';
import * as db from '../services/database';
import { foldOccurrences } from '../services/fold';
import { expandEvents, type Occurrence } from '../services/occurrences';
import { BIRTHDAYS_KEY, COLOR_RULES_KEY, HIDDEN_CALENDARS_KEY, THEME_MODE_KEY } from '../services/settingKeys';
import type { ThemeMode } from '../theme';

/** Widget-only state, kept on this phone (sync only carries the settings it lists). */
const WIDGET_PAGES_KEY = 'widgetPages';
const WIDGET_SETTINGS_KEY = 'widgetSettings';

/** What a widget draws from. */
export interface WidgetSource {
  /** Occurrences in [start, end) of every calendar, hidden ones included, birthdays in. */
  allOccurrences: (start: Date, end: Date) => Occurrence[];
  calendarsById: Record<string, Calendar>;
  /** Calendars (and the birthdays id) hidden in the app's View menu. */
  hidden: ReadonlySet<string>;
  themeMode: ThemeMode;
}

/** One widget's own choices, set on its settings screen when it's added (see WidgetConfigScreen). */
export interface WidgetSettings {
  /** Calendars (and the birthdays id) this widget shows; unset = the same as the app. */
  calendarIds?: string[];
  /** Show every event, even in calendars folded into one block. */
  showAll?: boolean;
}

let opened = false;

/**
 * Widgets render in the background, sometimes before the app has run this launch, so they can read
 * straight from the database rather than from CalendarContext.
 */
function open(): void {
  if (opened) return;
  db.initDatabase();
  opened = true;
}

/** The app's own data while it's running (see WidgetWatcher), so widgets don't re-read the database. */
let live: WidgetSource | null = null;

export function setLiveWidgetSource(source: WidgetSource | null): void {
  live = source;
}

/**
 * Events and calendars as last read from the database, kept while they're unchanged. Reusing the
 * same objects lets every widget (and every redraw) share the repeats already worked out for them.
 */
let snapshot: { version: string; events: Event[]; calendarsById: Record<string, Calendar> } | null = null;

function databaseSource(): WidgetSource {
  open();
  const version = db.contentVersion();
  if (snapshot?.version !== version) {
    const calendarsById: Record<string, Calendar> = {};
    for (const c of db.loadCalendars()) calendarsById[c.id] = c;
    snapshot = { version, events: db.loadEvents(), calendarsById };
  }
  const { events, calendarsById } = snapshot;
  const hidden = new Set(db.getSetting<string[]>(HIDDEN_CALENDARS_KEY, []));
  const rules = db.getSetting<ColorRule[]>(COLOR_RULES_KEY, []);
  const birthdays = db.getSetting<Birthday[]>(BIRTHDAYS_KEY, []);
  return {
    themeMode: db.getSetting<ThemeMode>(THEME_MODE_KEY, 'system'),
    calendarsById,
    hidden,
    allOccurrences: (start, end) => {
      const occurrences = expandEvents(events, calendarsById, start, end, rules);
      if (!birthdays.length) return occurrences;
      return [...expandBirthdays(birthdays, start, end), ...occurrences].sort(
        (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
      );
    },
  };
}

export const widgetSource = (): WidgetSource => live ?? databaseSource();

/** What one widget shows: its own calendars (else the app's), folded unless it's set to show everything. */
export function widgetOccurrences(source: WidgetSource, settings: WidgetSettings): (start: Date, end: Date) => Occurrence[] {
  const picked = settings.calendarIds ? new Set(settings.calendarIds) : null;
  const shows = (calendarId: string) => (picked ? picked.has(calendarId) : !source.hidden.has(calendarId));
  return (start, end) =>
    foldOccurrences(
      source.allOccurrences(start, end).filter((o) => shows(o.event.calendarId)),
      source.calendarsById,
      { unfoldAll: settings.showAll },
    );
}

export function getWidgetSettings(widgetId: number): WidgetSettings {
  open();
  return db.getSetting<Record<string, WidgetSettings>>(WIDGET_SETTINGS_KEY, {})[widgetId] ?? {};
}

/** Saves a widget's settings; null forgets them (the widget was removed). */
export function setWidgetSettings(widgetId: number, settings: WidgetSettings | null): void {
  open();
  const all = { ...db.getSetting<Record<string, WidgetSettings>>(WIDGET_SETTINGS_KEY, {}) };
  if (settings) all[widgetId] = settings;
  else delete all[widgetId];
  db.setSetting(WIDGET_SETTINGS_KEY, all);
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

/** What the widget settings screen offers: every calendar (and Birthdays, if any), and the app's choices. */
export function widgetChoices(): {
  calendars: { id: string; name: string; color: string; folded: boolean }[];
  hidden: string[];
  themeMode: ThemeMode;
} {
  open();
  const calendars = db.loadCalendars().map((c) => ({ id: c.id, name: c.name, color: c.color, folded: !!c.fold?.enabled }));
  if (db.getSetting<Birthday[]>(BIRTHDAYS_KEY, []).length) {
    calendars.push({ id: BIRTHDAYS_CALENDAR_ID, name: 'Birthdays', color: BIRTHDAY_COLOR, folded: false });
  }
  return { calendars, hidden: db.getSetting<string[]>(HIDDEN_CALENDARS_KEY, []), themeMode: db.getSetting<ThemeMode>(THEME_MODE_KEY, 'system') };
}
