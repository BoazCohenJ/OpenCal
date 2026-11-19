import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './taskHandler';
import { WidgetConfigScreen } from './WidgetConfigScreen';

export function registerWidgets(): void {
  registerWidgetTaskHandler(widgetTaskHandler);
  // Asked for by Android when a widget is added (app.json → widgets → widgetFeatures).
  registerWidgetConfigurationScreen(WidgetConfigScreen);
}
