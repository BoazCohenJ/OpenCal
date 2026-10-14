import { useEffect, useRef } from 'react';
import { useCalendarContext } from '../context/CalendarContext';
import { setLiveWidgetSource } from './data';
import { refreshWidgets } from './homeScreen';

/** Wait for a burst of edits (or a sync) to settle before redrawing. */
const DEBOUNCE_MS = 1000;
/** At launch the widgets already show this data, so only catch up (e.g. a new day) once the app has settled. */
const LAUNCH_DELAY_MS = 5000;

/**
 * Keeps home-screen widgets in step with the app: redraws them shortly after anything they show
 * changes. Android also redraws them every 30 minutes, which rolls "today" over. While the app is
 * running, widgets draw from its data (and the repeats it has already worked out) instead of
 * re-reading the database.
 */
export function WidgetWatcher() {
  const { events, calendars, visibleCalendarIds, birthdays, colorRules, themeMode, getOccurrences } = useCalendarContext();
  useEffect(() => {
    setLiveWidgetSource({ occurrences: getOccurrences, themeMode });
  }, [getOccurrences, themeMode]);
  useEffect(() => () => setLiveWidgetSource(null), []);

  const launched = useRef(false);
  useEffect(() => {
    const delay = launched.current ? DEBOUNCE_MS : LAUNCH_DELAY_MS;
    launched.current = true;
    const id = setTimeout(() => void refreshWidgets(), delay);
    return () => clearTimeout(id);
  }, [events, calendars, visibleCalendarIds, birthdays, colorRules, themeMode]);
  return null;
}
