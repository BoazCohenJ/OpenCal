import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export interface Permissions {
  granted: boolean;
  canAskAgain: boolean;
}

export interface ReminderInput {
  key: string;
  /** Unix epoch milliseconds. */
  atMs: number;
  title: string;
  body: string;
  /** Quiet reminders post to a channel without sound or vibration. */
  silent: boolean;
}

export interface ScheduledReminder {
  key: string;
  title: string;
  body: string;
  silent: boolean;
}

interface Native {
  ensureChannels(): Promise<void>;
  getPermissions(): Promise<Permissions>;
  requestPermissions(): Promise<Permissions>;
  getScheduled(): Promise<ScheduledReminder[]>;
  schedule(items: ReminderInput[]): Promise<void>;
  cancelAll(): Promise<void>;
  scheduleWidgetRefresh(): Promise<void>;
}

// Reminders are scheduled with AlarmManager on Android only; other platforms have no native module.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('OpenCalNotifications') : null;

export const remindersSupported = native !== null;

function need(): Native {
  if (!native) throw new Error('Reminders are not supported on this platform');
  return native;
}

export const ensureChannels = () => need().ensureChannels();
export const getPermissions = () => need().getPermissions();
export const requestPermissions = () => need().requestPermissions();
export const getScheduled = () => need().getScheduled();
export const scheduleReminders = (items: ReminderInput[]) => need().schedule(items);
export const cancelAllReminders = () => need().cancelAll();

/**
 * Arms the alarm that redraws the home-screen widgets at the start of each day, so they never keep showing
 * yesterday. Does nothing on a build that doesn't have it yet.
 */
export const scheduleWidgetRefresh = async (): Promise<void> => {
  if (typeof native?.scheduleWidgetRefresh === 'function') await native.scheduleWidgetRefresh();
};
