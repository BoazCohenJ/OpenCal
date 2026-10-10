import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';
import { getSyncConfig, getSyncStatus, subscribeSyncStatus, syncNow, type SyncStatus } from '../services/sync';

/** How long after a local edit to sync, so a burst of edits goes out together. */
const EDIT_DEBOUNCE_MS = 3000;
/** Minimum gap between syncs triggered by the app returning to the foreground. */
const FOREGROUND_INTERVAL_MS = 30 * 1000;

export const useSyncStatus = (): SyncStatus => useSyncExternalStore(subscribeSyncStatus, getSyncStatus);

async function syncIfSetUp(): Promise<void> {
  try {
    const config = getSyncConfig();
    if (config) await syncNow(config);
  } catch (error) {
    // Offline is normal; the error shows in Settings → Sync and the next trigger retries.
    console.warn('Sync failed', error);
  }
}

/**
 * Syncs with the self-hosted server, when one is set up: on start, on returning to the
 * foreground, and shortly after local edits. Whenever a sync (from here or Settings → Sync)
 * changes data, the app re-reads it.
 */
export function SyncWatcher() {
  const { calendars, events, templates, birthdays, savedColors, colorRules, reloadSyncedData } = useCalendarContext();
  const { dataVersion } = useSyncStatus();
  const lastForegroundSync = useRef(0);
  /** Set while state is being reloaded from a sync, so that reload isn't mistaken for an edit. */
  const reloading = useRef(false);
  const seenData = useRef(false);
  const seenVersion = useRef(dataVersion);

  useEffect(() => {
    lastForegroundSync.current = Date.now();
    void syncIfSetUp();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastForegroundSync.current < FOREGROUND_INTERVAL_MS) return;
      lastForegroundSync.current = Date.now();
      void syncIfSetUp();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (dataVersion === seenVersion.current) return;
    seenVersion.current = dataVersion;
    reloading.current = true;
    reloadSyncedData();
  }, [dataVersion, reloadSyncedData]);

  useEffect(() => {
    if (!seenData.current) {
      seenData.current = true;
      return;
    }
    if (reloading.current) {
      reloading.current = false;
      return;
    }
    const id = setTimeout(() => void syncIfSetUp(), EDIT_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [calendars, events, templates, birthdays, savedColors, colorRules]);

  return null;
}
