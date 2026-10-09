import * as SQLite from 'expo-sqlite';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { PauseWindow } from '../models/PauseWindow';
import type { ChangeSet, Deletion, SettingChange, Stamped, SyncKind } from '../models/Sync';
import type { EventTemplate } from '../models/Template';

const db = SQLite.openDatabaseSync('calendar.db');
const SCHEMA_VERSION = 7;

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
    if (version < 6) {
      db.execSync(`ALTER TABLE events ADD COLUMN timeZone TEXT;`);
    }
    if (version < 7) {
      // Sync groundwork: when each record last changed (0 for rows from before this version) and
      // tombstones for deleted ones, so another copy can tell which side is newer (see models/Sync).
      db.execSync(`
        ALTER TABLE calendars ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE events ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE templates ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE app_settings ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE IF NOT EXISTS tombstones (
          kind TEXT NOT NULL,
          id TEXT NOT NULL,
          deletedAt INTEGER NOT NULL,
          PRIMARY KEY (kind, id)
        );
        CREATE INDEX IF NOT EXISTS idx_calendars_updated ON calendars(updatedAt);
        CREATE INDEX IF NOT EXISTS idx_events_updated ON events(updatedAt);
        CREATE INDEX IF NOT EXISTS idx_templates_updated ON templates(updatedAt);
        CREATE INDEX IF NOT EXISTS idx_tombstones_deleted ON tombstones(deletedAt);
      `);
    }
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });
}

// ---------- Change tracking ----------

const TABLES: Record<SyncKind, string> = { calendar: 'calendars', event: 'events', template: 'templates' };

let lastStamp = 0;

/**
 * The change time for a local edit: wall-clock ms, but always above any stamp already seen (here or
 * from another device), so an edit made after receiving a change counts as newer even if clocks differ.
 */
export function stampNow(): number {
  if (!lastStamp) {
    lastStamp =
      db.getFirstSync<Row>(
        `SELECT MAX(m) AS m FROM (
           SELECT MAX(updatedAt) AS m FROM calendars UNION ALL SELECT MAX(updatedAt) FROM events
           UNION ALL SELECT MAX(updatedAt) FROM templates UNION ALL SELECT MAX(updatedAt) FROM app_settings
           UNION ALL SELECT MAX(deletedAt) FROM tombstones)`,
      )?.m ?? 0;
  }
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function observeStamp(at: number): void {
  if (!lastStamp) stampNow();
  lastStamp = Math.max(lastStamp, at);
}

const UPSERT_TOMBSTONE = 'ON CONFLICT(kind, id) DO UPDATE SET deletedAt = MAX(deletedAt, excluded.deletedAt)';

function bury(kind: SyncKind, id: string, at: number): void {
  db.runSync(`INSERT INTO tombstones (kind, id, deletedAt) VALUES (?, ?, ?) ${UPSERT_TOMBSTONE}`, [kind, id, at]);
}

/** Tombstones every row of `kind` matching `where`; call it before deleting them. */
function buryWhere(kind: SyncKind, where: string, params: SQLite.SQLiteBindValue[], at: number): void {
  db.runSync(
    `INSERT INTO tombstones (kind, id, deletedAt) SELECT ?, id, ? FROM ${TABLES[kind]} WHERE ${where} ${UPSERT_TOMBSTONE}`,
    [kind, at, ...params],
  );
}

function unbury(kind: SyncKind, id: string): void {
  db.runSync('DELETE FROM tombstones WHERE kind = ? AND id = ?', [kind, id]);
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
  return db.getAllSync<Row>('SELECT * FROM calendars ORDER BY sortOrder, name').map((r) => rowToCalendar(r, pauses));
}

const rowToCalendar = (r: Row, pauses: Map<string, PauseWindow[]>): Calendar => ({
  id: r.id,
  name: r.name,
  color: r.color,
  sortOrder: r.sortOrder ?? 0,
  pauseWindows: pauses.get(r.id) ?? [],
  defaults: parseJson<Calendar['defaults']>(r.defaults, undefined),
});

function writeCalendar(c: Calendar, at = stampNow()): void {
  db.runSync(
    `INSERT INTO calendars (id, name, color, sortOrder, defaults, updatedAt) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, sortOrder = excluded.sortOrder,
       defaults = excluded.defaults, updatedAt = excluded.updatedAt`,
    [c.id, c.name, c.color, c.sortOrder, c.defaults ? JSON.stringify(c.defaults) : null, at],
  );
  unbury('calendar', c.id);
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
    const at = stampNow();
    for (const [eventId, target] of Object.entries(plan)) {
      if (target) {
        db.runSync('UPDATE events SET calendarId = ?, updatedAt = ? WHERE id = ? AND calendarId = ?', [target, at, eventId, id]);
      }
    }
    // Everything left, including events created meanwhile that the plan doesn't cover, goes with the calendar.
    buryWhere('event', 'calendarId = ?', [id], at);
    db.runSync('DELETE FROM events WHERE calendarId = ?', [id]);
    db.runSync('UPDATE templates SET calendarId = ?, updatedAt = ? WHERE calendarId = ?', [templatesTo, at, id]);
    bury('calendar', id, at);
    db.runSync('DELETE FROM calendars WHERE id = ?', [id]);
  });
}

