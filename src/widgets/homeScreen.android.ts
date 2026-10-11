import { requestPinWidget, requestWidgetUpdate } from 'react-native-android-widget';
import { renderCalendarWidget, WIDGET_NAMES } from './render';

export const widgetsSupported = true;

/** Redraws every OpenCal widget on the home screen, e.g. after an edit in the app. */
export async function refreshWidgets(): Promise<void> {
  await Promise.all(
    WIDGET_NAMES.map((widgetName) =>
      requestWidgetUpdate({ widgetName, renderWidget: renderCalendarWidget }).catch((error: unknown) =>
        console.warn(`Couldn't update the ${widgetName} widget`, error),
      ),
    ),
  );
}

/** Asks the launcher to place a widget; false when it can't (then it's added from the launcher's widget list). */
export async function addWidgetToHomeScreen(widgetName: string): Promise<boolean> {
  try {
    return await requestPinWidget({ widgetName });
  } catch {
    return false;
  }
}
