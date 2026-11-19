import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces/800ExtraBold';
import { useFonts } from 'expo-font';
import React, { useState } from 'react';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';
import { widgetChoices } from './data';
import { renderCalendarWidget } from './render';
import { WidgetSettingsForm } from './WidgetSettingsForm';

/**
 * Shown by Android when an OpenCal widget is added from the launcher's widget list (and, on Android
 * 12+, from the widget's long-press menu). It runs in its own window, outside the app's navigation
 * and data context.
 */
export function WidgetConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const [mode] = useState(() => widgetChoices().themeMode);
  useFonts({ Fraunces_500Medium_Italic, Fraunces_600SemiBold, Fraunces_800ExtraBold });
  return (
    <SafeAreaProvider>
      <ThemeProvider mode={mode}>
        <WidgetSettingsForm
          widgetName={widgetInfo.widgetName}
          widgetId={widgetInfo.widgetId}
          onCancel={() => setResult('cancel')}
          onSaved={() => {
            try {
              renderWidget(renderCalendarWidget(widgetInfo));
            } catch (error) {
              console.error('Widget failed to draw', error);
            }
            setResult('ok');
          }}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
