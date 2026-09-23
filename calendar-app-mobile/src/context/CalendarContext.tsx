import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { EventTemplate } from '../models/Template';
import * as db from '../services/database';
import { rescheduleReminders } from '../services/notifications';
import { expandEvents, getEffectiveColor, type Occurrence } from '../services/occurrences';
import { newId } from '../utils/id';

const HIDDEN_CALENDARS_KEY = 'hiddenCalendarIds';
const DEFAULT_CALENDARS = [
  { name: 'Personal', color: '#4F6BED' },
  { name: 'Work', color: '#F2994A' },
];

interface CalendarContextValue {
  ready: boolean;
  error: string | null;
  calendars: Calendar[];
  calendarsById: Record<string, Calendar>;
  events: Event[];
  templates: EventTemplate[];
  allTags: string[];
  visibleCalendarIds: string[];
  toggleCalendarVisibility: (id: string) => void;
  saveCalendar: (calendar: Calendar) => void;
  deleteCalendar: (id: string, reassignTo: string | null) => void;
  saveEvent: (event: Event) => void;
  saveEvents: (events: Event[]) => void;
  deleteEvent: (id: string) => void;
  saveTemplate: (template: EventTemplate) => void;
  deleteTemplate: (id: string) => void;
  moveTemplate: (id: string, direction: -1 | 1) => void;
  getEffectiveColor: (event: Event) => string;
  /** Occurrences in [start, end). Excludes hidden calendars unless includeHidden is set. */
  getOccurrences: (start: Date, end: Date, options?: { includeHidden?: boolean }) => Occurrence[];
}

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

export const useCalendarContext = (): CalendarContextValue => {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendarContext must be used within a CalendarProvider');
  return ctx;
};

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      db.initDatabase();
      if (db.loadCalendars().length === 0) {
        DEFAULT_CALENDARS.forEach((c, i) =>
          db.saveCalendar({ id: newId(), name: c.name, color: c.color, sortOrder: i, pauseWindows: [] }),
        );
      }
      setCalendars(db.loadCalendars());
      setEvents(db.loadEvents());
      setTemplates(db.loadTemplates());
      setHiddenCalendarIds(db.getSetting<string[]>(HIDDEN_CALENDARS_KEY, []));
    } catch (e) {
      console.error('Failed to open the calendar database', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, []);

  const calendarsById = useMemo(() => {
    const map: Record<string, Calendar> = {};
    for (const c of calendars) map[c.id] = c;
    return map;
  }, [calendars]);

  const hiddenSet = useMemo(() => new Set(hiddenCalendarIds), [hiddenCalendarIds]);
  const visibleCalendarIds = useMemo(
    () => calendars.filter((c) => !hiddenSet.has(c.id)).map((c) => c.id),
    [calendars, hiddenSet],
  );

  const allTags = useMemo(
    () => Array.from(new Set(events.flatMap((e) => e.tags))).sort((a, b) => a.localeCompare(b)),
    [events],
  );

  // Keep scheduled reminders in sync with data (debounced).
  useEffect(() => {
    if (!ready || error) return;
    const id = setTimeout(() => void rescheduleReminders(events, calendarsById), 1000);
    return () => clearTimeout(id);
  }, [ready, error, events, calendarsById]);

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

  const deleteCalendar = useCallback((id: string, reassignTo: string | null) => {
    db.deleteCalendar(id, reassignTo);
    setCalendars(db.loadCalendars());
    setEvents(db.loadEvents());
    setTemplates(db.loadTemplates());
    setHiddenCalendarIds((prev) => {
      const next = prev.filter((x) => x !== id);
      db.setSetting(HIDDEN_CALENDARS_KEY, next);
      return next;
    });
  }, []);

  const saveEvent = useCallback((event: Event) => {
    db.saveEvent(event);
    setEvents(db.loadEvents());
  }, []);

  const saveEvents = useCallback((list: Event[]) => {
    if (!list.length) return;
    db.saveEvents(list);
    setEvents(db.loadEvents());
  }, []);

  const deleteEvent = useCallback((id: string) => {
    db.deleteEvent(id);
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

  const getOccurrences = useCallback(
    (start: Date, end: Date, options?: { includeHidden?: boolean }) => {
      const source = options?.includeHidden ? events : events.filter((e) => !hiddenSet.has(e.calendarId));
      return expandEvents(source, calendarsById, start, end);
    },
    [events, calendarsById, hiddenSet],
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
      deleteCalendar,
      saveEvent,
      saveEvents,
      deleteEvent,
      saveTemplate,
      deleteTemplate,
      moveTemplate,
      getEffectiveColor: effectiveColor,
      getOccurrences,
    }),
    [
      ready, error, calendars, calendarsById, events, templates, allTags, visibleCalendarIds,
      toggleCalendarVisibility, saveCalendar, deleteCalendar, saveEvent, saveEvents, deleteEvent,
      saveTemplate, deleteTemplate, moveTemplate, effectiveColor, getOccurrences,
    ],
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}
