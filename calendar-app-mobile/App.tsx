import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CalendarProvider, useCalendarContext } from './src/context/CalendarContext';
import type { RootStackParamList } from './src/navigation/types';
import { CalendarEditScreen } from './src/screens/CalendarEditScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { CalendarsScreen } from './src/screens/CalendarsScreen';
import { EventEditScreen } from './src/screens/EventEditScreen';
import { HiddenEventsListScreen } from './src/screens/HiddenEventsListScreen';
import { QuickAddScreen } from './src/screens/QuickAddScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StampScreen } from './src/screens/StampScreen';
import { TemplateEditScreen } from './src/screens/TemplateEditScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
};

function RootNavigator() {
  const { ready, error } = useCalendarContext();
  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
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
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Calendars" component={CalendarsScreen} options={{ title: 'Calendars' }} />
      <Stack.Screen name="CalendarEdit" component={CalendarEditScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="Templates" component={TemplatesScreen} options={{ title: 'Stamps' }} />
      <Stack.Screen name="TemplateEdit" component={TemplateEditScreen} options={{ title: 'Stamp' }} />
      <Stack.Screen name="HiddenEvents" component={HiddenEventsListScreen} options={{ title: 'Event List' }} />
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="EventEdit" component={EventEditScreen} options={{ title: 'Event' }} />
        <Stack.Screen name="QuickAdd" component={QuickAddScreen} options={{ title: 'Quick Add' }} />
        <Stack.Screen name="Stamp" component={StampScreen} options={{ title: 'Add from Stamp' }} />
      </Stack.Group>
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CalendarProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="dark" />
      </CalendarProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg, gap: 8 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  errorText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
