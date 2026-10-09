import type { Calendar } from './Calendar';
import type { Event } from './Event';
import type { EventTemplate } from './Template';

/*
 * What two copies of the data exchange to stay in step. Every record and setting carries the time it
 * last changed (ms since epoch) and deletions leave a tombstone; the newer side wins per record.
 * Pause windows and skipped dates travel inside their event or calendar.
 */

export type SyncKind = 'calendar' | 'event' | 'template';

export interface Stamped<T> {
  record: T;
  updatedAt: number;
}

export interface SettingChange {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface Deletion {
  kind: SyncKind;
  id: string;
  deletedAt: number;
}

export interface ChangeSet {
  calendars: Stamped<Calendar>[];
  events: Stamped<Event>[];
  templates: Stamped<EventTemplate>[];
  settings: SettingChange[];
  deletions: Deletion[];
}
