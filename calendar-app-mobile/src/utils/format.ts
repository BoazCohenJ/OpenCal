export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatReminder(minutes: number): string {
  if (minutes === 0) return 'At start';
  const unit = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''} before`;
  if (minutes % 10080 === 0) return unit(minutes / 10080, 'week');
  if (minutes % 1440 === 0) return unit(minutes / 1440, 'day');
  if (minutes % 60 === 0) return unit(minutes / 60, 'hour');
  return `${minutes} min before`;
}

export const eventLabel = (e: { title: string; emoji?: string }): string =>
  e.emoji ? `${e.emoji} ${e.title}` : e.title;

export const formatDelta = (minutes: number): string =>
  `${minutes > 0 ? '+' : '−'}${formatDuration(Math.abs(minutes))}`;
