import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Birthday } from '../models/Birthday';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import {
  normalizeNotificationPrefs,
  type NotificationPrefs,
} from '../models/NotificationPrefs';
import type { SavedColor } from '../models/SavedColor';
import type { EventTemplate } from '../models/Template';
import { APP_VERSION } from '../services/appInfo';
import { createBackup, type Backup } from '../services/backup';
import { BIRTHDAYS_CALENDAR_ID, expandBirthdays } from '../services/birthdays';
import * as db from '../services/database';
import { withStoredTimes } from '../services/eventTimes';
import { rescheduleReminders, type ScheduleResult } from '../services/notifications';
import { expandEvents, getEffectiveColor, type Occurrence } from '../services/occurrences';
import type { ThemeMode } from '../theme';
import { isFloatingISO } from '../utils/dates';
import { newId } from '../utils/id';

const HIDDEN_CALENDARS_KEY = 'hiddenCalendarIds';
const NOTIFICATION_PREFS_KEY = 'notificationPrefs';
const THEME_MODE_KEY = 'themeMode';
const SAVED_COLORS_KEY = 'savedColors';
const BIRTHDAYS_KEY = 'birthdays';
const FLOATING_DEFAULT_KEY = 'floatingByDefault';
const DEFAULT_CALENDARS = [
  { name: 'Personal', color: '#4F6BED' },
  { name: 'Work', color: '#F2994A' },
];

export interface ImportSummary {
  calendars: number;
  events: number;
  templates: number;
  birthdays: number;
}

/** Where imported .ics events go: an existing calendar, or a new one. */
export type ImportTarget = { calendarId: string } | { newCalendar: { name: string; color: string } };

interface CalendarContextValue {
  ready: boolean;
  error: string | null;
  calendars: Calendar[];
  calendarsById: Record<string, Calendar>;
  events: Event[];
  templates: EventTemplate[];
  allTags: string[];
  /** Calendar ids (plus `BIRTHDAYS_CALENDAR_ID` for birthdays) currently shown. */
  visibleCalendarIds: string[];
  toggleCalendarVisibility: (id: string) => void;
  saveCalendar: (calendar: Calendar) => void;
  /** Deletes a calendar; `plan` maps each of its event ids to a target calendar id, or null to delete. */
  deleteCalendarWithPlan: (id: string, plan: Record<string, string | null>, templatesTo: string | null) => void;
  saveEvent: (event: Event) => void;
  saveEvents: (events: Event[]) => void;
  deleteEvent: (id: string) => void;
  deleteEvents: (ids: string[]) => void;
  saveTemplate: (template: EventTemplate) => void;
  deleteTemplate: (id: string) => void;
  moveTemplate: (id: string, direction: -1 | 1) => void;
  getEffectiveColor: (event: Event) => string;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  /** Colors the user named in the color picker, oldest first. */
  savedColors: SavedColor[];
  /** Adds a named color, or renames it if that hex is already saved. */
  saveColor: (name: string, hex: string) => void;
  deleteSavedColor: (id: string) => void;
  /** Whether new events get floating time (see Event.floating). */
  floatingByDefault: boolean;
  setFloatingByDefault: (value: boolean) => void;
  /** Sorted by name. Each one shows up on the calendar every year as an all-day event. */
  birthdays: Birthday[];
  saveBirthday: (birthday: Birthday) => void;
  deleteBirthday: (id: string) => void;
  notificationPrefs: NotificationPrefs;
  updateNotificationPrefs: (patch: Partial<NotificationPrefs>) => void;
  /** Result of the most recent reminder scheduling pass (null until the first one finishes). */
  reminderStatus: ScheduleResult | null;
  /** Re-runs scheduling now; with askPermission it may show the OS permission prompt. */
  refreshReminders: (options?: { askPermission?: boolean }) => Promise<ScheduleResult>;
  /** Everything as a JSON backup file (see services/backup.ts). */
  createBackupFile: () => string;
  /** Merge adds and updates by id; replace wipes calendars, events, stamps and birthdays first and restores settings. */
  importBackup: (backup: Backup, mode: 'merge' | 'replace') => ImportSummary;
  /** Adds events (e.g. from an .ics file), updating ones with the same id. */
  importEvents: (events: Event[], target: ImportTarget) => { added: number; updated: number };
  /** Occurrences in [start, end), birthdays included. Excludes hidden calendars unless includeHidden is set. */
  getOccurrences: (start: Date, end: Date, options?: { includeHidden?: boolean }) => Occurrence[];
}

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

