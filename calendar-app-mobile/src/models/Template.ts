/** A saved "stamp": everything about an event except when it happens. */
export interface EventTemplate {
  id: string;
  name: string;
  title: string;
  description?: string;
  emoji?: string;
  /** Minutes. For all-day templates this is a multiple of 1440 (days). */
  durationMinutes: number;
  isAllDay: boolean;
  location?: string;
  calendarId: string;
  color?: string;
  reminders: number[];
  tags: string[];
  sortOrder: number;
}
