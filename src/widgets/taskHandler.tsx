import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getWidgetPage, setWidgetPage } from './data';
import { renderCalendarWidget } from './render';

/** Runs in the background whenever Android asks a widget to draw, or one of its buttons is tapped. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') {
    setWidgetPage(widgetInfo.widgetId, null);
    return;
  }
  if (widgetAction === 'WIDGET_CLICK') {
    // Week and Month page through time in place; every other tap opens the app by itself.
    const page = getWidgetPage(widgetInfo.widgetId);
    if (clickAction === 'PREV') setWidgetPage(widgetInfo.widgetId, page - 1);
    else if (clickAction === 'NEXT') setWidgetPage(widgetInfo.widgetId, page + 1);
    else if (clickAction === 'TODAY') setWidgetPage(widgetInfo.widgetId, 0);
    else return;
  }
  try {
    renderWidget(renderCalendarWidget(widgetInfo));
  } catch (error) {
    console.error('Widget failed to draw', error);
  }
}
