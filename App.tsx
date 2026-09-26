import {
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo } from './src/components/Logo';
import { ToastProvider } from './src/components/Toast';
import { UpdateWatcher } from './src/components/UpdateWatcher';
import { CalendarProvider, useCalendarContext } from './src/context/CalendarContext';
import type { RootStackParamList } from './src/navigation/types';
import { BirthdayEditScreen } from './src/screens/BirthdayEditScreen';
import { BirthdaysScreen } from './src/screens/BirthdaysScreen';
import { CalendarDeleteScreen } from './src/screens/CalendarDeleteScreen';
import { CalendarEditScreen } from './src/screens/CalendarEditScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { CalendarsScreen } from './src/screens/CalendarsScreen';
import { EventEditScreen } from './src/screens/EventEditScreen';
import { ImportExportScreen } from './src/screens/ImportExportScreen';
import { HiddenEventsListScreen } from './src/screens/HiddenEventsListScreen';
import { FocusEditScreen } from './src/screens/FocusEditScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { QuickAddScreen } from './src/screens/QuickAddScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StampScreen } from './src/screens/StampScreen';
import { TemplateEditScreen } from './src/screens/TemplateEditScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { createStyles, fonts, ThemeProvider, useTheme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Keep the native launch screen up until fonts are loaded, then fade into the app.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

function RootNavigator() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { ready, error } = useCalendarContext();
  const [fontsLoaded, fontError] = useFonts({ Fraunces_500Medium_Italic, Fraunces_600SemiBold, Fraunces_800ExtraBold });
  const loading = !ready || (!fontsLoaded && !fontError);
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);
  if (loading) {
    // Same logo, size and paper colour as the native splash, so any handoff is seamless.
    return (
      <View style={styles.center}>
        <Logo size={180} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn’t open your calendar</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Calendars" component={CalendarsScreen} options={{ title: 'Calendars' }} />
      <Stack.Screen name="CalendarEdit" component={CalendarEditScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="CalendarDelete" component={CalendarDeleteScreen} options={{ title: 'Delete calendar' }} />
      <Stack.Screen name="Templates" component={TemplatesScreen} options={{ title: 'Stamps' }} />
      <Stack.Screen name="TemplateEdit" component={TemplateEditScreen} options={{ title: 'Stamp' }} />
      <Stack.Screen name="HiddenEvents" component={HiddenEventsListScreen} options={{ title: 'Event List' }} />
      <Stack.Screen name="Birthdays" component={BirthdaysScreen} options={{ title: 'Birthdays' }} />
      <Stack.Screen name="ImportExport" component={ImportExportScreen} options={{ title: 'Import & Export' }} />
      <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        <Stack.Screen name="EventEdit" component={EventEditScreen} options={{ title: 'Event' }} />
        <Stack.Screen name="QuickAdd" component={QuickAddScreen} options={{ title: 'Quick Add' }} />
        <Stack.Screen name="FocusEdit" component={FocusEditScreen} options={{ title: 'Quiet time' }} />
        <Stack.Screen name="Stamp" component={StampScreen} options={{ title: 'Add from Stamp' }} />
        <Stack.Screen name="BirthdayEdit" component={BirthdayEditScreen} options={{ title: 'Birthday' }} />
      </Stack.Group>
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CalendarProvider>
        <ThemedApp />
      </CalendarProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { themeMode } = useCalendarContext();
  return (
    <ThemeProvider mode={themeMode}>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { colors, scheme } = useTheme();
  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.bg,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [colors, scheme]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ToastProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
        <UpdateWatcher />
      </ToastProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg, gap: 8 },
  errorTitle: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
  errorText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
}));
