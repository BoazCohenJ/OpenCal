import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Logo } from '../components/Logo';
import { useSyncStatus } from '../components/SyncWatcher';
import { useToast } from '../components/Toast';
import { Divider, Row, Section, Segmented, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { notificationsSupported } from '../services/notifications';
import { getSyncConfig } from '../services/sync';
import { APP_VERSION, updateInfo } from '../services/appInfo';
import { createStyles, spacing, type ThemeMode } from '../theme';
import { deviceTimeZone } from '../utils/dates';
import { addWidgetToHomeScreen, widgetsSupported } from '../widgets/homeScreen';

const WIDGETS = [
  { name: 'Schedule', label: 'Schedule', subtitle: 'The next two weeks, day by day' },
  { name: 'Day', label: 'Today', subtitle: 'Today’s events with their times' },
  { name: 'Week', label: 'Week', subtitle: 'A column per day' },
  { name: 'Month', label: 'Month', subtitle: 'The month grid' },
];

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const styles = useStyles();
  const showToast = useToast();
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
    defaultEventMinutes,
    setDefaultEventMinutes,
    colorRules,
  } = useCalendarContext();
  const timeZone = deviceTimeZone()?.replace(/_/g, ' ');
  const syncStatus = useSyncStatus();
  // Read on every render; connecting or disconnecting updates the sync status, which re-renders this.
  const syncing = !!getSyncConfig();

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
        <Row label="Color rules" subtitle="Color events by a word in their title" value={String(colorRules.length)} onPress={() => navigation.navigate('ColorRules')} />
        <Divider />
        <Row label="Event list" subtitle="Find and edit any event with filters" value={String(events.length)} onPress={() => navigation.navigate('HiddenEvents')} />
      </Section>
      <Section title="New events" footer="In minutes (5 to 1440): how long a new event lasts when you tap an empty time or press New event. You can still drag its ends to change it.">
        <MinutesRow label="Default length" value={defaultEventMinutes} onChange={setDefaultEventMinutes} />
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
        <Row
          label="Sync"
          subtitle="More devices, through your own server"
          value={!syncing ? 'Off' : syncStatus.error ? 'Error' : 'On'}
          onPress={() => navigation.navigate('Sync')}
        />
        <Divider />
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
      {widgetsSupported ? (
        <Section title="Home-screen widgets" footer="You can also add them from your home screen: long-press an empty spot, then Widgets → OpenCal.">
          {WIDGETS.map((w, i) => (
            <React.Fragment key={w.name}>
              {i ? <Divider /> : null}
              <Row
                label={w.label}
                subtitle={w.subtitle}
                value="Add"
                onPress={() =>
                  void addWidgetToHomeScreen(w.name).then((asked) => {
                    if (!asked) showToast({ message: 'Your home screen can’t add widgets from here. Long-press it, then Widgets → OpenCal.' });
                  })
                }
              />
            </React.Fragment>
          ))}
        </Section>
      ) : null}
      <Section title="Reminders">
        <Row
          label="Notifications"
          subtitle="Sound, quiet hours, defaults, per-calendar"
          value={notificationSummary}
          onPress={() => navigation.navigate('Notifications')}
        />
      </Section>
      <Section
        title="About"
        footer={
          syncing
            ? 'Your data is stored on this device and synced only with your own server.'
            : 'All data is stored locally on this device. Nothing is synced.'
        }
      >
        <Row label="OpenCal" value={APP_VERSION} subtitle={updateInfo()} left={<Logo size={34} variant="tile" />} />
      </Section>
    </ScrollView>
  );
}

/** A label with a minutes box. Saves on blur or Enter; anything outside 5–1440 snaps back to the saved value. */
function MinutesRow({ label, value, onChange }: { label: string; value: number; onChange: (minutes: number) => void }) {
  const styles = useStyles();
  const [text, setText] = useState(String(value));
  const commit = () => {
    const minutes = Number.parseInt(text, 10);
    if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440) {
      onChange(minutes);
      setText(String(minutes));
    } else setText(String(value));
  };
  return (
    <View style={styles.minutesRow}>
      <Text style={styles.minutesLabel}>{label}</Text>
      <TextField
        value={text}
        onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={4}
        selectTextOnFocus
        style={styles.minutesInput}
        accessibilityLabel={`${label} in minutes`}
      />
      <Text style={styles.minutesUnit}>min</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  segment: { padding: spacing.md },
  minutesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  minutesLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  minutesInput: { width: 76, textAlign: 'right', paddingVertical: 8 },
  minutesUnit: { fontSize: 15, color: colors.textMuted },
}));
