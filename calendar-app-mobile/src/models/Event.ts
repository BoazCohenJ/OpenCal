import { Calendar } from './Calendar';

export interface PauseWindow {
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  isAllDay: boolean;
  location?: string;
  calendarId: string; // foreign key to Calendar
  color?: string;     // hex color override for this event
  recurrenceRule?: string; // RRule string, if undefined then it's a single event
  pauseWindows: PauseWindow[]; // array of pause windows (exclusion windows)
  reminders: number[]; // minutes before start to remind
  emoji?: string;      // single emoji character
  tags?: string[];     // array of tags
}