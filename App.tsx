import {
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { DarkTheme, DefaultTheme, NavigationContainer, type LinkingOptions, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { Linking, Platform, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo } from './src/components/Logo';
import { SyncWatcher } from './src/components/SyncWatcher';
import { ToastProvider } from './src/components/Toast';
import { UpdateWatcher } from './src/components/UpdateWatcher';
import { CalendarProvider, useCalendarContext } from './src/context/CalendarContext';
import type { RootStackParamList } from './src/navigation/types';
import { BirthdayEditScreen } from './src/screens/BirthdayEditScreen';
import { BirthdaysScreen } from './src/screens/BirthdaysScreen';
import { ColorRulesScreen } from './src/screens/ColorRulesScreen';
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
import { SyncScreen } from './src/screens/SyncScreen';
import { TemplateEditScreen } from './src/screens/TemplateEditScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { createStyles, fonts, ThemeProvider, useTheme } from './src/theme';
import { WidgetWatcher } from './src/widgets/WidgetWatcher';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** How long the first screen waits for the link the app was opened with (a widget's view and date). */
const LINK_WAIT_MS = 600;

let launchLink: Promise<string | null> | undefined;
/** getInitialURL stopped waiting before the link was read; it's delivered through subscribe instead. */
let linkLate = false;

/**
 * The link the app was opened with. Android can take a while to hand it over (seconds when a widget
 * update had already started the app in the background), longer than React Navigation's default
 * 150 ms wait, and then a widget opened the default view instead of the one it links to.
 */
function getInitialURL(): Promise<string | null> {
  launchLink ??= Linking.getInitialURL().catch(() => null);
  const link = launchLink;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      linkLate = true;
      resolve(null);
    }, LINK_WAIT_MS);
    void link.then((url) => {
      if (linkLate) return;
      clearTimeout(timer);
      resolve(url);
    });
  });
}

/** Links that arrive while the app is open, plus a launch link that came too late for getInitialURL. */
function subscribe(listener: (url: string) => void): () => void {
  const sub = Linking.addEventListener('url', ({ url }) => listener(url));
  let open = true;
  void launchLink?.then((url) => {
    if (!open || !linkLate || !url) return;
    linkLate = false;
    listener(url);
  });
  return () => {
    open = false;
    sub.remove();
  };
}

/**
 * Links home-screen widgets open (see src/widgets/look.ts). The calendar stays underneath anything opened.
 * Not used on web, where it would put screens in the address bar of a static site that can't serve them.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['opencal://'],
  getInitialURL,
  subscribe,
  config: {
    initialRouteName: 'Calendar',
    screens: {
      Calendar: 'calendar',
      EventEdit: 'event/:eventId',
      BirthdayEdit: 'birthday/:birthdayId',
      QuickAdd: 'quick-add',
    },
  },
};

// Keep the native launch screen up until fonts are loaded, then fade into the app.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

/**
 * Forms and settings are phone-width layouts: on a wide browser window keep each in a centred,
 * readable column. Wrapped once at module level so the screen components stay stable between renders.
 */
function narrow<P extends object>(Screen: React.ComponentType<P>): React.ComponentType<P> {
  if (Platform.OS !== 'web') return Screen;
  const Narrow = (props: P) => (
    <View style={{ flex: 1, width: '100%', maxWidth: WEB_COLUMN, alignSelf: 'center' }}>
      <Screen {...props} />
    </View>
  );
  return Narrow;
}

const narrowed = {
  SettingsScreen: narrow(SettingsScreen),
  NotificationsScreen: narrow(NotificationsScreen),
  CalendarsScreen: narrow(CalendarsScreen),
  CalendarEditScreen: narrow(CalendarEditScreen),
  CalendarDeleteScreen: narrow(CalendarDeleteScreen),
  TemplatesScreen: narrow(TemplatesScreen),
  TemplateEditScreen: narrow(TemplateEditScreen),
  HiddenEventsListScreen: narrow(HiddenEventsListScreen),
  BirthdaysScreen: narrow(BirthdaysScreen),
  ColorRulesScreen: narrow(ColorRulesScreen),
  ImportExportScreen: narrow(ImportExportScreen),
  SyncScreen: narrow(SyncScreen),
  EventEditScreen: narrow(EventEditScreen),
  QuickAddScreen: narrow(QuickAddScreen),
  FocusEditScreen: narrow(FocusEditScreen),
  StampScreen: narrow(StampScreen),
  BirthdayEditScreen: narrow(BirthdayEditScreen),
};

/** Width of the centred column non-calendar screens use on web (see `narrow`). */
const WEB_COLUMN = 720;

function RootNavigator() {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  // Line the header buttons up with the column below them instead of the window edges.
  const headerInset = Platform.OS === 'web' ? Math.max(0, (width - WEB_COLUMN) / 2) : 0;
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
        headerLeftContainerStyle: { paddingLeft: headerInset },
        headerRightContainerStyle: { paddingRight: headerInset },
        animation: 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={narrowed.SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Notifications" component={narrowed.NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Calendars" component={narrowed.CalendarsScreen} options={{ title: 'Calendars' }} />
      <Stack.Screen name="CalendarEdit" component={narrowed.CalendarEditScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="CalendarDelete" component={narrowed.CalendarDeleteScreen} options={{ title: 'Delete calendar' }} />
      <Stack.Screen name="Templates" component={narrowed.TemplatesScreen} options={{ title: 'Stamps' }} />
      <Stack.Screen name="TemplateEdit" component={narrowed.TemplateEditScreen} options={{ title: 'Stamp' }} />
      <Stack.Screen name="HiddenEvents" component={narrowed.HiddenEventsListScreen} options={{ title: 'Event List' }} />
      <Stack.Screen name="Birthdays" component={narrowed.BirthdaysScreen} options={{ title: 'Birthdays' }} />
      <Stack.Screen name="ColorRules" component={narrowed.ColorRulesScreen} options={{ title: 'Color rules' }} />
      <Stack.Screen name="ImportExport" component={narrowed.ImportExportScreen} options={{ title: 'Import & Export' }} />
      <Stack.Screen name="Sync" component={narrowed.SyncScreen} options={{ title: 'Sync' }} />
      <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        <Stack.Screen name="EventEdit" component={narrowed.EventEditScreen} options={{ title: 'Event' }} />
        <Stack.Screen name="QuickAdd" component={narrowed.QuickAddScreen} options={{ title: 'Quick Add' }} />
        <Stack.Screen name="FocusEdit" component={narrowed.FocusEditScreen} options={{ title: 'Quiet time' }} />
        <Stack.Screen name="Stamp" component={narrowed.StampScreen} options={{ title: 'Add from Stamp' }} />
        <Stack.Screen name="BirthdayEdit" component={narrowed.BirthdayEditScreen} options={{ title: 'Birthday' }} />
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
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Text fields draw their own focus state; drop the browser's default outline.
    const style = document.createElement('style');
    style.textContent = 'input, textarea { outline: none; }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ToastProvider>
        <NavigationContainer theme={navigationTheme} linking={Platform.OS === 'web' ? undefined : linking}>
          <RootNavigator />
        </NavigationContainer>
        <UpdateWatcher />
        <SyncWatcher />
        <WidgetWatcher />
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
