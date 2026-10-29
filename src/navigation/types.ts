import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Event } from '../models/Event';
import type { FocusKind } from '../models/NotificationPrefs';

export type EventDraft = Partial<Omit<Event, 'id'>>;

export type RootStackParamList = {
  /** Set by widget links (opencal://calendar?mode=day&date=2026-10-11) to open a view at a date. */
  Calendar: { mode?: string; date?: string } | undefined;
  EventEdit: { eventId?: string; occurrenceStart?: string; draft?: EventDraft; fromQuickAdd?: boolean } | undefined;
  QuickAdd: undefined;
  Stamp: { templateId?: string; start?: string } | undefined;
  Settings: undefined;
  Notifications: undefined;
  FocusEdit: { windowId?: string; kind?: FocusKind } | undefined;
  Calendars: undefined;
  CalendarEdit: { calendarId?: string } | undefined;
  CalendarDelete: { calendarId: string };
  Templates: undefined;
  TemplateEdit: { templateId?: string } | undefined;
  HiddenEvents: undefined;
  Birthdays: undefined;
  ColorRules: undefined;
  ImportExport: undefined;
  Sync: undefined;
  BirthdayEdit: { birthdayId?: string } | undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
