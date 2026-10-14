import { requestPinWidget, requestWidgetUpdate, type WidgetInfo } from 'react-native-android-widget';
import { renderCalendarWidget, WIDGET_NAMES } from './render';

export const widgetsSupported = true;

let turn: Promise<unknown> = Promise.resolve();

/**
 * Draws widgets one at a time, each in its own task after the previous one, so taps and frames
 * get handled in between instead of waiting for every widget on the home screen.
 */
function renderInTurn(info: WidgetInfo) {
  const run = turn.then(() => new Promise((resolve) => setTimeout(resolve, 0))).then(() => renderCalendarWidget(info));
  turn = run.catch(() => undefined);
  return run;
}

/** Redraws every OpenCal widget on the home screen, e.g. after an edit in the app. */
export async function refreshWidgets(): Promise<void> {
  await Promise.all(
    WIDGET_NAMES.map((widgetName) =>
      requestWidgetUpdate({ widgetName, renderWidget: renderInTurn }).catch((error: unknown) =>
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
