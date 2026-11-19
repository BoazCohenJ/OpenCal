/** Home-screen widgets are Android only (see homeScreen.android.ts); elsewhere these do nothing. */
export const widgetsSupported = false;

export async function refreshWidgets(): Promise<void> {}

export async function addWidgetToHomeScreen(_widgetName: string): Promise<boolean> {
  return false;
}

/** Ids of the placed widgets of one kind. */
export async function placedWidgetIds(_widgetName: string): Promise<number[]> {
  return [];
}

/** Redraws one widget, e.g. after its settings changed. */
export async function refreshWidget(_widgetName: string, _widgetId: number): Promise<void> {}
