import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './taskHandler';

export function registerWidgets(): void {
  registerWidgetTaskHandler(widgetTaskHandler);
}
