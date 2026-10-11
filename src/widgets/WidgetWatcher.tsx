import { useEffect } from 'react';
import { useCalendarContext } from '../context/CalendarContext';
import { refreshWidgets } from './homeScreen';

/** Wait for a burst of edits (or a sync) to settle before redrawing. */
const DEBOUNCE_MS = 1000;

/**
 * Keeps home-screen widgets in step with the app: redraws them shortly after anything they show
 * changes. Android also redraws them every 30 minutes, which rolls "today" over.
 */
export function WidgetWatcher() {
  const { events, calendars, visibleCalendarIds, birthdays, colorRules, themeMode } = useCalendarContext();
  useEffect(() => {
    const id = setTimeout(() => void refreshWidgets(), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [events, calendars, visibleCalendarIds, birthdays, colorRules, themeMode]);
  return null;
}
