import { format } from 'date-fns';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import { notify } from '../utils/confirm';
import { exportTextFile } from './fileTransfer';
import { toICS } from './ical';

const fileSlug = (s: string): string =>
  s
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'calendar';

const today = () => format(new Date(), 'yyyy-MM-dd');

async function share(fileName: string, content: string, mimeType: string): Promise<boolean> {
  try {
    await exportTextFile(fileName, content, mimeType);
    return true;
  } catch (e) {
    notify('Export failed', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Shares the JSON backup file. */
export const shareBackup = (json: string): Promise<boolean> =>
  share(`opencal-backup-${today()}.json`, json, 'application/json');

/** Shares events as an .ics file named after `name` (a calendar name, or e.g. "OpenCal events"). */
export const shareICS = (
  name: string,
  events: Event[],
  calendarsById: Record<string, Calendar>,
  allDayTime: number,
  color?: string,
): Promise<boolean> =>
  share(`${fileSlug(name)}-${today()}.ics`, toICS(events, calendarsById, { name, color, allDayTime }), 'text/calendar');
