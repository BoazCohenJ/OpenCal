/** Home-screen widgets are Android only (see homeScreen.android.ts); elsewhere these do nothing. */
export const widgetsSupported = false;

export async function refreshWidgets(): Promise<void> {}

export async function addWidgetToHomeScreen(_widgetName: string): Promise<boolean> {
  return false;
}
