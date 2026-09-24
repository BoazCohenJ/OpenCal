import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Divider, Row, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { notificationsSupported } from '../services/notifications';
import { colors, spacing } from '../theme';

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const { calendars, templates, events, notificationPrefs, reminderStatus } = useCalendarContext();

  const notificationSummary = !notificationsSupported
    ? 'Mobile only'
    : !notificationPrefs.enabled
      ? 'Paused'
      : reminderStatus?.status === 'denied'
        ? 'Blocked'
        : reminderStatus?.status === 'granted'
          ? 'On'
          : 'Set up';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Organize">
        <Row label="Calendars" subtitle="Colors, pauses, create & delete" value={String(calendars.length)} onPress={() => navigation.navigate('Calendars')} />
        <Divider />
        <Row label="Stamps" subtitle="Reusable event templates" value={String(templates.length)} onPress={() => navigation.navigate('Templates')} />
        <Divider />
        <Row label="Event list" subtitle="Find and edit any event with filters" value={String(events.length)} onPress={() => navigation.navigate('HiddenEvents')} />
      </Section>
      <Section title="Reminders">
        <Row
          label="Notifications"
          subtitle="Sound, quiet hours, defaults, per-calendar"
          value={notificationSummary}
          onPress={() => navigation.navigate('Notifications')}
        />
      </Section>
      <Section title="About" footer="All data is stored locally on this device. Nothing is synced.">
        <Row label="OpenCal" value="1.0.0" />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
});