// ---------- Events ----------

const rowToEvent = (r: Row, pauses: Map<string, PauseWindow[]>): Event => ({
  id: r.id,
  title: r.title,
  description: orUndef(r.description),
  startDate: r.startDate,
  endDate: r.endDate,
  isAllDay: r.isAllDay === 1 || r.isAllDay === true,
  floating: r.floating === 1 || r.floating === true,
  timeZone: orUndef(r.timeZone),
  location: orUndef(r.location),
  calendarId: r.calendarId,
  color: orUndef(r.color),
  recurrenceRule: orUndef(r.recurrenceRule),
  pauseWindows: pauses.get(r.id) ?? [],
  skippedDates: parseJson<string[]>(r.skippedDates, []),
  reminders: parseJson<number[]>(r.reminders, []),
  emoji: orUndef(r.emoji),
  tags: parseJson<string[]>(r.tags, []),
});

/** All events ordered by start, or only those with the given ids (in no particular order). */
export function loadEvents(ids?: string[]): Event[] {
  if (!ids) {
    const pauses = groupPauseWindows(
      db.getAllSync<Row>('SELECT eventId, startDate, endDate FROM pause_windows ORDER BY startDate'),
      'eventId',
    );
    return db.getAllSync<Row>('SELECT * FROM events ORDER BY startDate').map((r) => rowToEvent(r, pauses));
  }
  const out: Event[] = [];
  // Chunked to stay well under SQLite's limit on bound parameters.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const marks = chunk.map(() => '?').join(',');
    const pauses = groupPauseWindows(
      db.getAllSync<Row>(`SELECT eventId, startDate, endDate FROM pause_windows WHERE eventId IN (${marks}) ORDER BY startDate`, chunk),
      'eventId',
    );
    for (const r of db.getAllSync<Row>(`SELECT * FROM events WHERE id IN (${marks})`, chunk)) out.push(rowToEvent(r, pauses));
  }
  return out;
}

function writeEvent(e: Event, at = stampNow()): void {
  db.runSync(
    `INSERT INTO events (id, title, description, startDate, endDate, isAllDay, floating, timeZone, location, calendarId, color, recurrenceRule, skippedDates, reminders, emoji, tags, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, description = excluded.description, startDate = excluded.startDate,
       endDate = excluded.endDate, isAllDay = excluded.isAllDay, floating = excluded.floating, timeZone = excluded.timeZone,
       location = excluded.location,
       calendarId = excluded.calendarId, color = excluded.color, recurrenceRule = excluded.recurrenceRule,
       skippedDates = excluded.skippedDates,
       reminders = excluded.reminders, emoji = excluded.emoji, tags = excluded.tags, updatedAt = excluded.updatedAt`,
    [
      e.id,
      e.title,
      orNull(e.description),
      e.startDate,
      e.endDate,
      e.isAllDay ? 1 : 0,
      e.floating ? 1 : 0,
      orNull(e.timeZone),
      orNull(e.location),
      e.calendarId,
      orNull(e.color),
      orNull(e.recurrenceRule),
      JSON.stringify(e.skippedDates ?? []),
      JSON.stringify(e.reminders),
      orNull(e.emoji),
      JSON.stringify(e.tags),
      at,
    ],
  );
  unbury('event', e.id);
  db.runSync('DELETE FROM pause_windows WHERE eventId = ?', [e.id]);
  for (const w of e.pauseWindows) {
    db.runSync('INSERT INTO pause_windows (eventId, startDate, endDate) VALUES (?, ?, ?)', [e.id, w.startDate, w.endDate]);
  }
}

