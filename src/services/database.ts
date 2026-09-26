import * as SQLite from 'expo-sqlite';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { PauseWindow } from '../models/PauseWindow';
import type { EventTemplate } from '../models/Template';

const db = SQLite.openDatabaseSync('calendar.db');
const SCHEMA_VERSION = 5;

type Row = Record<string, any>;

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const orNull = (v?: string | null): string | null => (v ? v : null);
const orUndef = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function initDatabase(): void {
  db.execSync('PRAGMA foreign_keys = ON;');
  const version = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  db.withTransactionSync(() => {
    if (version < 1) {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS calendars (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          isAllDay INTEGER NOT NULL DEFAULT 0,
          location TEXT,
          calendarId TEXT NOT NULL REFERENCES calendars(id),
          color TEXT,
          recurrenceRule TEXT,
          reminders TEXT,
          emoji TEXT,
          tags TEXT
        );
        CREATE TABLE IF NOT EXISTS pause_windows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eventId TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL
        );
      `);
    }
    if (version < 2) {
      db.execSync(`
        ALTER TABLE calendars ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE IF NOT EXISTS calendar_pause_windows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          calendarId TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          emoji TEXT,
          durationMinutes INTEGER NOT NULL,
          isAllDay INTEGER NOT NULL DEFAULT 0,
          location TEXT,
          calendarId TEXT REFERENCES calendars(id) ON DELETE SET NULL,
          color TEXT,
          reminders TEXT,
          tags TEXT,
          sortOrder INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_calendar ON events(calendarId);
        CREATE INDEX IF NOT EXISTS idx_pause_windows_event ON pause_windows(eventId);
        CREATE INDEX IF NOT EXISTS idx_calendar_pause_windows ON calendar_pause_windows(calendarId);
      `);
    }
    if (version < 3) {
      db.execSync(`ALTER TABLE calendars ADD COLUMN defaults TEXT;`);
    }
    if (version < 4) {
      db.execSync(`ALTER TABLE events ADD COLUMN floating INTEGER NOT NULL DEFAULT 0;`);
    }
    if (version < 5) {
      db.execSync(`ALTER TABLE events ADD COLUMN skippedDates TEXT;`);
    }
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });
}

function groupPauseWindows(rows: Row[], key: string): Map<string, PauseWindow[]> {
  const map = new Map<string, PauseWindow[]>();
  for (const r of rows) {
    const list = map.get(r[key]) ?? [];
    list.push({ startDate: r.startDate, endDate: r.endDate });
    map.set(r[key], list);
  }
  return map;
}

// ---------- Calendars ----------

export function loadCalendars(): Calendar[] {
  const pauses = groupPauseWindows(
    db.getAllSync<Row>('SELECT calendarId, startDate, endDate FROM calendar_pause_windows ORDER BY startDate'),
    'calendarId',
  );
  return db.getAllSync<Row>('SELECT * FROM calendars ORDER BY sortOrder, name').map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    sortOrder: r.sortOrder ?? 0,
    pauseWindows: pauses.get(r.id) ?? [],
    defaults: parseJson<Calendar['defaults']>(r.defaults, undefined),
  }));
}

function writeCalendar(c: Calendar): void {
  db.runSync(
    `INSERT INTO calendars (id, name, color, sortOrder, defaults) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, sortOrder = excluded.sortOrder,
       defaults = excluded.defaults`,
    [c.id, c.name, c.color, c.sortOrder, c.defaults ? JSON.stringify(c.defaults) : null],
  );
  db.runSync('DELETE FROM calendar_pause_windows WHERE calendarId = ?', [c.id]);
  for (const w of c.pauseWindows) {
    db.runSync('INSERT INTO calendar_pause_windows (calendarId, startDate, endDate) VALUES (?, ?, ?)', [
      c.id,
      w.startDate,
      w.endDate,
    ]);
  }
}

export function saveCalendar(c: Calendar): void {
  db.withTransactionSync(() => writeCalendar(c));
}

/**
 * Deletes a calendar after applying a per-event plan: each event id maps to the calendar it moves
 * to, or to null to be deleted. Stamps in the calendar move to `templatesTo` (or lose their calendar).
 */
export function deleteCalendarWithPlan(
  id: string,
  plan: Record<string, string | null>,
  templatesTo: string | null,
): void {
  db.withTransactionSync(() => {
    for (const [eventId, target] of Object.entries(plan)) {
      if (target) db.runSync('UPDATE events SET calendarId = ? WHERE id = ? AND calendarId = ?', [target, eventId, id]);
      else db.runSync('DELETE FROM events WHERE id = ? AND calendarId = ?', [eventId, id]);
    }
    // Anything not covered by the plan (e.g. created meanwhile) is deleted with the calendar.
    db.runSync('DELETE FROM events WHERE calendarId = ?', [id]);
    db.runSync('UPDATE templates SET calendarId = ? WHERE calendarId = ?', [templatesTo, id]);
    db.runSync('DELETE FROM calendars WHERE id = ?', [id]);
  });
}

// ---------- Events ----------

export function loadEvents(): Event[] {
  const pauses = groupPauseWindows(
    db.getAllSync<Row>('SELECT eventId, startDate, endDate FROM pause_windows ORDER BY startDate'),
    'eventId',
  );
  return db.getAllSync<Row>('SELECT * FROM events ORDER BY startDate').map((r) => ({
    id: r.id,
    title: r.title,
    description: orUndef(r.description),
    startDate: r.startDate,
    endDate: r.endDate,
    isAllDay: r.isAllDay === 1 || r.isAllDay === true,
    floating: r.floating === 1 || r.floating === true,
    location: orUndef(r.location),
    calendarId: r.calendarId,
    color: orUndef(r.color),
    recurrenceRule: orUndef(r.recurrenceRule),
    pauseWindows: pauses.get(r.id) ?? [],
    skippedDates: parseJson<string[]>(r.skippedDates, []),
    reminders: parseJson<number[]>(r.reminders, []),
    emoji: orUndef(r.emoji),
    tags: parseJson<string[]>(r.tags, []),
  }));
}

function writeEvent(e: Event): void {
  db.runSync(
    `INSERT INTO events (id, title, description, startDate, endDate, isAllDay, floating, location, calendarId, color, recurrenceRule, skippedDates, reminders, emoji, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, description = excluded.description, startDate = excluded.startDate,
       endDate = excluded.endDate, isAllDay = excluded.isAllDay, floating = excluded.floating, location = excluded.location,
       calendarId = excluded.calendarId, color = excluded.color, recurrenceRule = excluded.recurrenceRule,
       skippedDates = excluded.skippedDates,
       reminders = excluded.reminders, emoji = excluded.emoji, tags = excluded.tags`,
    [
      e.id,
      e.title,
      orNull(e.description),
      e.startDate,
      e.endDate,
      e.isAllDay ? 1 : 0,
      e.floating ? 1 : 0,
      orNull(e.location),
      e.calendarId,
      orNull(e.color),
      orNull(e.recurrenceRule),
      JSON.stringify(e.skippedDates ?? []),
      JSON.stringify(e.reminders),
      orNull(e.emoji),
      JSON.stringify(e.tags),
    ],
  );
  db.runSync('DELETE FROM pause_windows WHERE eventId = ?', [e.id]);
  for (const w of e.pauseWindows) {
    db.runSync('INSERT INTO pause_windows (eventId, startDate, endDate) VALUES (?, ?, ?)', [e.id, w.startDate, w.endDate]);
  }
}

export function saveEvent(e: Event): void {
  db.withTransactionSync(() => writeEvent(e));
}

export function saveEvents(list: Event[]): void {
  db.withTransactionSync(() => list.forEach(writeEvent));
}

export function deleteEvent(id: string): void {
  db.runSync('DELETE FROM events WHERE id = ?', [id]);
}

export function deleteEvents(ids: string[]): void {
  db.withTransactionSync(() => ids.forEach(deleteEvent));
}

// ---------- Templates ----------

export function loadTemplates(): EventTemplate[] {
  return db.getAllSync<Row>('SELECT * FROM templates ORDER BY sortOrder, name').map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    description: orUndef(r.description),
    emoji: orUndef(r.emoji),
    durationMinutes: r.durationMinutes,
    isAllDay: r.isAllDay === 1 || r.isAllDay === true,
    location: orUndef(r.location),
    calendarId: r.calendarId ?? '',
    color: orUndef(r.color),
    reminders: parseJson<number[]>(r.reminders, []),
    tags: parseJson<string[]>(r.tags, []),
    sortOrder: r.sortOrder ?? 0,
  }));
}

export function saveTemplate(t: EventTemplate): void {
  db.runSync(
    `INSERT INTO templates (id, name, title, description, emoji, durationMinutes, isAllDay, location, calendarId, color, reminders, tags, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, title = excluded.title, description = excluded.description, emoji = excluded.emoji,
       durationMinutes = excluded.durationMinutes, isAllDay = excluded.isAllDay, location = excluded.location,
       calendarId = excluded.calendarId, color = excluded.color, reminders = excluded.reminders,
       tags = excluded.tags, sortOrder = excluded.sortOrder`,
    [
      t.id,
      t.name,
      t.title,
      orNull(t.description),
      orNull(t.emoji),
      t.durationMinutes,
      t.isAllDay ? 1 : 0,
      orNull(t.location),
      orNull(t.calendarId),
      orNull(t.color),
      JSON.stringify(t.reminders),
      JSON.stringify(t.tags),
      t.sortOrder,
    ],
  );
}

export function deleteTemplate(id: string): void {
  db.runSync('DELETE FROM templates WHERE id = ?', [id]);
}

/**
 * Writes imported data in one transaction. Items are upserted by id; with `replace`, all existing
 * calendars, events and stamps are deleted first. References must already be valid.
 */
export function importData(
  data: { calendars: Calendar[]; events: Event[]; templates: EventTemplate[] },
  replace: boolean,
): void {
  db.withTransactionSync(() => {
    if (replace) {
      // Pause windows go with their events and calendars (ON DELETE CASCADE).
      db.execSync('DELETE FROM templates; DELETE FROM events; DELETE FROM calendars;');
    }
    data.calendars.forEach(writeCalendar);
    data.events.forEach(writeEvent);
    data.templates.forEach(saveTemplate);
  });
}

export function saveTemplateOrder(ids: string[]): void {
  db.withTransactionSync(() => {
    ids.forEach((id, index) => db.runSync('UPDATE templates SET sortOrder = ? WHERE id = ?', [index, id]));
  });
}

// ---------- Settings ----------

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.getFirstSync<Row>('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row ? parseJson<T>(row.value, fallback) : fallback;
}

export function setSetting(key: string, value: unknown): void {
  db.runSync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}
