import { format, startOfDay, subDays } from 'date-fns';
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
  /** Rule parts the editor can't express (e.g. monthly BYDAY=1MO), kept while the frequency is unchanged. */
  preserved?: { freq: RepeatFreq; parts: string[] };
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
  if (freq === 'monthly' || freq === 'yearly') {
    const keep = ['BYDAY', 'BYSETPOS', 'BYMONTHDAY', 'BYMONTH'].filter((k) => parts.has(k)).map((k) => `${k}=${parts.get(k)}`);
    if (keep.length) config.preserved = { freq, parts: keep };
  } else if (byday) {
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
  if (config.preserved && config.preserved.freq === config.freq) parts.push(...config.preserved.parts);
  if (config.end.type === 'until') parts.push(`UNTIL=${config.end.date.replace(/-/g, '')}T235959Z`);
  if (config.end.type === 'count') parts.push(`COUNT=${Math.max(1, config.end.count)}`);
  return parts.join(';');
}

export const createRule = (rule: string, start: Date): RRule | null => createRuleAt(rule, toFloatingUTC(start));

/** Like createRule, with the first occurrence given as a wall clock date (UTC fields = clock reading). */
export function createRuleAt(rule: string, wallStart: Date): RRule | null {
  try {
    const options = RRule.parseString(rule.replace(/^RRULE:/i, ''));
    // Sub-daily rules are outside the editor contract and can exhaust the synchronous renderer.
    if (options.freq == null || options.freq > RRule.DAILY) return null;
    const parsed = new RRule({ ...options, dtstart: wallStart });
    // rrule looks for a match up to year 9999 before giving up, which stalls the renderer.
    return neverMatches(parsed) ? null : parsed;
  } catch (error) {
    console.warn('Invalid recurrence rule', rule, error);
    return null;
  }
}

/** A rule that parses but can never produce a date, e.g. BYMONTH=2;BYMONTHDAY=30. */
export function isImpossibleRule(rule: string, start: Date): boolean {
  try {
    const options = RRule.parseString(rule.replace(/^RRULE:/i, ''));
    if (options.freq == null || options.freq > RRule.DAILY) return false;
    return neverMatches(new RRule({ ...options, dtstart: toFloatingUTC(start) }));
  } catch {
    return false;
  }
}

const daysIn = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * Whether no month the rule visits has one of its BYMONTHDAY days (Feb 30, Apr 31, Feb 29 in
 * years a yearly rule never reaches). The calendar repeats every 400 years, so one cycle of the
 * rule's months is enough. Rules with BYYEARDAY or BYWEEKNO aren't checked (assumed possible).
 */
function neverMatches(rule: RRule): boolean {
  const o = rule.options;
  if (o.byyearday?.length || o.byweekno?.length) return false;
  const days = [...(o.bymonthday ?? []), ...(o.bynmonthday ?? []).map((d) => -d)];
  if (!days.length) return false;
  const months = o.bymonth?.length ? o.bymonth.map((m) => m - 1) : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const fits = (year: number, month: number) => {
    const n = daysIn(year, month);
    return days.some((d) => d <= n);
  };
  const y0 = o.dtstart.getUTCFullYear();
  const interval = Math.max(1, o.interval || 1);
  if (o.freq === RRule.YEARLY) {
    for (let k = 0; k < 400; k++) if (months.some((m) => fits(y0 + k * interval, m))) return false;
    return true;
  }
  if (o.freq === RRule.MONTHLY) {
    const m0 = y0 * 12 + o.dtstart.getUTCMonth();
    for (let k = 0; k < 4800; k++) {
      const m = m0 + k * interval;
      if (months.includes(m % 12) && fits(Math.floor(m / 12), m % 12)) return false;
    }
    return true;
  }
  // Daily and weekly rules reach every month over the cycle; 2000 is a leap year.
  return !months.some((m) => fits(2000, m));
}

const DAY_MS = 86400000;

/**
 * The same rule, started a whole number of its periods later: shortly before `fromMs` instead of
 * years back. rrule steps through every period from the start, so this saves that walk for
 * long-running series and gives the same dates from `fromMs` on. Rules with a COUNT (which counts
 * from the very first repeat) are returned as they are.
 */