export function saveEvent(e: Event): void {
  db.withTransactionSync(() => writeEvent(e));
}

export function saveEvents(list: Event[]): void {
  db.withTransactionSync(() => list.forEach((e) => writeEvent(e)));
}

function removeEvent(id: string, at: number): void {
  bury('event', id, at);
  db.runSync('DELETE FROM events WHERE id = ?', [id]);
}

export function deleteEvent(id: string): void {
  db.withTransactionSync(() => removeEvent(id, stampNow()));
}

export function deleteEvents(ids: string[]): void {
  db.withTransactionSync(() => {
    const at = stampNow();
    ids.forEach((id) => removeEvent(id, at));
  });
}

// ---------- Templates ----------

const rowToTemplate = (r: Row): EventTemplate => ({
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
});

export function loadTemplates(): EventTemplate[] {
  return db.getAllSync<Row>('SELECT * FROM templates ORDER BY sortOrder, name').map(rowToTemplate);
}

function writeTemplate(t: EventTemplate, at = stampNow()): void {
  db.runSync(
    `INSERT INTO templates (id, name, title, description, emoji, durationMinutes, isAllDay, location, calendarId, color, reminders, tags, sortOrder, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, title = excluded.title, description = excluded.description, emoji = excluded.emoji,
       durationMinutes = excluded.durationMinutes, isAllDay = excluded.isAllDay, location = excluded.location,
       calendarId = excluded.calendarId, color = excluded.color, reminders = excluded.reminders,
       tags = excluded.tags, sortOrder = excluded.sortOrder, updatedAt = excluded.updatedAt`,
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
      at,
    ],
  );
  unbury('template', t.id);
}

export function saveTemplate(t: EventTemplate): void {
  db.withTransactionSync(() => writeTemplate(t));
}

export function deleteTemplate(id: string): void {
  db.withTransactionSync(() => {
    bury('template', id, stampNow());
    db.runSync('DELETE FROM templates WHERE id = ?', [id]);
  });
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
      // Everything is tombstoned; whatever the import brings back is revived as it's written.
      const at = stampNow();
      for (const kind of ['template', 'event', 'calendar'] as const) buryWhere(kind, '1', [], at);
      // Pause windows go with their events and calendars (ON DELETE CASCADE).
      db.execSync('DELETE FROM templates; DELETE FROM events; DELETE FROM calendars;');
    }
    data.calendars.forEach((c) => writeCalendar(c));
    data.events.forEach((e) => writeEvent(e));
    data.templates.forEach((t) => writeTemplate(t));
  });
}

export function saveTemplateOrder(ids: string[]): void {
  db.withTransactionSync(() => {
    const at = stampNow();
    ids.forEach((id, index) =>
      db.runSync('UPDATE templates SET sortOrder = ?, updatedAt = ? WHERE id = ? AND sortOrder != ?', [index, at, id, index]),
    );
  });
}

// ---------- Settings ----------

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.getFirstSync<Row>('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row ? parseJson<T>(row.value, fallback) : fallback;
}

export function setSetting(key: string, value: unknown, at = stampNow()): void {
  db.runSync(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, JSON.stringify(value), at],
  );
}

// ---------- Sync ----------

/** Everything that changed after `since` (ms; pass -1 for everything, including rows from before tracking). */
export function getChangesSince(since: number): ChangeSet {
  const stamps = (table: string) =>
    new Map(db.getAllSync<Row>(`SELECT id, updatedAt FROM ${table} WHERE updatedAt > ?`, [since]).map((r) => [r.id, r.updatedAt as number]));
  const stamped = <T extends { id: string }>(list: T[], at: Map<string, number>): Stamped<T>[] =>
    list.filter((record) => at.has(record.id)).map((record) => ({ record, updatedAt: at.get(record.id)! }));

  const calendarStamps = stamps('calendars');
  const eventStamps = stamps('events');
  const templateStamps = stamps('templates');
  return {
    calendars: calendarStamps.size ? stamped(loadCalendars(), calendarStamps) : [],
    events: eventStamps.size ? stamped(loadEvents([...eventStamps.keys()]), eventStamps) : [],
    templates: templateStamps.size ? stamped(loadTemplates(), templateStamps) : [],
    settings: db
      .getAllSync<Row>('SELECT key, value, updatedAt FROM app_settings WHERE updatedAt > ?', [since])
      .map((r): SettingChange => ({ key: r.key, value: parseJson<unknown>(r.value, null), updatedAt: r.updatedAt })),
    deletions: db
      .getAllSync<Row>('SELECT kind, id, deletedAt FROM tombstones WHERE deletedAt > ?', [since])
      .map((r): Deletion => ({ kind: r.kind, id: r.id, deletedAt: r.deletedAt })),
  };
}

