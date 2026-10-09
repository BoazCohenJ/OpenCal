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
export const getLastSyncedAt = (): number | undefined => db.getSetting<SyncState>(STATE_KEY, INITIAL_STATE).lastSyncedAt;

/** Sets or clears the server. Any change of server starts the next sync from scratch. */
export function setSyncConfig(config: SyncConfig | null): void {
  db.setSetting(CONFIG_KEY, config);
  db.setSetting(STATE_KEY, INITIAL_STATE);
}

const onlySynced = (changes: ChangeSet): ChangeSet => ({
  ...changes,
  settings: changes.settings.filter((s) => SYNCED_SETTING_KEYS.includes(s.key)),
});

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

/** Syncs once with the configured server; concurrent calls share one run. Throws when it fails. */
export function syncNow(config: SyncConfig): Promise<SyncResult> {
  running ??= runSync(config).finally(() => {
    running = null;
  });
  return running;
}

/** Checks that `config` reaches an OpenCal server and the key is accepted, without syncing. */
export async function testConnection(config: SyncConfig): Promise<void> {
  const health = await fetch(apiUrl(config, '/api/health'))
    .then((r) => r.json())
    .catch(() => null);
  if (health?.app !== 'opencal') throw new Error('Couldn’t reach an OpenCal server at this address');
  // Nothing to send and a cursor past the end: only checks the key.
  const empty: ChangeSet = { calendars: [], events: [], templates: [], settings: [], deletions: [] };
  await post(config, '/api/sync', { serverId: health.serverId, cursor: Number.MAX_SAFE_INTEGER, changes: empty }, 15000);
}
