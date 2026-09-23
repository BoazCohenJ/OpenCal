import { format } from 'date-fns';
import { RRule } from 'rrule';
import { parseDayKey } from './dates';

export type RepeatFreq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RepeatEnd =
  | { type: 'never' }
  | { type: 'until'; date: string }
  | { type: 'count'; count: number };

export interface RepeatConfig {
  freq: RepeatFreq;
  interval: number;
  /** rrule weekday indexes: 0 = Monday … 6 = Sunday */
  weekdays: number[];
  end: RepeatEnd;
}

export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const jsDayToRRule = (jsDay: number): number => (jsDay + 6) % 7;

/*
 * rrule works in UTC. We use "floating" times: local wall-clock values are stored in the UTC fields
 * so recurrences stay at the same local time across DST changes.
 */
export const toFloatingUTC = (d: Date): Date =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));

export const fromFloatingUTC = (d: Date): Date =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());

export function defaultRepeatConfig(start: Date): RepeatConfig {
  return { freq: 'none', interval: 1, weekdays: [jsDayToRRule(start.getDay())], end: { type: 'never' } };
}

export function parseRRule(rule: string | undefined, start: Date): RepeatConfig {
  const config = defaultRepeatConfig(start);
  if (!rule) return config;
  const parts = new Map<string, string>();
  for (const seg of rule.replace(/^RRULE:/i, '').split(';')) {
    const [k, v] = seg.split('=');
    if (k && v) parts.set(k.toUpperCase(), v);
  }
  const freq = (parts.get('FREQ') ?? '').toLowerCase();
  if (freq !== 'daily' && freq !== 'weekly' && freq !== 'monthly' && freq !== 'yearly') return config;
  config.freq = freq;
  config.interval = Math.max(1, parseInt(parts.get('INTERVAL') ?? '1', 10) || 1);
  const byday = parts.get('BYDAY');
  if (byday) {
    const days = byday.split(',').map((c) => WEEKDAY_CODES.indexOf(c.slice(-2).toUpperCase())).filter((i) => i >= 0);
    if (days.length) config.weekdays = days;
  }
  const until = parts.get('UNTIL');
  const count = parts.get('COUNT');
  if (until && /^\d{8}/.test(until)) {
    config.end = { type: 'until', date: `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` };
  } else if (count) {
    config.end = { type: 'count', count: Math.max(1, parseInt(count, 10) || 1) };
  }
  return config;
}

export function buildRRule(config: RepeatConfig): string | undefined {
  if (config.freq === 'none') return undefined;
  const parts = [`FREQ=${config.freq.toUpperCase()}`, `INTERVAL=${Math.max(1, config.interval)}`];
  if (config.freq === 'weekly' && config.weekdays.length) {
    parts.push(`BYDAY=${[...config.weekdays].sort((a, b) => a - b).map((i) => WEEKDAY_CODES[i]).join(',')}`);
  }
  if (config.end.type === 'until') parts.push(`UNTIL=${config.end.date.replace(/-/g, '')}T235959Z`);
  if (config.end.type === 'count') parts.push(`COUNT=${Math.max(1, config.end.count)}`);
  return parts.join(';');
}

export function createRule(rule: string, start: Date): RRule | null {
  try {
    const options = RRule.parseString(rule.replace(/^RRULE:/i, ''));
    return new RRule({ ...options, dtstart: toFloatingUTC(start) });
  } catch (error) {
    console.warn('Invalid recurrence rule', rule, error);
    return null;
  }
}

const UNITS = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
} as const;

export function describeRepeat(config: RepeatConfig): string {
  if (config.freq === 'none') return 'Does not repeat';
  const [one, many] = UNITS[config.freq];
  let text = config.interval === 1 ? `Every ${one}` : `Every ${config.interval} ${many}`;
  if (config.freq === 'weekly' && config.weekdays.length) {
    text += ` on ${[...config.weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ')}`;
  }
  if (config.end.type === 'until') text += `, until ${format(parseDayKey(config.end.date), 'MMM d, yyyy')}`;
  if (config.end.type === 'count') text += `, ${config.end.count} times`;
  return text;
}

export const describeRRule = (rule: string | undefined, start: Date): string =>
  describeRepeat(parseRRule(rule, start));