/** The newest local stamp for a record, from its row or its tombstone; -1 if this copy has never seen it. */
function localStamp(kind: SyncKind, id: string): number {
  const row = db.getFirstSync<Row>(`SELECT updatedAt FROM ${TABLES[kind]} WHERE id = ?`, [id]);
  const tomb = db.getFirstSync<Row>('SELECT deletedAt FROM tombstones WHERE kind = ? AND id = ?', [kind, id]);
  return Math.max(row?.updatedAt ?? -1, tomb?.deletedAt ?? -1);
}

const calendarExists = (id: string): boolean => !!db.getFirstSync('SELECT 1 FROM calendars WHERE id = ?', [id]);

/**
 * Merges changes from another copy: per record and per setting, whichever side changed it last wins
 * (an edit newer than a deletion brings the record back). Returns how many changes were taken.
 *
 * Two conflicts can't follow that rule without losing data, so they keep the data and re-stamp it
 * to send back: an incoming event whose calendar is deleted here moves to the first calendar, and a
 * deleted calendar that still has (newer) events here stays.
 */
export function applyChanges(changes: ChangeSet): number {
  let applied = 0;
  db.withTransactionSync(() => {
    for (const at of [
      ...changes.calendars.map((c) => c.updatedAt),
      ...changes.events.map((e) => e.updatedAt),
      ...changes.templates.map((t) => t.updatedAt),
      ...changes.settings.map((s) => s.updatedAt),
      ...changes.deletions.map((d) => d.deletedAt),
    ]) {
      observeStamp(at);
    }

    for (const { record, updatedAt } of changes.calendars) {
      if (updatedAt <= localStamp('calendar', record.id)) continue;
      writeCalendar(record, updatedAt);
      applied++;
    }
    const fallbackCalendar = (): string | undefined =>
      db.getFirstSync<Row>('SELECT id FROM calendars ORDER BY sortOrder, name LIMIT 1')?.id;
    for (const { record, updatedAt } of changes.events) {
      if (updatedAt <= localStamp('event', record.id)) continue;
      if (calendarExists(record.calendarId)) writeEvent(record, updatedAt);
      else {
        const calendarId = fallbackCalendar();
        if (!calendarId) continue;
        writeEvent({ ...record, calendarId }, stampNow());
      }
      applied++;
    }
    for (const { record, updatedAt } of changes.templates) {
      if (updatedAt <= localStamp('template', record.id)) continue;
      // A stamp without its calendar just has none, like after its calendar is deleted here.
      writeTemplate(calendarExists(record.calendarId) ? record : { ...record, calendarId: '' }, updatedAt);
      applied++;
    }
    for (const { key, value, updatedAt } of changes.settings) {
      const local = db.getFirstSync<Row>('SELECT updatedAt FROM app_settings WHERE key = ?', [key]);
      if (local && updatedAt <= local.updatedAt) continue;
      setSetting(key, value, updatedAt);
      applied++;
    }

    // Calendars last, after the events and stamps that were in them.
    const order: SyncKind[] = ['event', 'template', 'calendar'];
    const deletions = [...changes.deletions].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    for (const { kind, id, deletedAt } of deletions) {
      if (!TABLES[kind]) continue;
      const row = db.getFirstSync<Row>(`SELECT updatedAt FROM ${TABLES[kind]} WHERE id = ?`, [id]);
      if (row && row.updatedAt >= deletedAt) continue;
      if (row && kind === 'calendar' && db.getFirstSync('SELECT 1 FROM events WHERE calendarId = ?', [id])) {
        db.runSync('UPDATE calendars SET updatedAt = ? WHERE id = ?', [stampNow(), id]);
        continue;
      }
      bury(kind, id, deletedAt);
      if (row) {
        db.runSync(`DELETE FROM ${TABLES[kind]} WHERE id = ?`, [id]);
        applied++;
      }
    }
  });
  return applied;
}
