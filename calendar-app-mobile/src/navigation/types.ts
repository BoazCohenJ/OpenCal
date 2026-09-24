import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Event } from '../models/Event';

export type EventDraft = Partial<Omit<Event, 'id'>>;

export type RootStackParamList = {
  Calendar: undefined;
  EventEdit: { eventId?: string; draft?: EventDraft } | undefined;
  QuickAdd: undefined;
  Stamp: { templateId?: string; start?: string } | undefined;
  Settings: undefined;
  Notifications: undefined;
  Calendars: undefined;
  CalendarEdit: { calendarId?: string } | undefined;
  Templates: undefined;
  TemplateEdit: { templateId?: string } | undefined;
  HiddenEvents: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
