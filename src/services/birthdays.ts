import { addDays, format, startOfDay } from 'date-fns';
import type { Birthday } from '../models/Birthday';
import type { Event } from '../models/Event';
import { parseDayKey } from '../utils/dates';
import type { Occurrence } from './occurrences';

/** Pseudo calendar id birthday events belong to; also the key used to hide them from the chips. */
export const BIRTHDAYS_CALENDAR_ID = 'birthdays';
export const BIRTHDAY_COLOR = '#EC4899';
const EVENT_ID_PREFIX = 'birthday:';

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd … */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** The birthday id behind a birthday occurrence, or null for regular events. */
export const birthdayIdOf = (event: Event): string | null =>
  event.calendarId === BIRTHDAYS_CALENDAR_ID && event.id.startsWith(EVENT_ID_PREFIX) ? event.id.slice(EVENT_ID_PREFIX.length) : null;

/** The date the birthday is celebrated in `year`. Feb 29 falls on Feb 28 in common years. */
function birthdayIn(birth: Date, year: number): Date {
  const d = new Date(year, birth.getMonth(), birth.getDate());
  return d.getMonth() === birth.getMonth() ? d : new Date(year, birth.getMonth() + 1, 0);
}

/** All-day occurrences for every birthday (from the 1st onwards) on a day overlapping [rangeStart, rangeEnd). */
export function expandBirthdays(birthdays: Birthday[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const b of birthdays) {
    const birth = parseDayKey(b.birthDate);
    if (Number.isNaN(birth.getTime())) continue;
    for (let year = rangeStart.getFullYear(); year <= rangeEnd.getFullYear(); year++) {
      const age = year - birth.getFullYear();
      if (age < 1) continue;
      const start = birthdayIn(birth, year);
      if (start < startOfDay(rangeStart) || start >= rangeEnd) continue;
      const end = addDays(start, 1);
      end.setMilliseconds(-1);
      const event: Event = {
        id: `${EVENT_ID_PREFIX}${b.id}`,
        title: `${b.name}'s ${ordinal(age)} birthday`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isAllDay: true,
        calendarId: BIRTHDAYS_CALENDAR_ID,
        color: BIRTHDAY_COLOR,
        pauseWindows: [],
        reminders: [],
        emoji: 'icon:cake',
        tags: [],
      };
      out.push({ key: `${event.id}@${format(start, 'yyyy')}`, event, start, end, color: BIRTHDAY_COLOR });
    }
  }
  return out;
}
