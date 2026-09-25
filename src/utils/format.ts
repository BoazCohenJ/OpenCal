export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Offset only, e.g. "1 hour 30 minutes", "2 days", "At start". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'At start';
  if (minutes % 10080 === 0) return plural(minutes / 10080, 'week');
  if (minutes % 1440 === 0) return plural(minutes / 1440, 'day');
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && plural(d, 'day'), h && plural(h, 'hour'), m && plural(m, 'minute')].filter(Boolean).join(' ');
}

/** Short offset for chips, e.g. "10m", "1h 30m", "2d". */
export function formatOffsetShort(minutes: number): string {
  if (minutes === 0) return 'At start';
  if (minutes % 10080 === 0) return `${minutes / 10080}w`;
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

export function formatReminder(minutes: number): string {
  return minutes === 0 ? 'At start' : `${formatOffset(minutes)} before`;
}

/**
 * All-day reminders count back from a time of day (e.g. 9:00 AM on the event day), so describe the
 * resulting day and time: "On the day at 9:00 AM", "1 day before at 7:30 AM".
 */
export function formatAllDayReminder(minutes: number, allDayTime: number): string {
  const at = allDayTime - minutes;
  const daysBefore = Math.ceil(-at / 1440);
  const minuteOfDay = ((at % 1440) + 1440) % 1440;
  const h = Math.floor(minuteOfDay / 60);
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(minuteOfDay % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  if (daysBefore <= 0) return `On the day at ${time}`;
  return `${plural(daysBefore, 'day')} before at ${time}`;
}

/** Title with a legacy emoji prefix. SVG icons (`icon:<key>`) are rendered separately via EventGlyph. */
export const eventLabel = (e: { title: string; emoji?: string }): string =>
  e.emoji && !e.emoji.startsWith('icon:') ? `${e.emoji} ${e.title}` : e.title;

export const formatDelta = (minutes: number): string =>
  `${minutes > 0 ? '+' : '−'}${formatDuration(Math.abs(minutes))}`;
