import { addDays, addMinutes } from 'date-fns';
import * as Reminders from '../../modules/opencal-notifications';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { NotificationPrefs } from '../models/NotificationPrefs';
import { atMinutes, formatRange } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { activeFocusPeriod, expandFocusWindows, focusStateAt } from './focus';
import { expandEvents } from './occurrences';

/** Cap on queued reminders: the app reschedules on every launch, so only the soonest need to be pending. */
export const MAX_SCHEDULED = 60;

let configured = false;

async function configure(): Promise<void> {
  if (configured) return;
  await Reminders.ensureChannels();
  configured = true;
}

export type NotificationStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const notificationsSupported = Reminders.remindersSupported;

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (!notificationsSupported) return 'unsupported';
  try {
    const p = await Reminders.getPermissions();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  try {
    await configure();
    const existing = await Reminders.getPermissions();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    return (await Reminders.requestPermissions()).granted;
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
  /** Rings like an alarm. Never set together with `silent`. */
  alarm: boolean;
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
  const horizonEnd = addDays(now, prefs.horizonDays);
  const focus = expandFocusWindows(prefs.focusWindows, addDays(now, -2), horizonEnd);
  // A reminder fires before its occurrence, so look past the horizon by the longest lead time (plus a day for all-day anchors).
  const maxLead = Math.max(0, ...candidates.flatMap((e) => e.reminders));
  const searchEnd = addMinutes(horizonEnd, maxLead + 24 * 60);
  for (const occ of expandEvents(candidates, calendarsById, now, searchEnd)) {
    // All-day reminders count back from a configurable time of day instead of midnight.
    const anchor = occ.event.isAllDay ? atMinutes(occ.start, prefs.allDayTime) : occ.start;
    const alarms = new Set(occ.event.alarms ?? []);
    for (const minutes of new Set(occ.event.reminders)) {
      const date = new Date(anchor.getTime() - minutes * 60000);
      const key = `${occ.event.id}@${date.getTime()}`;
      if (date <= now || date > horizonEnd || seen.has(key)) continue;
      seen.add(key);
      const state = focusStateAt(date, focus);
      if (state === 'dnd') continue;
      // Alarms ring even with reminder sounds off; in quiet time they arrive silently unless the event opts in.
      const alarm = alarms.has(minutes) && (state !== 'quiet' || occ.event.alarmsInQuiet === true);
      pending.push({
        key,
        date,
        title: eventLabel(occ.event),
        body: [formatRange(occ.start, occ.end, occ.event.isAllDay), occ.event.location].filter(Boolean).join(' · '),
        silent: !alarm && (!prefs.sound || state === 'quiet'),
        alarm,
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
  { askPermission = false, askAlways = false }: { askPermission?: boolean; askAlways?: boolean } = {},
): Promise<ScheduleResult> {
  const run = queue.then(() => doReschedule(events, calendarsById, prefs, askPermission, askAlways));
  queue = run.catch(() => undefined);
  return run;
}

async function doReschedule(
  events: Event[],
  calendarsById: Record<string, Calendar>,
  prefs: NotificationPrefs,
  askPermission: boolean,
  askAlways: boolean,
): Promise<ScheduleResult> {
  const planned = planReminders(events, calendarsById, prefs);
  const pending = planned.slice(0, MAX_SCHEDULED);
  const empty = (status: NotificationStatus): ScheduleResult => ({ scheduled: 0, truncated: false, next: null, status });
  if (!notificationsSupported) return empty('unsupported');
  try {
    await configure();
    let status = await getNotificationStatus();
    if (pending.length === 0 || status !== 'granted') {
      if (status === 'granted') await Reminders.cancelAllReminders(prefs.enabled ? withAlarms(events) : []);
      // Background passes only ask once reminders exist; the Enable button (askAlways) asks right away.
      if (!askPermission || (pending.length === 0 && !askAlways) || status !== 'undetermined') return empty(status);
      status = (await requestNotificationPermission()) ? 'granted' : await getNotificationStatus();
      if (status !== 'granted' || pending.length === 0) return empty(status);
    }

    // Usually nothing changed since the last pass (e.g. just reopening the app): keep what's queued.
    // Ring and snooze lengths only matter for alarms, so a changed setting re-queues just when alarms are queued.
    const signature = (n: { key: unknown; silent: unknown; title: unknown; body: unknown; alarm?: unknown; ringMinutes?: unknown; snoozeMinutes?: unknown }) =>
      `${n.key}|${n.silent === true}|${n.alarm === true}|${n.title}|${n.body}` +
      (n.alarm === true ? `|${n.ringMinutes}|${n.snoozeMinutes}` : '');
    const queued = await Reminders.getScheduled();
    const wanted = new Set(pending.map((p) => signature({ ...p, ringMinutes: prefs.alarmRingMinutes, snoozeMinutes: prefs.alarmSnoozeMinutes })));
    const have = new Set(queued.map(signature));
    if (queued.length === wanted.size && have.size === wanted.size && [...have].every((s) => wanted.has(s))) {
      return { scheduled: queued.length, truncated: planned.length > MAX_SCHEDULED, next: pending[0]?.date ?? null, status };
    }

    await Reminders.cancelAllReminders(withAlarms(events));
    await Reminders.scheduleReminders(
      pending.map((p) => ({
        key: p.key,
        atMs: p.date.getTime(),
        title: p.title,
        body: p.body,
        silent: p.silent,
        alarm: p.alarm,
        ringMinutes: prefs.alarmRingMinutes,
        snoozeMinutes: prefs.alarmSnoozeMinutes,
      })),
    );
    const scheduled = pending.length;
    return { scheduled, truncated: planned.length > MAX_SCHEDULED, next: pending[0]?.date ?? null, status };
  } catch (error) {
    console.warn('Failed to schedule reminders', error);
    return empty(await getNotificationStatus());
  }
}

/** Ids of events that still have alarms: a snoozed alarm whose event is gone or lost its alarm is dropped. */
const withAlarms = (events: Event[]): string[] => events.filter((e) => e.alarms?.length).map((e) => e.id);

/** Fires a sample alarm a few seconds from now, ringing as a real one would (quiet times aside). */
export async function sendTestAlarm(prefs: NotificationPrefs): Promise<boolean> {
  if (!(await requestNotificationPermission())) return false;
  await Reminders.scheduleReminders([
    {
      key: 'test-alarm',
      atMs: Date.now() + 3000,
      title: 'OpenCal alarm',
      body: `Rings for up to ${prefs.alarmRingMinutes} min. Snooze puts it off for ${prefs.alarmSnoozeMinutes} min.`,
      silent: false,
      alarm: true,
      ringMinutes: prefs.alarmRingMinutes,
      snoozeMinutes: prefs.alarmSnoozeMinutes,
    },
  ]);
  return true;
}

/** Fires a sample reminder a few seconds from now so users can check sound and banners. */
export async function sendTestNotification(prefs: NotificationPrefs): Promise<boolean> {
  if (!(await requestNotificationPermission())) return false;
  const silent = !prefs.sound || activeFocusPeriod(prefs.focusWindows) !== null;
  await Reminders.scheduleReminders([
    {
      key: 'test',
      atMs: Date.now() + 3000,
      title: 'OpenCal reminder',
      body: silent ? 'This is how reminders look (quiet right now).' : 'This is how reminders look and sound.',
      silent,
    },
  ]);
  return true;
}
