import type { Birthday } from '../models/Birthday';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { NotificationPrefs } from '../models/NotificationPrefs';
import type { PauseWindow } from '../models/PauseWindow';
import type { SavedColor } from '../models/SavedColor';
import type { EventTemplate } from '../models/Template';
import type { ThemeMode } from '../theme';
import { parseTimestamp } from '../utils/dates';

/*
 * The JSON backup: everything in the app (calendars, events, stamps, birthdays and settings),
 * readable back without loss. Parsing is defensive since the file may have been edited by hand.
 */

export const BACKUP_FORMAT = 'opencal-backup';
export const BACKUP_VERSION = 1;

export interface BackupSettings {
  themeMode: ThemeMode;
  notificationPrefs: NotificationPrefs;
  savedColors: SavedColor[];
  hiddenCalendarIds: string[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  calendars: Calendar[];
  events: Event[];
  templates: EventTemplate[];
  birthdays: Birthday[];
  /** Partial when read from a file: missing settings are left as they are. */
  settings: Partial<BackupSettings>;
}

export function createBackup(data: Omit<Backup, 'format' | 'version' | 'exportedAt'>): string {
  const backup: Backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...data };
  return JSON.stringify(backup, null, 2);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const numList = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : []);
const validDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(parseTimestamp(v).getTime());
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const pauses = (v: unknown): PauseWindow[] =>
  Array.isArray(v)
    ? v.filter(isObj).flatMap((w) => {
        const s = str(w.startDate);
        const e = str(w.endDate);
        return s && e && DAY_KEY.test(s) && DAY_KEY.test(e) ? [{ startDate: s, endDate: e }] : [];
      })
    : [];
const list = <T>(v: unknown, read: (o: Obj) => T | null): T[] =>
  Array.isArray(v)
    ? v.filter(isObj).flatMap((o) => {
        const item = read(o);
        return item ? [item] : [];
      })
    : [];

function readCalendar(o: Obj, i: number): Calendar | null {
  const id = str(o.id);
  const name = str(o.name);
  const color = str(o.color);
  if (!id || !name || !color) return null;
  return {
    id,
    name,
    color,
    sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : i,
    pauseWindows: pauses(o.pauseWindows),
    defaults: isObj(o.defaults) ? (o.defaults as Calendar['defaults']) : undefined,
  };
}

function readEvent(o: Obj): Event | null {
  const id = str(o.id);
  const calendarId = str(o.calendarId);
  if (!id || !calendarId || typeof o.title !== 'string' || !validDate(o.startDate) || !validDate(o.endDate)) return null;
  return {
    id,
    title: o.title,
    description: str(o.description),
    startDate: o.startDate,
    endDate: o.endDate,
    isAllDay: o.isAllDay === true,
    floating: o.floating === true,
    location: str(o.location),
    calendarId,
    color: str(o.color),
    recurrenceRule: str(o.recurrenceRule),
    pauseWindows: pauses(o.pauseWindows),
    skippedDates: strList(o.skippedDates).filter((d) => DAY_KEY.test(d)),
    reminders: numList(o.reminders),
    emoji: str(o.emoji),
    tags: strList(o.tags),
  };
}

function readTemplate(o: Obj): EventTemplate | null {
  const id = str(o.id);
  const title = str(o.title);
  if (!id || !title || typeof o.durationMinutes !== 'number') return null;
  return {
    id,
    name: str(o.name) ?? title,
    title,
    description: str(o.description),
    emoji: str(o.emoji),
    durationMinutes: o.durationMinutes,
    isAllDay: o.isAllDay === true,
    location: str(o.location),
    calendarId: str(o.calendarId) ?? '',
    color: str(o.color),
    reminders: numList(o.reminders),
    tags: strList(o.tags),
    sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : 0,
  };
}

function readBirthday(o: Obj): Birthday | null {
  const id = str(o.id);
  const name = str(o.name);
  const birthDate = str(o.birthDate);
  return id && name && birthDate && DAY_KEY.test(birthDate) ? { id, name, birthDate } : null;
}

function readSettings(v: unknown): Partial<BackupSettings> {
  if (!isObj(v)) return {};
  const out: Partial<BackupSettings> = {};
  if (v.themeMode === 'system' || v.themeMode === 'light' || v.themeMode === 'dark') out.themeMode = v.themeMode;
  // Normalized by the caller (normalizeNotificationPrefs) before use.
  if (isObj(v.notificationPrefs)) out.notificationPrefs = v.notificationPrefs as unknown as NotificationPrefs;
  if (Array.isArray(v.savedColors)) {
    out.savedColors = list(v.savedColors, (c) => {
      const id = str(c.id);
      const name = str(c.name);
      const hex = str(c.hex);
      return id && name && hex ? { id, name, hex } : null;
    });
  }
  if (Array.isArray(v.hiddenCalendarIds)) out.hiddenCalendarIds = strList(v.hiddenCalendarIds);
  return out;
}

/** Reads a backup file. Returns null when the text isn't an OpenCal backup. */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return null;
  const calendars = Array.isArray(raw.calendars)
    ? raw.calendars.filter(isObj).flatMap((o, i) => {
        const c = readCalendar(o, i);
        return c ? [c] : [];
      })
    : [];
  return {
    format: BACKUP_FORMAT,
    version: typeof raw.version === 'number' ? raw.version : BACKUP_VERSION,
    exportedAt: str(raw.exportedAt) ?? '',
    appVersion: str(raw.appVersion) ?? '',
    calendars,
    events: list(raw.events, readEvent),
    templates: list(raw.templates, readTemplate),
    birthdays: list(raw.birthdays, readBirthday),
    settings: readSettings(raw.settings),
  };
}
