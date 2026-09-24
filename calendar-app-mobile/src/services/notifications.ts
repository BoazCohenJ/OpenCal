import { addDays, addMinutes, startOfDay } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import { isInQuietHours, type NotificationPrefs } from '../models/NotificationPrefs';
import { formatRange } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { expandEvents } from './occurrences';

/** iOS allows 64 pending local notifications per app; keep headroom for the test notification. */
export const MAX_SCHEDULED = 60;

// Android channel sound can't be changed after creation, so sound and silent reminders use separate channels.
const CHANNEL_SOUND = 'reminders';
const CHANNEL_SILENT = 'reminders-silent';

let configured = false;

async function configure(): Promise<void> {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async (n) => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: n.request.content.data?.silent !== true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_SOUND, {
      name: 'Event reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250],
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, {
      name: 'Quiet reminders',
      description: 'Reminders during quiet hours or with sound turned off',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: null,
    });
  }
  configured = true;
}

export type NotificationStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const notificationsSupported = Platform.OS !== 'web';

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (!notificationsSupported) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  try {
    await configure();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch (error) {
    console.warn('Notification permission request failed', error);
    return false;
  }
}

export interface PendingReminder {
  key: string;
  date: Date;
  title: string;
  body: string;
  silent: boolean;
}

/** Pure planning step: every reminder inside the horizon, soonest first (uncapped). */
export function planReminders(
  events: Event[],
  calendarsById: Record<string, Calendar>,
  prefs: NotificationPrefs,
  now = new Date(),
): PendingReminder[] {
  if (!prefs.enabled) return [];
  const muted = new Set(prefs.mutedCalendarIds);
  const candidates = events.filter((e) => e.reminders.length > 0 && !muted.has(e.calendarId));
  const seen = new Set<string>();
  const pending: PendingReminder[] = [];
  for (const occ of expandEvents(candidates, calendarsById, now, addDays(now, prefs.horizonDays))) {
    // All-day reminders count back from a configurable time of day instead of midnight.
    const anchor = occ.event.isAllDay ? addMinutes(startOfDay(occ.start), prefs.allDayTime) : occ.start;
    for (const minutes of new Set(occ.event.reminders)) {
      const date = new Date(anchor.getTime() - minutes * 60000);
      const key = `${occ.event.id}@${date.getTime()}`;
      if (date <= now || seen.has(key)) continue;
      seen.add(key);
      pending.push({
        key,
        date,
        title: eventLabel(occ.event),
        body: [formatRange(occ.start, occ.end, occ.event.isAllDay), occ.event.location].filter(Boolean).join(' · '),
        silent: !prefs.sound || isInQuietHours(date, prefs.quietHours),
      });
    }
  }
  return pending.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface ScheduleResult {
  scheduled: number;
  /** True when more reminders fell inside the horizon than the OS allows at once. */
  truncated: boolean;
  next: Date | null;
  status: NotificationStatus;
}

// Serialize runs: two overlapping cancel-then-schedule passes would otherwise double up notifications.
let queue: Promise<unknown> = Promise.resolve();

/** Replaces all scheduled reminders with the soonest upcoming ones inside the horizon. */
export function rescheduleReminders(
  events: Event[],
  calendarsById: Record<string, Calendar>,
  prefs: NotificationPrefs,
  { askPermission = false }: { askPermission?: boolean } = {},
): Promise<ScheduleResult> {
  const run = queue.then(() => doReschedule(events, calendarsById, prefs, askPermission));
  queue = run.catch(() => undefined);
  return run;
}

async function doReschedule(
  events: Event[],
  calendarsById: Record<string, Calendar>,
  prefs: NotificationPrefs,
  askPermission: boolean,
): Promise<ScheduleResult> {
  const planned = planReminders(events, calendarsById, prefs);
  const pending = planned.slice(0, MAX_SCHEDULED);
  const empty = (status: NotificationStatus): ScheduleResult => ({ scheduled: 0, truncated: false, next: null, status });
  if (!notificationsSupported) return empty('unsupported');
  try {
    await configure();
    let status = await getNotificationStatus();
    if (pending.length === 0 || status !== 'granted') {
      if (status === 'granted') await Notifications.cancelAllScheduledNotificationsAsync();
      if (pending.length === 0 || !askPermission || status !== 'undetermined') return empty(status);
      status = (await requestNotificationPermission()) ? 'granted' : await getNotificationStatus();
      if (status !== 'granted') return empty(status);
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    let scheduled = 0;
    for (const p of pending) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: p.title,
            body: p.body,
            sound: p.silent ? false : 'default',
            data: { key: p.key, silent: p.silent },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: p.date,
            channelId: p.silent ? CHANNEL_SILENT : CHANNEL_SOUND,
          },
        });
        scheduled++;
      } catch (error) {
        // One bad reminder (e.g. clock moved past it mid-run) shouldn't drop the rest.
        console.warn('Failed to schedule reminder', p.key, error);
      }
    }
    return { scheduled, truncated: planned.length > MAX_SCHEDULED, next: pending[0]?.date ?? null, status };
  } catch (error) {
    console.warn('Failed to schedule reminders', error);
    return empty(await getNotificationStatus());
  }
}

/** Fires a sample reminder a few seconds from now so users can check sound and banners. */
export async function sendTestNotification(prefs: NotificationPrefs): Promise<boolean> {
  if (!(await requestNotificationPermission())) return false;
  const silent = !prefs.sound || isInQuietHours(new Date(), prefs.quietHours);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'OpenCal reminder',
      body: silent ? 'This is how reminders look (quiet right now).' : 'This is how reminders look and sound.',
      sound: silent ? false : 'default',
      data: { test: true, silent },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: silent ? CHANNEL_SILENT : CHANNEL_SOUND,
    },
  });
  return true;
}