export function fastForwardRule(rule: RRule, fromMs: number): RRule {
  const o = rule.origOptions;
  if (o.count != null || !o.dtstart) return rule;
  const start = o.dtstart;
  if (o.freq === RRule.DAILY || o.freq === RRule.WEEKLY) {
    const period = (o.interval || 1) * (o.freq === RRule.DAILY ? 1 : 7) * DAY_MS;
    const steps = Math.floor((fromMs - period - start.getTime()) / period);
    return steps > 0 ? new RRule({ ...o, dtstart: new Date(start.getTime() + steps * period) }) : rule;
  }
  if (o.freq !== RRule.MONTHLY && o.freq !== RRule.YEARLY) return rule;
  // Whole periods (months or years) to skip, keeping at least one period before `fromMs`.
  const monthly = o.freq === RRule.MONTHLY;
  const from = new Date(fromMs);
  const unit = (d: Date) => (monthly ? d.getUTCFullYear() * 12 + d.getUTCMonth() : d.getUTCFullYear());
  const interval = o.interval || 1;
  const steps = Math.floor((unit(from) - 1 - unit(start)) / interval);
  if (steps <= 0) return rule;
  const target = unit(start) + steps * interval;
  // The new start is the first day of its period at the same time of day. rrule takes the day
  // (and for yearly rules the month) from the start when the rule names none, so pin those.
  const named = o.bymonthday != null || o.byweekday != null || o.byyearday != null || o.byweekno != null;
  const pinned = named
    ? {}
    : { bymonthday: start.getUTCDate(), ...(!monthly && o.bymonth == null ? { bymonth: start.getUTCMonth() + 1 } : {}) };
  const dtstart = new Date(
    Date.UTC(monthly ? Math.floor(target / 12) : target, monthly ? target % 12 : 0, 1, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()),
  );
  return new RRule({ ...o, ...pinned, dtstart });
}

const isEmpty = (list: unknown[] | null | undefined): boolean => !list || list.length === 0;
/** Monday = 0, like rrule, for a day counted from 1970-01-01 (a Thursday). */
const weekdayOf = (day: number): number => (((day + 3) % 7) + 7) % 7;

/**
 * The rule's dates (wall clock dates) from `from` to `to`, both included. Plain daily and weekly
 * rules (the most common kind) are worked out directly, which is far cheaper than rrule's
 * period-by-period walk; everything else goes through rrule.
 */
export function ruleBetween(rule: RRule, from: Date, to: Date): Date[] {
  return plainDates(rule, from.getTime(), to.getTime()) ?? fastForwardRule(rule, from.getTime()).between(from, to, true, (_, i) => i < 10000);
}

/** Dates of a daily or weekly rule with only BYDAY, INTERVAL, WKST and UNTIL, or null for any other rule. */
function plainDates(rule: RRule, fromMs: number, toMs: number): Date[] | null {
  const o = rule.options;
  const daily = o.freq === RRule.DAILY;
  if (!daily && o.freq !== RRule.WEEKLY) return null;
  if (o.count != null || o.byeaster != null || !isEmpty(o.bysetpos) || !isEmpty(o.bymonth) || !isEmpty(o.bymonthday)) return null;
  if (!isEmpty(o.bynmonthday) || !isEmpty(o.byyearday) || !isEmpty(o.byweekno) || !isEmpty(o.bynweekday)) return null;
  if (o.byhour?.length !== 1 || o.byminute?.length !== 1 || o.bysecond?.length !== 1) return null;
  const start = o.dtstart.getTime();
  const end = Math.min(toMs, o.until ? o.until.getTime() : Infinity);
  const time = ((o.byhour[0]! * 60 + o.byminute[0]!) * 60 + o.bysecond[0]!) * 1000;
  const weekdays = isEmpty(o.byweekday) ? null : new Set(o.byweekday);
  const interval = o.interval || 1;
  // Which period (day, or week starting on WKST) a day is in; the rule repeats every `interval` of them.
  const period = (day: number) => (daily ? day : Math.floor((day - ((weekdayOf(day) - o.wkst + 7) % 7)) / 7));
  const startDay = Math.floor(start / DAY_MS);
  const first = period(startDay);
  const out: Date[] = [];
  for (let day = Math.max(startDay, Math.floor(fromMs / DAY_MS)); day * DAY_MS <= end; day++) {
    if (weekdays && !weekdays.has(weekdayOf(day))) continue;
    if ((period(day) - first) % interval !== 0) continue;
    const t = day * DAY_MS + time;
    if (t >= start && t >= fromMs && t <= end) out.push(new Date(t));
  }
  return out;
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

/**
 * The rule cut short so the last occurrence is before `day` ("delete this and following"). Any
 * COUNT or UNTIL is replaced by an UNTIL at the end of the previous day, in the app's own format.
 */
export function endRuleBefore(rule: string, day: Date): string {
  const parts = rule
    .replace(/^RRULE:/i, '')
    .split(';')
    .filter((p) => p && !/^(UNTIL|COUNT)=/i.test(p));
  return [...parts, `UNTIL=${format(subDays(startOfDay(day), 1), 'yyyyMMdd')}T235959Z`].join(';');
}
