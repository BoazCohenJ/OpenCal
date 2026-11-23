import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';
import {
  dueSubscriptions,
  getSubscriptionStatuses,
  refreshSubscription,
  subscribeSubscriptionStatus,
  type SubscriptionStatus,
} from '../services/subscriptions';

let cachedStatuses: Record<string, SubscriptionStatus> | null = null;
const readStatuses = () => (cachedStatuses ??= getSubscriptionStatuses());
const subscribe = (listener: () => void) =>
  subscribeSubscriptionStatus(() => {
    cachedStatuses = null;
    listener();
  });

/** Per-calendar refresh status of subscribed calendars on this device. */
export const useSubscriptionStatuses = (): Record<string, SubscriptionStatus> => useSyncExternalStore(subscribe, readStatuses);

/** Hook that refreshes one subscribed calendar now with the app's current data. */
export function useRefreshSubscription() {
  const { events, saveEvents, deleteEvents, notificationPrefs } = useCalendarContext();
  const latest = useRef({ events, saveEvents, deleteEvents, allDayTime: notificationPrefs.allDayTime });
  useLayoutEffect(() => {
    latest.current = { events, saveEvents, deleteEvents, allDayTime: notificationPrefs.allDayTime };
  });
  return (calendar: Parameters<typeof refreshSubscription>[0]) => {
    const l = latest.current;
    return refreshSubscription(calendar, l.events, l.allDayTime, l);
  };
}

/**
 * Refreshes subscribed calendars when they're due: on start, on returning to the foreground, and
 * right after one is added or its address changes.
 */
export function SubscriptionWatcher() {
  const { ready, calendars } = useCalendarContext();
  const refresh = useRefreshSubscription();
  const refreshRef = useRef(refresh);
  const calendarsRef = useRef(calendars);
  useLayoutEffect(() => {
    refreshRef.current = refresh;
    calendarsRef.current = calendars;
  });

  const feedKey = calendars
    .filter((c) => c.subscription)
    .map((c) => `${c.id}:${c.subscription!.url}`)
    .join('|');

  useEffect(() => {
    if (!ready) return;
    const run = () => {
      // One at a time, so each refresh plans against the events the previous one wrote.
      void (async () => {
        for (const calendar of dueSubscriptions(calendarsRef.current)) {
          await refreshRef.current(calendar).catch((e) => console.warn('Calendar refresh failed', calendar.name, e));
        }
      })();
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, [ready, feedKey]);

  return null;
}
