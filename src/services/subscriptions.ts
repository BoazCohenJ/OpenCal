import { Platform } from 'react-native';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import * as db from './database';
import { planRefresh, type RefreshPlan } from './subscriptionPlan';
import { apiUrl, getSyncConfig } from './sync';

export { planRefresh, type RefreshPlan };

/*
 * Subscribed calendars: a calendar with a feed URL (webcal:// or https://…ics) whose events are
 * replaced from that feed on every refresh. Event ids come from the feed's UIDs, so every device
 * that refreshes the same feed writes the same records and sync has nothing to argue about; only
 * events whose feed fields changed are written, so an unchanged feed causes no sync traffic.
 *
 * When and how each refresh went is kept per device (not synced).
 */

export interface SubscriptionStatus {
  /** Last successful refresh (ms). */
  refreshedAt?: number;
  /** Last attempt, successful or not (ms). Used to pace retries. */
  triedAt?: number;
  /** Why the last attempt failed; cleared by the next one that works. */
  error?: string;
  /** Events in the feed after the last successful refresh. */
  count?: number;
}

const STATUS_KEY = 'subscriptionStatus';

export const getSubscriptionStatuses = (): Record<string, SubscriptionStatus> =>
  db.getSetting<Record<string, SubscriptionStatus>>(STATUS_KEY, {});

function setStatus(calendarId: string, patch: SubscriptionStatus): void {
  const all = getSubscriptionStatuses();
  db.setSetting(STATUS_KEY, { ...all, [calendarId]: { ...all[calendarId], ...patch } });
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function subscribeSubscriptionStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `webcal://host/x.ics` → `https://host/x.ics`. Returns null for anything that isn't an http(s) URL. */
export function normalizeFeedUrl(input: string): string | null {
  const s = input.trim().replace(/^webcals?:\/\//i, 'https://');
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function download(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/calendar, */*' } });
    } catch (e) {
      // Offline, unknown host, no HTTPS: the platform's message is technical, so give a plain one.
      if (e instanceof Error && e.name === 'AbortError') throw new Error('The calendar took too long to download');
      throw new Error('Couldn’t download the calendar. Check the address and your connection');
    }
    if (!res.ok) throw new Error(`The calendar's server answered ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Browsers block most calendar URLs (no CORS headers), so the web app asks the sync server to
 * download them when one is set up, and tries directly otherwise.
 */
async function fetchFeed(url: string): Promise<string> {
  const config = Platform.OS === 'web' ? getSyncConfig() : null;
  if (!config) {
    try {
      return await download(url);
    } catch (e) {
      if (Platform.OS === 'web' && e instanceof Error && e.message.startsWith('Couldn’t')) {
        throw new Error('The browser can’t download this calendar directly. Set up a sync server in Settings → Sync, or refresh it on your phone.');
      }
      throw e;
    }
  }
  const res = await fetch(apiUrl(config, '/api/fetch-ics'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ url }),
  }).catch(() => {
    throw new Error('Couldn’t reach the sync server to download the calendar');
  });
  const json = await res.json().catch(() => null);
  if (res.status === 404) throw new Error('Your sync server is too old to download calendars; update it');
  if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`);
  return String(json?.text ?? '');
}

export interface Applier {
  saveEvents: (events: Event[]) => void;
  deleteEvents: (ids: string[]) => void;
}

const inFlight = new Map<string, Promise<RefreshPlan>>();

/** Downloads the feed and brings the calendar's events in line with it. Throws when it fails. */
export function refreshSubscription(calendar: Calendar, current: Event[], allDayTime: number, apply: Applier): Promise<RefreshPlan> {
  const running = inFlight.get(calendar.id);
  if (running) return running;
  const task = (async () => {
    const sub = calendar.subscription;
    const url = sub && normalizeFeedUrl(sub.url);
    if (!url) throw new Error('This calendar has no valid address');
    setStatus(calendar.id, { triedAt: Date.now() });
    try {
      const plan = planRefresh(calendar, await fetchFeed(url), current, allDayTime);
      apply.saveEvents(plan.save);
      apply.deleteEvents(plan.remove);
      setStatus(calendar.id, { refreshedAt: Date.now(), error: undefined, count: plan.total });
      return plan;
    } catch (e) {
      setStatus(calendar.id, { error: e instanceof Error ? e.message : String(e) });
      throw e;
    } finally {
      inFlight.delete(calendar.id);
    }
  })();
  inFlight.set(calendar.id, task);
  return task;
}

/** Retry a failed feed at most this often, so an offline phone doesn't hammer it. */
const RETRY_MS = 15 * 60 * 1000;

/** Subscribed calendars whose refresh is due. */
export function dueSubscriptions(calendars: Calendar[], now = Date.now()): Calendar[] {
  const statuses = getSubscriptionStatuses();
  return calendars.filter((c) => {
    if (!c.subscription) return false;
    const s = statuses[c.id];
    if (s?.triedAt && now - s.triedAt < RETRY_MS) return false;
    return !s?.refreshedAt || now - s.refreshedAt >= c.subscription.refreshHours * 3600 * 1000;
  });
}
