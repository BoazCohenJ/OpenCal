import { addDays, addMonths, addWeeks, differenceInCalendarWeeks, endOfMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import React from 'react';
import type { WidgetInfo, WidgetRepresentation } from 'react-native-android-widget';
import type { ColorScheme } from '../theme';
import { WEEK_STARTS_ON } from '../utils/dates';
import { DayWidget, MonthWidget, SCHEDULE_DAYS, ScheduleWidget, WeekWidget } from './CalendarWidgets';
import { getWidgetPage, loadOccurrences, loadThemeMode } from './data';
import { widgetColors } from './look';

/** Widget names as declared in app.json (react-native-android-widget → widgets). */
export const WIDGET_NAMES = ['Schedule', 'Day', 'Week', 'Month'] as const;

/** Draws one widget from the database: light and dark versions when the app follows the system theme. */
export function renderCalendarWidget(info: WidgetInfo): WidgetRepresentation {
  const now = new Date();
  const today = startOfDay(now);
  const size = { now, width: info.width, height: info.height };
  let draw: (scheme: ColorScheme) => React.JSX.Element;
  switch (info.widgetName) {
    case 'Day': {
      const occurrences = loadOccurrences(today, addDays(today, 1));
      draw = (scheme) => <DayWidget c={widgetColors(scheme)} occurrences={occurrences} {...size} />;
      break;
    }
    case 'Week': {
      const page = getWidgetPage(info.widgetId);
      const weekStart = startOfWeek(addWeeks(today, page), { weekStartsOn: WEEK_STARTS_ON });
      const occurrences = loadOccurrences(weekStart, addDays(weekStart, 7));
      draw = (scheme) => <WeekWidget c={widgetColors(scheme)} occurrences={occurrences} weekStart={weekStart} page={page} {...size} />;
      break;
    }
    case 'Month': {
      const page = getWidgetPage(info.widgetId);
      const month = startOfMonth(addMonths(today, page));
      const gridStart = startOfWeek(month, { weekStartsOn: WEEK_STARTS_ON });
      const weeks = differenceInCalendarWeeks(endOfMonth(month), gridStart, { weekStartsOn: WEEK_STARTS_ON }) + 1;
      const occurrences = loadOccurrences(gridStart, addDays(gridStart, weeks * 7));
      draw = (scheme) => (
        <MonthWidget c={widgetColors(scheme)} occurrences={occurrences} month={month} gridStart={gridStart} weeks={weeks} page={page} {...size} />
      );
      break;
    }
    default: {
      const occurrences = loadOccurrences(today, addDays(today, SCHEDULE_DAYS));
      draw = (scheme) => <ScheduleWidget c={widgetColors(scheme)} occurrences={occurrences} {...size} />;
    }
  }
  const mode = loadThemeMode();
  return mode === 'system' ? { light: draw('light'), dark: draw('dark') } : draw(mode);
}
