import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';
import { getSyncConfig, syncNow } from '../services/sync';

/** How long after a local edit to sync, so a burst of edits goes out together. */
const EDIT_DEBOUNCE_MS = 3000;
/** Minimum gap between syncs triggered by the app returning to the foreground. */
const FOREGROUND_INTERVAL_MS = 30 * 1000;

/**
 * Syncs with the self-hosted server, when one is set up: on start, on returning to the
 * foreground, and shortly after local edits. Failures are quiet (offline is normal) and retried on
 * the next trigger. Inert on web, where the database keeps no change history.
 */
export function SyncWatcher() {
  const { calendars, events, templates, birthdays, savedColors, colorRules, reloadSyncedData } = useCalendarContext();
  const lastForegroundSync = useRef(0);
  /** Set while state is being reloaded from a sync, so that reload isn't mistaken for an edit. */
  const reloading = useRef(false);
  const mounted = useRef(false);

  const sync = useRef(async () => {
    try {
      const config = getSyncConfig();
      if (!config) return;
      const { received } = await syncNow(config);
      if (received > 0) {
        reloading.current = true;
        reloadSyncedData();
      }
    } catch (error) {
      console.warn('Sync failed', error);
    }
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    lastForegroundSync.current = Date.now();
    void sync.current();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastForegroundSync.current < FOREGROUND_INTERVAL_MS) return;
      lastForegroundSync.current = Date.now();
      void sync.current();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reloading.current) {
      reloading.current = false;
      return;
    }
    const id = setTimeout(() => void sync.current(), EDIT_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [calendars, events, templates, birthdays, savedColors, colorRules]);

  return null;
}
