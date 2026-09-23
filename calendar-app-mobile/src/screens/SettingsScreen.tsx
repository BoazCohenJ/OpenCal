import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Divider, Row, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { getNotificationStatus, requestNotificationPermission, type NotificationStatus } from '../services/notifications';
import { colors, spacing } from '../theme';
import { notify } from '../utils/confirm';

const STATUS_LABEL: Record<NotificationStatus, string> = {
  granted: 'On',
  denied: 'Blocked',
  undetermined: 'Tap to enable',
  unsupported: 'Not available',
};

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const { calendars, templates, events } = useCalendarContext();
  const [status, setStatus] = useState<NotificationStatus>('undetermined');

  useFocusEffect(
    useCallback(() => {
      void getNotificationStatus().then(setStatus);
    }, []),
  );

  const onNotifications = async () => {
    if (status === 'granted' || status === 'unsupported') return;
    const ok = await requestNotificationPermission();
    setStatus(await getNotificationStatus());
    if (!ok) notify('Notifications are blocked', 'Enable notifications for this app in your device settings to get reminders.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Organize">
        <Row label="Calendars" subtitle="Colors, pauses, create & delete" value={String(calendars.length)} onPress={() => navigation.navigate('Calendars')} />
        <Divider />
        <Row label="Stamps" subtitle="Reusable event templates" value={String(templates.length)} onPress={() => navigation.navigate('Templates')} />
        <Divider />
        <Row label="Event list" subtitle="Find and edit any event with filters" value={String(events.length)} onPress={() => navigation.navigate('HiddenEvents')} />
      </Section>
      <Section title="Reminders" footer="Reminders for the next 30 days are scheduled on this device.">
        <Row label="Notifications" value={STATUS_LABEL[status]} onPress={status === 'undetermined' || status === 'denied' ? onNotifications : undefined} />
      </Section>
      <Section title="About" footer="All data is stored locally on this device. Nothing is synced.">
        <Row label="Calendar 2.0" value="1.0.0" />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
});
