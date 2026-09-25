import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { EventTemplate } from '../models/Template';

const storageKeys = {
  calendars: 'calendar-app.calendars',
  events: 'calendar-app.events',
  templates: 'calendar-app.templates',
  settings: 'calendar-app.settings'
};

const read = <T>(key: string, fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): void => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

export function initDatabase(): void {}

export function loadCalendars(): Calendar[] {
  return read<Calendar[]>(storageKeys.calendars, []);
}

export function saveCalendar(calendar: Calendar): void {
  write(storageKeys.calendars, [...loadCalendars().filter((item) => item.id !== calendar.id), calendar]);
}

export function deleteCalendarWithPlan(
  id: string,
  plan: Record<string, string | null>,
  templatesTo: string | null,
): void {
  const events = loadEvents()
    .map((event) => (event.calendarId === id && plan[event.id] ? { ...event, calendarId: plan[event.id]! } : event))
    .filter((event) => event.calendarId !== id);
  write(storageKeys.events, events);
  write(
    storageKeys.templates,
    loadTemplates().map((t) => (t.calendarId === id ? { ...t, calendarId: templatesTo ?? '' } : t)),
  );
  write(storageKeys.calendars, loadCalendars().filter((item) => item.id !== id));
}

export function loadEvents(): Event[] {
  return read<Event[]>(storageKeys.events, []);
}

export function saveEvent(event: Event): void {
  write(storageKeys.events, [...loadEvents().filter((item) => item.id !== event.id), event]);
}

export function saveEvents(events: Event[]): void {
  events.forEach(saveEvent);
}

export function deleteEvent(id: string): void {
  write(storageKeys.events, loadEvents().filter((event) => event.id !== id));
}

export function loadTemplates(): EventTemplate[] {
  return read<EventTemplate[]>(storageKeys.templates, []).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function saveTemplate(template: EventTemplate): void {
  write(storageKeys.templates, [...loadTemplates().filter((item) => item.id !== template.id), template]);
}

export function deleteTemplate(id: string): void {
  write(storageKeys.templates, loadTemplates().filter((template) => template.id !== id));
}

export function saveTemplateOrder(ids: string[]): void {
  const order = new Map(ids.map((id, index) => [id, index]));
  write(storageKeys.templates, loadTemplates().map((template) => ({
    ...template,
    sortOrder: order.get(template.id) ?? template.sortOrder
  })));
}

export function getSetting<T>(key: string, fallback: T): T {
  return read<Record<string, unknown>>(storageKeys.settings, {})[key] as T ?? fallback;
}

export function setSetting(key: string, value: unknown): void {
  write(storageKeys.settings, { ...read<Record<string, unknown>>(storageKeys.settings, {}), [key]: value });
}