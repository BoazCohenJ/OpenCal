import React from 'react';
import { ScrollView, View } from 'react-native';
import { Logo } from '../components/Logo';
import { Divider, Row, Section, Segmented, SwitchRow } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { notificationsSupported } from '../services/notifications';
import { APP_VERSION, updateInfo } from '../services/appInfo';
import { createStyles, spacing, type ThemeMode } from '../theme';
import { deviceTimeZone } from '../utils/dates';

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const styles = useStyles();
  const {
    calendars,
    templates,
    events,
    birthdays,
    notificationPrefs,
    reminderStatus,
    themeMode,
    setThemeMode,
    floatingByDefault,
    setFloatingByDefault,
  } = useCalendarContext();
  const timeZone = deviceTimeZone()?.replace(/_/g, ' ');

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
        <Row label="Birthdays" subtitle="Yearly birthdays with ages" value={String(birthdays.length)} onPress={() => navigation.navigate('Birthdays')} />
        <Divider />
        <Row label="Event list" subtitle="Find and edit any event with filters" value={String(events.length)} onPress={() => navigation.navigate('HiddenEvents')} />
      </Section>
      <Section
        title="Time zone"
        footer={`${timeZone ? `This phone is set to ${timeZone}. ` : ''}Floating events keep their clock time in any time zone: a 9:00 run stays at 9:00 when you travel. Fixed events keep the same moment: a 14:00 call at home shows at its local time abroad. You can change this on each event; all-day events always float.`}
      >
        <SwitchRow
          label="Floating time for new events"
          subtitle={floatingByDefault ? 'New events stay at the same clock time' : 'New events stay at the same moment'}
          value={floatingByDefault}
          onValueChange={setFloatingByDefault}
        />
      </Section>
      <Section title="Data">
        <Row label="Import & export" subtitle="Backups and calendar files (.ics)" onPress={() => navigation.navigate('ImportExport')} />
      </Section>
      <Section title="Appearance">
        <View style={styles.segment}>
          <Segmented<ThemeMode>
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={themeMode}
            onChange={setThemeMode}
          />
        </View>
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
        <Row label="OpenCal" value={APP_VERSION} subtitle={updateInfo()} left={<Logo size={34} variant="tile" />} />
      </Section>
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  segment: { padding: spacing.md },
}));
