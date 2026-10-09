import type { ChangeSet } from '../models/Sync';
import * as db from './database';

/*
 * Optional sync with a self-hosted OpenCal server (see server/README.md). The app keeps working on
 * its own database; a sync sends what changed here since the last one and takes in what other
 * devices sent the server since then.
 */

export interface SyncConfig {
  /** Base URL, e.g. https://gigaserver.tailnet.ts.net:2290 */
  url: string;
  apiKey: string;
}

interface SyncState {
  /** The server this device last synced with; a different one means starting over. */
  serverId?: string;
  /** The server's position after the last sync: everything up to here has been received. */
  cursor: number;
  /** Local changes stamped at or before this have been sent (-1: nothing yet, not even old rows). */
  sentUpTo: number;
  lastSyncedAt?: number;
}

export interface SyncResult {
  sent: number;
  received: number;
}

const CONFIG_KEY = 'syncServer';
const STATE_KEY = 'syncState';
const INITIAL_STATE: SyncState = { cursor: 0, sentUpTo: -1 };

/**
 * Settings that are really data and sync across devices. Everything else (theme, notification
 * defaults, hidden calendars, floating default, this sync setup) stays per device.
 */
export const SYNCED_SETTING_KEYS: readonly string[] = ['birthdays', 'savedColors', 'colorRules'];

export const getSyncConfig = (): SyncConfig | null => db.getSetting<SyncConfig | null>(CONFIG_KEY, null);

/** Sets or clears the server. Any change of server starts the next sync from scratch. */
export function setSyncConfig(config: SyncConfig | null): void {
  db.setSetting(CONFIG_KEY, config);
  db.setSetting(STATE_KEY, INITIAL_STATE);
  updateStatus({ error: undefined, lastSyncedAt: undefined });
}

const onlySynced = (changes: ChangeSet): ChangeSet => ({
  ...changes,
  settings: changes.settings.filter((s) => SYNCED_SETTING_KEYS.includes(s.key)),
});

const EMPTY: ChangeSet = { calendars: [], events: [], templates: [], settings: [], deletions: [] };

const count = (c: ChangeSet): number =>
  c.calendars.length + c.events.length + c.templates.length + c.settings.length + c.deletions.length;

export const apiUrl = (config: SyncConfig, path: string): string => `${config.url.trim().replace(/\/+$/, '')}${path}`;

async function post(config: SyncConfig, path: string, body: unknown, timeoutMs = 60000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(config, path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) throw new Error('The server rejected the API key');
    if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`);
    return json;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The server took too long to answer');
    // fetch rejects with a TypeError when there's no connection (offline, wrong address, no HTTPS).
    if (e instanceof TypeError) throw new Error('Couldn’t reach the server');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

let running: Promise<SyncResult> | null = null;

async function runSync(config: SyncConfig, firstAttempt = true): Promise<SyncResult> {
  const state = db.getSetting<SyncState>(STATE_KEY, INITIAL_STATE);
  // Everything stamped up to `mark` goes in this request; edits made while it's in flight come after.
  const mark = db.stampNow();
  const outgoing = onlySynced(db.getChangesSince(state.sentUpTo));
  const response = await post(config, '/api/sync', { serverId: state.serverId, cursor: state.cursor, changes: outgoing });

  if (state.serverId && response.serverId !== state.serverId && firstAttempt) {
    // A new or reset server: send it everything, not just what changed since the old one.
    db.setSetting(STATE_KEY, INITIAL_STATE);
    return runSync(config, false);
  }
  const incoming = onlySynced(response.changes as ChangeSet);
  const received = db.applyChanges(incoming);
  db.setSetting(STATE_KEY, {
    serverId: response.serverId,
    cursor: response.cursor,
    sentUpTo: mark,
    lastSyncedAt: Date.now(),
  } satisfies SyncState);
  return { sent: count(outgoing), received };
}

// ---------- Status ----------

export interface SyncStatus {
  syncing: boolean;
  lastSyncedAt?: number;
  /** Why the last sync failed; cleared by the next one that works. */
  error?: string;
  /** Goes up whenever a sync changed data on this device, so the app knows to re-read it. */
  dataVersion: number;
}

let status: SyncStatus | null = null;
const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  status ??= { syncing: false, dataVersion: 0, lastSyncedAt: db.getSetting<SyncState>(STATE_KEY, INITIAL_STATE).lastSyncedAt };
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateStatus(patch: Partial<SyncStatus>): void {
  status = { ...getSyncStatus(), ...patch };
  listeners.forEach((l) => l());
}

const dataChanged = () => updateStatus({ dataVersion: getSyncStatus().dataVersion + 1 });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- Actions ----------

/** Syncs once with the configured server; concurrent calls share one run. Throws when it fails. */
export function syncNow(config: SyncConfig): Promise<SyncResult> {
  running ??= (async () => {
    updateStatus({ syncing: true });
    try {
      const result = await runSync(config);
      updateStatus({ syncing: false, error: undefined, lastSyncedAt: Date.now() });
      if (result.received) dataChanged();
      return result;
    } catch (e) {
      updateStatus({ syncing: false, error: message(e) });
      throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Checks that `config` reaches an OpenCal server and the key is accepted, without syncing.
 * Returns the server's id.
 */
export async function testConnection(config: SyncConfig): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const health = await fetch(apiUrl(config, '/api/health'), { signal: controller.signal })
    .then((r) => r.json())
    .catch(() => null)
    .finally(() => clearTimeout(timer));
  if (health?.app !== 'opencal') throw new Error('Couldn’t reach an OpenCal server at this address');
  // Nothing to send and a cursor past the end: only checks the key.
  await post(config, '/api/sync', { serverId: health.serverId, cursor: Number.MAX_SAFE_INTEGER, changes: EMPTY }, 15000);
  return health.serverId;
}

/**
 * Sets up the server and syncs for the first time. A device with nothing of its own yet (no
 * events, stamps or birthdays) drops its starter calendars when the server already has calendars,
 * so connecting a new phone doesn't add a second "Personal" and "Work" everywhere.
 */
export async function connect(config: SyncConfig): Promise<SyncResult> {
  const serverId = await testConnection(config);
  const fresh =
    !db.loadEvents().length && !db.loadTemplates().length && !db.getSetting<unknown[]>('birthdays', []).length;
  setSyncConfig(config);
  if (fresh) {
    const response = await post(config, '/api/sync', { serverId, cursor: 0, changes: EMPTY });
    const incoming = onlySynced(response.changes as ChangeSet);
    if (incoming.calendars.length) {
      const starters = db.loadCalendars().filter((c) => !incoming.calendars.some((x) => x.record.id === c.id));
      db.applyChanges(incoming);
      starters.forEach((c) => db.deleteCalendarWithPlan(c.id, {}, null));
      // What came in is everything up to the server's cursor; anything here still goes up next.
      db.setSetting(STATE_KEY, { ...INITIAL_STATE, serverId: response.serverId, cursor: response.cursor } satisfies SyncState);
      dataChanged();
    }
  }
  return syncNow(config);
}

/** Stops syncing. Everything stays on this device. */
export function disconnect(): void {
  setSyncConfig(null);
}