export const useCalendarContext = (): CalendarContextValue => {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendarContext must be used within a CalendarProvider');
  return ctx;
};

interface InitialData {
  calendars: Calendar[];
  events: Event[];
  templates: EventTemplate[];
  hiddenCalendarIds: string[];
  themeMode: ThemeMode;
  notificationPrefs: NotificationPrefs;
  savedColors: SavedColor[];
  birthdays: Birthday[];
  floatingByDefault: boolean;
}

/** Opens (and if needed seeds) the database synchronously; runs once, before the first render. */
function loadInitialData(): { data: InitialData; error: null } | { data: null; error: string } {
  try {
    db.initDatabase();
    if (db.loadCalendars().length === 0) {
      DEFAULT_CALENDARS.forEach((c, i) =>
        db.saveCalendar({ id: newId(), name: c.name, color: c.color, sortOrder: i, pauseWindows: [] }),
      );
    }
    // All-day events used to be stored as UTC instants, which shifted them by a day abroad. Store
    // them as wall-clock times (read in the zone they were created in, i.e. the current one).
    const oldAllDay = db.loadEvents().filter((e) => e.isAllDay && !isFloatingISO(e.startDate));
    if (oldAllDay.length) db.saveEvents(oldAllDay.map((e) => withStoredTimes(e, false)));
    return {
      error: null,
      data: {
        calendars: db.loadCalendars(),
        events: db.loadEvents(),
        templates: db.loadTemplates(),
        hiddenCalendarIds: db.getSetting<string[]>(HIDDEN_CALENDARS_KEY, []),
        themeMode: db.getSetting<ThemeMode>(THEME_MODE_KEY, 'system'),
        savedColors: db.getSetting<SavedColor[]>(SAVED_COLORS_KEY, []),
        birthdays: db.getSetting<Birthday[]>(BIRTHDAYS_KEY, []),
        floatingByDefault: db.getSetting<boolean>(FLOATING_DEFAULT_KEY, false),
        notificationPrefs: normalizeNotificationPrefs(
          db.getSetting<Partial<NotificationPrefs> | null>(NOTIFICATION_PREFS_KEY, null),
        ),
      },
    };
  } catch (e) {
    console.error('Failed to open the calendar database', e);
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(loadInitialData);
  // The database is synchronous, so data is ready on the first render.
  const ready = true;
  const error = initial.error;
  const [calendars, setCalendars] = useState<Calendar[]>(initial.data?.calendars ?? []);
  const [events, setEvents] = useState<Event[]>(initial.data?.events ?? []);
  const [templates, setTemplates] = useState<EventTemplate[]>(initial.data?.templates ?? []);
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<string[]>(initial.data?.hiddenCalendarIds ?? []);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(
    () => initial.data?.notificationPrefs ?? normalizeNotificationPrefs(null),
  );
  const [reminderStatus, setReminderStatus] = useState<ScheduleResult | null>(null);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initial.data?.themeMode ?? 'system');
  const [savedColors, setSavedColors] = useState<SavedColor[]>(initial.data?.savedColors ?? []);
  const [birthdays, setBirthdays] = useState<Birthday[]>(initial.data?.birthdays ?? []);
  const [floatingByDefault, setFloatingByDefaultState] = useState(initial.data?.floatingByDefault ?? false);

  const calendarsById = useMemo(() => {
    const map: Record<string, Calendar> = {};
    for (const c of calendars) map[c.id] = c;
    return map;
  }, [calendars]);

  const hiddenSet = useMemo(() => new Set(hiddenCalendarIds), [hiddenCalendarIds]);
  const visibleCalendarIds = useMemo(
    () => [...calendars.map((c) => c.id), BIRTHDAYS_CALENDAR_ID].filter((id) => !hiddenSet.has(id)),
    [calendars, hiddenSet],
  );

  const allTags = useMemo(
    () => Array.from(new Set(events.flatMap((e) => e.tags))).sort((a, b) => a.localeCompare(b)),
    [events],
  );

  const latest = useRef({ events, calendarsById, notificationPrefs });
  useEffect(() => {
    latest.current = { events, calendarsById, notificationPrefs };
  }, [events, calendarsById, notificationPrefs]);

  const refreshReminders = useCallback(async (options?: { askPermission?: boolean }) => {
    const { events: ev, calendarsById: cals, notificationPrefs: prefs } = latest.current;
    const result = await rescheduleReminders(ev, cals, prefs, options);
    setReminderStatus(result);
    return result;
  }, []);

  // Keep scheduled reminders in sync with data and prefs (debounced). Asking for permission here
  // is fine: it only happens once reminders actually exist, and the OS shows the prompt at most once.
  useEffect(() => {
    if (!ready || error) return;
    const id = setTimeout(() => void refreshReminders({ askPermission: true }), 800);
    return () => clearTimeout(id);
  }, [ready, error, events, calendarsById, notificationPrefs, refreshReminders]);

  // Only the next `horizonDays` are queued, so top the queue up (and pick up permission changes
  // made in system settings) whenever the app returns to the foreground.
  useEffect(() => {
    if (!ready || error) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshReminders();
    });
    return () => sub.remove();
  }, [ready, error, refreshReminders]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    db.setSetting(THEME_MODE_KEY, mode);
    setThemeModeState(mode);
  }, []);

  const saveColor = useCallback((name: string, hex: string) => {
    setSavedColors((prev) => {
      const upper = hex.toUpperCase();
      const existing = prev.find((c) => c.hex === upper);
      const next = existing
        ? prev.map((c) => (c.id === existing.id ? { ...c, name } : c))
        : [...prev, { id: newId(), name, hex: upper }];
      db.setSetting(SAVED_COLORS_KEY, next);
      return next;
    });
  }, []);

  const deleteSavedColor = useCallback((id: string) => {
    setSavedColors((prev) => {
      const next = prev.filter((c) => c.id !== id);
      db.setSetting(SAVED_COLORS_KEY, next);
      return next;
    });
  }, []);

  const setFloatingByDefault = useCallback((value: boolean) => {
    db.setSetting(FLOATING_DEFAULT_KEY, value);
    setFloatingByDefaultState(value);
  }, []);

  const saveBirthday = useCallback((birthday: Birthday) => {
    setBirthdays((prev) => {
      const next = [...prev.filter((b) => b.id !== birthday.id), birthday].sort((a, b) => a.name.localeCompare(b.name));
      db.setSetting(BIRTHDAYS_KEY, next);
      return next;
    });
  }, []);

  const deleteBirthday = useCallback((id: string) => {
    setBirthdays((prev) => {
      const next = prev.filter((b) => b.id !== id);
      db.setSetting(BIRTHDAYS_KEY, next);
      return next;
    });
  }, []);

  const updateNotificationPrefs = useCallback((patch: Partial<NotificationPrefs>) => {
    setNotificationPrefs((prev) => {
      const next = normalizeNotificationPrefs({ ...prev, ...patch });
      db.setSetting(NOTIFICATION_PREFS_KEY, next);
      return next;
    });
  }, []);

  const toggleCalendarVisibility = useCallback((id: string) => {
    setHiddenCalendarIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      db.setSetting(HIDDEN_CALENDARS_KEY, next);
      return next;
    });
  }, []);

  const saveCalendar = useCallback((calendar: Calendar) => {
    db.saveCalendar(calendar);
    setCalendars(db.loadCalendars());
  }, []);

  const deleteCalendarWithPlan = useCallback(
    (id: string, plan: Record<string, string | null>, templatesTo: string | null) => {
      db.deleteCalendarWithPlan(id, plan, templatesTo);
      setCalendars(db.loadCalendars());
      setEvents(db.loadEvents());
      setTemplates(db.loadTemplates());
      setHiddenCalendarIds((prev) => {
        const next = prev.filter((x) => x !== id);
        db.setSetting(HIDDEN_CALENDARS_KEY, next);
        return next;
      });
    },
    [],
  );

  const saveEvent = useCallback(
    (event: Event) => {
      db.saveEvent(withStoredTimes(event, floatingByDefault));
      setEvents(db.loadEvents());
    },
    [floatingByDefault],
  );

  const saveEvents = useCallback(
    (list: Event[]) => {
      if (!list.length) return;
      db.saveEvents(list.map((e) => withStoredTimes(e, floatingByDefault)));
      setEvents(db.loadEvents());
    },
    [floatingByDefault],
  );

  const deleteEvent = useCallback((id: string) => {
    db.deleteEvent(id);
    setEvents(db.loadEvents());
  }, []);

  const deleteEvents = useCallback((ids: string[]) => {
    if (!ids.length) return;
    db.deleteEvents(ids);
    setEvents(db.loadEvents());
  }, []);

  const saveTemplate = useCallback(
    (template: EventTemplate) => {
      const isNew = !templates.some((t) => t.id === template.id);
      db.saveTemplate(isNew ? { ...template, sortOrder: templates.length } : template);
      setTemplates(db.loadTemplates());
    },
    [templates],
  );

  const deleteTemplate = useCallback((id: string) => {
    db.deleteTemplate(id);
    setTemplates(db.loadTemplates());
  }, []);

  const moveTemplate = useCallback(
    (id: string, direction: -1 | 1) => {
      const index = templates.findIndex((t) => t.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= templates.length) return;
      const ids = templates.map((t) => t.id);
      const tmp = ids[index]!;
      ids[index] = ids[target]!;
      ids[target] = tmp;
      db.saveTemplateOrder(ids);
      setTemplates(db.loadTemplates());
    },
    [templates],
  );

  const effectiveColor = useCallback(
    (event: Event) => getEffectiveColor(event, calendarsById[event.calendarId]),
    [calendarsById],
  );

  const createBackupFile = useCallback(
    () =>
      createBackup({
        appVersion: APP_VERSION,
        calendars,
        events,
        templates,
        birthdays,
        settings: { themeMode, notificationPrefs, savedColors, hiddenCalendarIds },
      }),
    [calendars, events, templates, birthdays, themeMode, notificationPrefs, savedColors, hiddenCalendarIds],
  );

  const importBackup = useCallback(
    (backup: Backup, mode: 'merge' | 'replace'): ImportSummary => {
      const replace = mode === 'replace';
      let incomingCalendars = backup.calendars;
      if (replace && !incomingCalendars.length) {
        incomingCalendars = [{ id: newId(), name: DEFAULT_CALENDARS[0]!.name, color: DEFAULT_CALENDARS[0]!.color, sortOrder: 0, pauseWindows: [] }];
      }
      // Keep every reference valid: events need a calendar, stamps may have none.
      const known = new Set([...(replace ? [] : calendars.map((c) => c.id)), ...incomingCalendars.map((c) => c.id)]);
      const fallback = incomingCalendars[0]?.id ?? calendars[0]?.id ?? '';
      const eventsIn = backup.events.map((e) =>
        withStoredTimes(known.has(e.calendarId) ? e : { ...e, calendarId: fallback }, false),
      );
      const templatesIn = backup.templates.map((t) => (known.has(t.calendarId) ? t : { ...t, calendarId: '' }));
      db.importData({ calendars: incomingCalendars, events: eventsIn, templates: templatesIn }, replace);
      setCalendars(db.loadCalendars());
      setEvents(db.loadEvents());
      setTemplates(db.loadTemplates());

      const nextBirthdays = [
        ...(replace ? [] : birthdays.filter((b) => !backup.birthdays.some((x) => x.id === b.id))),
        ...backup.birthdays,
      ].sort((a, b) => a.name.localeCompare(b.name));
      db.setSetting(BIRTHDAYS_KEY, nextBirthdays);
      setBirthdays(nextBirthdays);

      const s = backup.settings;
      const incomingColors = s.savedColors ?? [];
      const nextColors = replace
        ? incomingColors
        : [...savedColors, ...incomingColors.filter((c) => !savedColors.some((x) => x.hex === c.hex))];
      db.setSetting(SAVED_COLORS_KEY, nextColors);
      setSavedColors(nextColors);
      if (replace) {
        const hidden = s.hiddenCalendarIds ?? [];
        db.setSetting(HIDDEN_CALENDARS_KEY, hidden);
        setHiddenCalendarIds(hidden);
        if (s.notificationPrefs) {
          const prefs = normalizeNotificationPrefs(s.notificationPrefs);
          db.setSetting(NOTIFICATION_PREFS_KEY, prefs);
          setNotificationPrefs(prefs);
        }
        if (s.themeMode) setThemeMode(s.themeMode);
      }
      return {
        calendars: incomingCalendars.length,
        events: eventsIn.length,
        templates: templatesIn.length,
        birthdays: backup.birthdays.length,
      };
    },
    [calendars, birthdays, savedColors, setThemeMode],
  );

  const importEvents = useCallback(
    (list: Event[], target: ImportTarget) => {
      let calendarId: string;
      const newCalendars: Calendar[] = [];
      if ('newCalendar' in target) {
        calendarId = newId();
        newCalendars.push({ id: calendarId, ...target.newCalendar, sortOrder: calendars.length, pauseWindows: [] });
      } else {
        calendarId = target.calendarId;
      }
      const existing = new Set(events.map((e) => e.id));
      const incoming = list.map((e) => withStoredTimes({ ...e, calendarId }, false));
      db.importData({ calendars: newCalendars, events: incoming, templates: [] }, false);
      if (newCalendars.length) setCalendars(db.loadCalendars());
      setEvents(db.loadEvents());
      const updated = incoming.filter((e) => existing.has(e.id)).length;
      return { added: incoming.length - updated, updated };
    },
    [calendars, events],
  );

  const getOccurrences = useCallback(
    (start: Date, end: Date, options?: { includeHidden?: boolean }) => {
      const includeHidden = options?.includeHidden ?? false;
      const source = includeHidden ? events : events.filter((e) => !hiddenSet.has(e.calendarId));
      const occurrences = expandEvents(source, calendarsById, start, end);
      if (!birthdays.length || (!includeHidden && hiddenSet.has(BIRTHDAYS_CALENDAR_ID))) return occurrences;
      // All-day items first on a day, the same order expandEvents gives (start asc, longer first).
      return [...expandBirthdays(birthdays, start, end), ...occurrences].sort(
        (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
      );
    },
    [events, calendarsById, hiddenSet, birthdays],
  );

  const value = useMemo<CalendarContextValue>(
    () => ({
      ready,
      error,
      calendars,
      calendarsById,
      events,
      templates,
      allTags,
      visibleCalendarIds,
      toggleCalendarVisibility,
      saveCalendar,
      deleteCalendarWithPlan,
      saveEvent,
      saveEvents,
      deleteEvent,
      deleteEvents,
      saveTemplate,
      deleteTemplate,
      moveTemplate,
      getEffectiveColor: effectiveColor,
      themeMode,
      setThemeMode,
      savedColors,
      saveColor,
      deleteSavedColor,
      floatingByDefault,
      setFloatingByDefault,
      birthdays,
      saveBirthday,
      deleteBirthday,
      notificationPrefs,
      updateNotificationPrefs,
      reminderStatus,
      refreshReminders,
      createBackupFile,
      importBackup,
      importEvents,
      getOccurrences,
    }),
    [
      ready, error, calendars, calendarsById, events, templates, allTags, visibleCalendarIds,
      toggleCalendarVisibility, saveCalendar, deleteCalendarWithPlan, saveEvent, saveEvents, deleteEvent, deleteEvents,
      saveTemplate, deleteTemplate, moveTemplate, effectiveColor, themeMode, setThemeMode, savedColors, saveColor, deleteSavedColor,
      floatingByDefault, setFloatingByDefault, birthdays, saveBirthday, deleteBirthday, notificationPrefs, updateNotificationPrefs,
      reminderStatus, refreshReminders, createBackupFile, importBackup, importEvents, getOccurrences,
    ],
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}
