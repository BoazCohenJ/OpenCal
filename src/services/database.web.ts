import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { ChangeSet, Deletion, SettingChange, Stamped, SyncKind } from '../models/Sync';
import type { EventTemplate } from '../models/Template';

const storageKeys = {
  calendars: 'calendar-app.calendars',
  events: 'calendar-app.events',
  templates: 'calendar-app.templates',
  settings: 'calendar-app.settings',
  stamps: 'calendar-app.stamps',
  settingStamps: 'calendar-app.settingStamps',
  tombstones: 'calendar-app.tombstones',
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

// ---------- Change tracking ----------
// Mirrors database.ts: every record and setting has the time it last changed, and deletions leave a
// tombstone, so a sync can send what changed and the newer side wins. Records saved before this
// existed have no stamp and count as 0.

type Stamps = Record<SyncKind, Record<string, number>>;
type Tombstones = Record<SyncKind, Record<string, number>>;

const readStamps = (): Stamps => ({ calendar: {}, event: {}, template: {}, ...read<Partial<Stamps>>(storageKeys.stamps, {}) });
const readTombstones = (): Tombstones => ({ calendar: {}, event: {}, template: {}, ...read<Partial<Tombstones>>(storageKeys.tombstones, {}) });
const readSettingStamps = (): Record<string, number> => read<Record<string, number>>(storageKeys.settingStamps, {});

let lastStamp = 0;

/**
 * The change time for a local edit: wall-clock ms, but always above any stamp already seen (here or
 * from another device), so an edit made after receiving a change counts as newer even if clocks differ.
 */
export function stampNow(): number {
  if (!lastStamp) {
    const stamps = readStamps();
    const tombs = readTombstones();
    lastStamp = Math.max(
      0,
      ...Object.values(stamps).flatMap((m) => Object.values(m)),
      ...Object.values(tombs).flatMap((m) => Object.values(m)),
      ...Object.values(readSettingStamps()),
    );
  }
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function observeStamp(at: number): void {
  if (!lastStamp) stampNow();
  lastStamp = Math.max(lastStamp, at);
}

/** Records that `ids` of `kind` changed at `at`, and revives them if they had been deleted. */
function stamp(kind: SyncKind, ids: string[], at: number): void {
  if (!ids.length) return;
  const stamps = readStamps();
  const tombs = readTombstones();
  for (const id of ids) {
    stamps[kind][id] = at;
    delete tombs[kind][id];
  }
  write(storageKeys.stamps, stamps);
  write(storageKeys.tombstones, tombs);
}

/** Records that `ids` of `kind` were deleted at `at`. */
function bury(kind: SyncKind, ids: string[], at: number): void {
  if (!ids.length) return;
  const stamps = readStamps();
  const tombs = readTombstones();
  for (const id of ids) {
    delete stamps[kind][id];
    tombs[kind][id] = Math.max(tombs[kind][id] ?? 0, at);
  }
  write(storageKeys.stamps, stamps);
  write(storageKeys.tombstones, tombs);
}

// ---------- Calendars ----------

export function loadCalendars(): Calendar[] {
  return read<Calendar[]>(storageKeys.calendars, []);
}

function writeCalendar(calendar: Calendar, at = stampNow()): void {
  write(storageKeys.calendars, [...loadCalendars().filter((item) => item.id !== calendar.id), calendar]);
  stamp('calendar', [calendar.id], at);
}

export function saveCalendar(calendar: Calendar): void {
  writeCalendar(calendar);
}

export function deleteCalendarWithPlan(
  id: string,
  plan: Record<string, string | null>,
  templatesTo: string | null,
): void {
  const at = stampNow();
  const moved: string[] = [];
  const gone: string[] = [];
  const events: Event[] = [];
  for (const event of loadEvents()) {
    if (event.calendarId !== id) {
      events.push(event);
    } else if (plan[event.id]) {
      events.push({ ...event, calendarId: plan[event.id]! });
      moved.push(event.id);
    } else {
      gone.push(event.id);
    }
  }
  write(storageKeys.events, events);
  stamp('event', moved, at);
  bury('event', gone, at);

  const templates = loadTemplates();
  const retargeted = templates.filter((t) => t.calendarId === id).map((t) => t.id);
  write(storageKeys.templates, templates.map((t) => (t.calendarId === id ? { ...t, calendarId: templatesTo ?? '' } : t)));
  stamp('template', retargeted, at);

  write(storageKeys.calendars, loadCalendars().filter((item) => item.id !== id));
  bury('calendar', [id], at);
}

// ---------- Events ----------

export function loadEvents(ids?: string[]): Event[] {
  const wanted = ids ? new Set(ids) : null;
  return read<Event[]>(storageKeys.events, [])
    .filter((e) => !wanted || wanted.has(e.id))
    .map((e) => ({ ...e, floating: e.floating === true, skippedDates: e.skippedDates ?? [] }));
}

function writeEvents(events: Event[], at = stampNow()): void {
  const ids = new Set(events.map((e) => e.id));
  write(storageKeys.events, [...loadEvents().filter((item) => !ids.has(item.id)), ...events]);
  stamp('event', [...ids], at);
}

export function saveEvent(event: Event): void {
  writeEvents([event]);
}

export function saveEvents(events: Event[]): void {
  writeEvents(events);
}

export function deleteEvent(id: string): void {
  deleteEvents([id]);
}

export function deleteEvents(ids: string[]): void {
  const remove = new Set(ids);
  write(storageKeys.events, loadEvents().filter((event) => !remove.has(event.id)));
  bury('event', ids, stampNow());
}

// ---------- Templates ----------

export function loadTemplates(): EventTemplate[] {
  return read<EventTemplate[]>(storageKeys.templates, []).sort((a, b) => a.sortOrder - b.sortOrder);
}

function writeTemplate(template: EventTemplate, at = stampNow()): void {
  write(storageKeys.templates, [...loadTemplates().filter((item) => item.id !== template.id), template]);
  stamp('template', [template.id], at);
}

export function saveTemplate(template: EventTemplate): void {
  writeTemplate(template);
}

export function deleteTemplate(id: string): void {
  write(storageKeys.templates, loadTemplates().filter((template) => template.id !== id));
  bury('template', [id], stampNow());
}

const upsert = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const ids = new Set(incoming.map((item) => item.id));
  return [...existing.filter((item) => !ids.has(item.id)), ...incoming];
};

export function importData(
  data: { calendars: Calendar[]; events: Event[]; templates: EventTemplate[] },
  replace: boolean,
): void {
  const at = stampNow();
  if (replace) {
    // Everything is tombstoned; whatever the import brings back is revived as it's stamped below.
    bury('template', loadTemplates().map((t) => t.id), at);
    bury('event', loadEvents().map((e) => e.id), at);
    bury('calendar', loadCalendars().map((c) => c.id), at);
  }
  write(storageKeys.calendars, upsert(replace ? [] : loadCalendars(), data.calendars));
  write(storageKeys.events, upsert(replace ? [] : loadEvents(), data.events));
  write(storageKeys.templates, upsert(replace ? [] : loadTemplates(), data.templates));
  stamp('calendar', data.calendars.map((c) => c.id), at);
  stamp('event', data.events.map((e) => e.id), at);
  stamp('template', data.templates.map((t) => t.id), at);
}

export function saveTemplateOrder(ids: string[]): void {
  const order = new Map(ids.map((id, index) => [id, index]));
  const changed: string[] = [];
  const templates = loadTemplates().map((template) => {
    const sortOrder = order.get(template.id) ?? template.sortOrder;
    if (sortOrder !== template.sortOrder) changed.push(template.id);
    return { ...template, sortOrder };
  });
  write(storageKeys.templates, templates);
  stamp('template', changed, stampNow());
}

// ---------- Settings ----------

export function getSetting<T>(key: string, fallback: T): T {
  return read<Record<string, unknown>>(storageKeys.settings, {})[key] as T ?? fallback;
}

export function setSetting(key: string, value: unknown, at = stampNow()): void {
  write(storageKeys.settings, { ...read<Record<string, unknown>>(storageKeys.settings, {}), [key]: value });
  write(storageKeys.settingStamps, { ...readSettingStamps(), [key]: at });
}

// ---------- Sync ----------

/** Everything that changed after `since` (ms; pass -1 for everything, including records from before tracking). */
export function getChangesSince(since: number): ChangeSet {
  const stamps = readStamps();
  const stamped = <T extends { id: string }>(kind: SyncKind, list: T[]): Stamped<T>[] =>
    list
      .map((record) => ({ record, updatedAt: stamps[kind][record.id] ?? 0 }))
      .filter((item) => item.updatedAt > since);

  const settings = read<Record<string, unknown>>(storageKeys.settings, {});
  const settingStamps = readSettingStamps();
  const tombs = readTombstones();
  return {
    calendars: stamped('calendar', loadCalendars()),
    events: stamped('event', loadEvents()),
    templates: stamped('template', loadTemplates()),
    settings: Object.keys(settings)
      .map((key): SettingChange => ({ key, value: settings[key], updatedAt: settingStamps[key] ?? 0 }))
      .filter((s) => s.updatedAt > since),
    deletions: (['calendar', 'event', 'template'] as const).flatMap((kind) =>
      Object.entries(tombs[kind])
        .filter(([, deletedAt]) => deletedAt > since)
        .map(([id, deletedAt]): Deletion => ({ kind, id, deletedAt })),
    ),
  };
}

/** The newest local stamp for a record, from its row or its tombstone; -1 if this copy has never seen it. */
function localStamp(kind: SyncKind, exists: boolean, id: string): number {
  const row = exists ? (readStamps()[kind][id] ?? 0) : -1;
  return Math.max(row, readTombstones()[kind][id] ?? -1);
}

/**
 * Merges changes from another copy: per record and per setting, whichever side changed it last wins
 * (an edit newer than a deletion brings the record back). Returns how many changes were taken.
 * Same conflict rules as database.ts: an incoming event whose calendar is deleted here moves to the
 * first calendar, and a deleted calendar that still has events here stays.
 */
export function applyChanges(changes: ChangeSet): number {
  let applied = 0;
  for (const at of [
    ...changes.calendars.map((c) => c.updatedAt),
    ...changes.events.map((e) => e.updatedAt),
    ...changes.templates.map((t) => t.updatedAt),
    ...changes.settings.map((s) => s.updatedAt),
    ...changes.deletions.map((d) => d.deletedAt),
  ]) {
    observeStamp(at);
  }

  const calendarIds = new Set(loadCalendars().map((c) => c.id));
  const eventIds = new Set(loadEvents().map((e) => e.id));
  const templateIds = new Set(loadTemplates().map((t) => t.id));

  for (const { record, updatedAt } of changes.calendars) {
    if (updatedAt <= localStamp('calendar', calendarIds.has(record.id), record.id)) continue;
    writeCalendar(record, updatedAt);
    calendarIds.add(record.id);
    applied++;
  }
  for (const { record, updatedAt } of changes.events) {
    if (updatedAt <= localStamp('event', eventIds.has(record.id), record.id)) continue;
    if (calendarIds.has(record.calendarId)) {
      writeEvents([record], updatedAt);
    } else {
      const calendarId = loadCalendars().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))[0]?.id;
      if (!calendarId) continue;
      writeEvents([{ ...record, calendarId }], stampNow());
    }
    eventIds.add(record.id);
    applied++;
  }
  for (const { record, updatedAt } of changes.templates) {
    if (updatedAt <= localStamp('template', templateIds.has(record.id), record.id)) continue;
    // A stamp without its calendar just has none, like after its calendar is deleted here.
    writeTemplate(calendarIds.has(record.calendarId) ? record : { ...record, calendarId: '' }, updatedAt);
    templateIds.add(record.id);
    applied++;
  }
  const settingStamps = readSettingStamps();
  for (const { key, value, updatedAt } of changes.settings) {
    if (key in settingStamps && updatedAt <= settingStamps[key]) continue;
    setSetting(key, value, updatedAt);
    applied++;
  }

  // Calendars last, after the events and stamps that were in them.
  const order: SyncKind[] = ['event', 'template', 'calendar'];
  const deletions = [...changes.deletions].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const { kind, id, deletedAt } of deletions) {
    const ids = kind === 'event' ? eventIds : kind === 'template' ? templateIds : kind === 'calendar' ? calendarIds : null;
    if (!ids) continue;
    const exists = ids.has(id);
    if (exists && (readStamps()[kind][id] ?? 0) >= deletedAt) continue;
    if (exists && kind === 'calendar' && loadEvents().some((e) => e.calendarId === id)) {
      stamp('calendar', [id], stampNow());
      continue;
    }
    bury(kind, [id], deletedAt);
    if (exists) {
      if (kind === 'event') write(storageKeys.events, loadEvents().filter((e) => e.id !== id));
      else if (kind === 'template') write(storageKeys.templates, loadTemplates().filter((t) => t.id !== id));
      else write(storageKeys.calendars, loadCalendars().filter((c) => c.id !== id));
      ids.delete(id);
      applied++;
    }
  }
  return applied;
}
