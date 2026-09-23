import { addDays } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import { formatRange } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { expandEvents } from './occurrences';

const HORIZON_DAYS = 30;
/** iOS allows 64 pending local notifications per app. */
const MAX_SCHEDULED = 60;

let configured = false;

function configure(): void {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Event reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  configured = true;
}

export type NotificationStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    configure();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch (error) {
    console.warn('Notification permission request failed', error);
    return false;
  }
}

/** Replaces all scheduled reminders with the soonest upcoming ones (next 30 days). */
export async function rescheduleReminders(events: Event[], calendarsById: Record<string, Calendar>): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const now = new Date();
    const withReminders = events.filter((e) => e.reminders.length > 0);
    const pending: { date: Date; title: string; body: string }[] = [];
    for (const occ of expandEvents(withReminders, calendarsById, now, addDays(now, HORIZON_DAYS))) {
      for (const minutes of occ.event.reminders) {
        const date = new Date(occ.start.getTime() - minutes * 60000);
        if (date > now) {
          pending.push({
            date,
            title: eventLabel(occ.event),
            body: [formatRange(occ.start, occ.end, occ.event.isAllDay), occ.event.location].filter(Boolean).join(' · '),
          });
        }
      }
    }

    if (pending.length === 0) {
      if (configured) await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }
    if (!(await requestNotificationPermission())) return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    pending.sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const p of pending.slice(0, MAX_SCHEDULED)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date },
      });
    }
  } catch (error) {
    console.warn('Failed to schedule reminders', error);
  }
}
