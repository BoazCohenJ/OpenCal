import { addDays, addMinutes, endOfDay, startOfDay } from 'date-fns';
import type { Event } from '../models/Event';
import type { EventTemplate } from '../models/Template';
import { confirmAsync } from '../utils/confirm';
import { parseTimestamp } from '../utils/dates';
import { newId } from '../utils/id';

export function eventFromTemplate(template: EventTemplate, start: Date, calendarId: string): Event {
  const s = template.isAllDay ? startOfDay(start) : start;
  const days = Math.max(1, Math.round(template.durationMinutes / 1440));
  const e = template.isAllDay ? endOfDay(addDays(s, days - 1)) : addMinutes(s, template.durationMinutes);
  return {
    id: newId(),
    title: template.title,
    description: template.description,
    startDate: s.toISOString(),
    endDate: e.toISOString(),
    isAllDay: template.isAllDay,
    location: template.location,
    calendarId,
    color: template.color,
    recurrenceRule: undefined,
    pauseWindows: [],
    reminders: [...template.reminders],
    emoji: template.emoji,
    tags: [...template.tags],
  };
}

export function templateFromEvent(event: Event): EventTemplate {
  const ms = parseTimestamp(event.endDate).getTime() - parseTimestamp(event.startDate).getTime();
  const durationMinutes = event.isAllDay
    ? Math.max(1, Math.round(ms / 86400000)) * 1440
    : Math.max(5, Math.round(ms / 60000));
  return {
    id: newId(),
    name: event.title,
    title: event.title,
    description: event.description,
    emoji: event.emoji,
    durationMinutes,
    isAllDay: event.isAllDay,
    location: event.location,
    calendarId: event.calendarId,
    color: event.color,
    reminders: [...event.reminders],
    tags: [...event.tags],
    sortOrder: 0,
  };
}

/** Asks before deleting a stamp (long-press in the stamp menus). Resolves true when it was deleted. */
export async function confirmDeleteStamp(template: EventTemplate, deleteTemplate: (id: string) => void): Promise<boolean> {
  const ok = await confirmAsync(`Delete “${template.name}”?`, 'Events already added from this stamp are kept.', 'Delete', true);
  if (ok) deleteTemplate(template.id);
  return ok;
}
