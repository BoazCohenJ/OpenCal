import React from 'react';
import type { ScreenProps } from '../navigation/types';
import { refreshWidget } from '../widgets/homeScreen';
import { WidgetSettingsForm } from '../widgets/WidgetSettingsForm';

/**
 * A widget's settings inside the app. Android only opens its own settings window for widgets added
 * from the launcher, so Settings opens this one after placing a widget, and for widgets already placed.
 */
export function WidgetSettingsScreen({ navigation, route }: ScreenProps<'WidgetSettings'>) {
  const { widgetName, widgetId } = route.params;
  return (
    <WidgetSettingsForm
      embedded
      widgetName={widgetName}
      widgetId={widgetId}
      onCancel={() => navigation.goBack()}
      onSaved={() => {
        void refreshWidget(widgetName, widgetId);
        navigation.goBack();
      }}
    />
  );
}
