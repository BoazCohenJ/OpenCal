import * as chrono from 'chrono-node';
import { addHours, endOfDay, startOfDay } from 'date-fns';

export interface ParsedEventText {
  title: string;
  location?: string;
  start?: Date;
  end?: Date;
  isAllDay: boolean;
  /** The fragment chrono recognised as a date/time, for display. */
  dateText?: string;
}

const LEADING = /^(?:(?:on|at|from|for)\b|@|[-–,])\s*/i;
const TRAILING = /\s*(?:\b(?:on|at|from|for)|@|[-–,])$/i;

function tidy(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  let prev = '';
  while (prev !== t) {
    prev = t;
    t = t.replace(LEADING, '').replace(TRAILING, '').trim();
  }
  return t;
}

/**
 * "lunch with John Fri 1pm at Cafe X" → { title: 'Lunch with John', start: Fri 13:00, location: 'Cafe X' }
 * chrono-node extracts the date/time; title and location come from the unconsumed text.
 */
export function parseEventText(text: string, reference: Date = new Date()): ParsedEventText {
  const input = text.trim();
  if (!input) return { title: '', isAllDay: false };

  const result = chrono.parse(input, reference, { forwardDate: true })[0];
  let remainder = input;
  let start: Date | undefined;
  let end: Date | undefined;
  let isAllDay = false;
  let dateText: string | undefined;

  if (result) {
    dateText = result.text;
    remainder = `${input.slice(0, result.index)} ${input.slice(result.index + result.text.length)}`;
    isAllDay = !result.start.isCertain('hour');
    start = result.start.date();
    end = result.end ? result.end.date() : undefined;
    if (isAllDay) {
      start = startOfDay(start);
      end = endOfDay(end && end > start ? end : start);
    } else if (!end || end <= start) {
      end = addHours(start, 1);
    }
  }

  let location: string | undefined;
  const loc = remainder.match(/(?:^|\s)(?:at|@)\s+(.+)$/i);
  if (loc && loc.index !== undefined) {
    const candidate = tidy(loc[1] ?? '');
    if (candidate) {
      location = candidate;
      remainder = remainder.slice(0, loc.index);
    }
  }

  const raw = tidy(remainder);
  const title = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
  return { title, location, start, end, isAllDay, dateText };
}
