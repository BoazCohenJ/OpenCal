import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { Logo } from '../components/Logo';
import { CalendarSelector } from '../components/Selectors';
import { useSyncStatus } from '../components/SyncWatcher';
import { useToast } from '../components/Toast';
import { Divider, InfoButton, InfoCard, PressableScale, Row, Section, Segmented, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { notificationsSupported } from '../services/notifications';
import { getSyncConfig } from '../services/sync';
import { APP_VERSION, updateInfo } from '../services/appInfo';
import { createStyles, radius, spacing, useTheme, type ThemeMode } from '../theme';
import { deviceTimeZone } from '../utils/dates';
import { addWidgetToHomeScreen, widgetsSupported } from '../widgets/homeScreen';

const WIDGETS: { name: string; label: string; icon: IconName }[] = [
  { name: 'Schedule', label: 'Schedule', icon: 'view-schedule' },
  { name: 'Day', label: 'Today', icon: 'view-day' },
  { name: 'Week', label: 'Week', icon: 'view-week' },
  { name: 'Month', label: 'Month', icon: 'view-month' },
];

const WIDGET_GAP = spacing.sm;

type InfoKey = 'length' | 'floating';
const LENGTH_INFO =
  'In minutes (5 to 1440): how long a new event lasts when you tap an empty time or press New event. You can still drag its ends to change it. New events go to the default calendar unless you pick another.';
const FLOATING_INFO =
  'Floating events keep their clock time in any time zone: a 9:00 run stays at 9:00 when you travel. Fixed events keep the same moment: a 14:00 call at home shows at its local time abroad. You can change this on each event; all-day events always float.';

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const showToast = useToast();
  const [gridWidth, setGridWidth] = useState(0);
  // Four squares across: the grid's width minus its padding and the gaps between them.
  const tile = Math.max(0, Math.floor((gridWidth - WIDGET_GAP * (WIDGETS.length + 1)) / WIDGETS.length));
  const [openInfo, setOpenInfo] = useState<InfoKey | null>(null);
  // Which card was open when the current touch began, so tapping the (i) of an open card closes it
  // instead of closing and reopening it.
  const infoWasOpen = useRef<InfoKey | null>(null);
  const closeInfoOnTouch = () => {
    infoWasOpen.current = openInfo;
    if (openInfo) setOpenInfo(null);
  };
  const infoFor = (key: InfoKey, text: string) => ({
    text,
    open: openInfo === key,
    onToggle: () => setOpenInfo(infoWasOpen.current === key ? null : key),
  });
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
    defaultCalendarId,
    setDefaultCalendarId,
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
    // Any touch closes the info card without claiming the gesture, so a scroll can still start.
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} onTouchStart={closeInfoOnTouch}>
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
      <Section title="New events">
        <MinutesRow
          label="Default length"
          value={defaultEventMinutes}
          onChange={setDefaultEventMinutes}
          info={infoFor('length', LENGTH_INFO)}
        />
        <Divider />
        <View style={styles.calendarPick}>
          <Text style={styles.minutesLabel}>Default calendar</Text>
        </View>
        <CalendarSelector calendars={calendars} value={defaultCalendarId} onChange={setDefaultCalendarId} />
      </Section>
      <Section title="Time zone" allowOverflow style={{ zIndex: 3 }}>
        <SwitchRow
          label="Floating time for new events"
          subtitle={floatingByDefault ? 'New events stay at the same clock time' : 'New events stay at the same moment'}
          value={floatingByDefault}
          onValueChange={setFloatingByDefault}
          info={infoFor('floating', `${timeZone ? `This phone is set to ${timeZone}. ` : ''}${FLOATING_INFO}`)}
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
          <View style={styles.widgetGrid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {WIDGETS.map((w) => (
              <PressableScale
                key={w.name}
                style={[styles.widgetTile, { width: tile, height: tile }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${w.label} widget`}
                onPress={() =>
                  void addWidgetToHomeScreen(w.name).then((asked) => {
                    if (!asked) showToast({ message: 'Your home screen can’t add widgets from here. Long-press it, then Widgets → OpenCal.' });
                  })
                }
              >
                <Icon name={w.icon} size={28} color={colors.primary} />
                <Text style={styles.widgetLabel}>{w.label}</Text>
              </PressableScale>
            ))}
          </View>
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
            : 'Your data is stored on this device. It only leaves it if you connect your own server under Sync.'
        }
      >
        <Row label="OpenCal" value={APP_VERSION} subtitle={updateInfo()} left={<Logo size={34} variant="tile" />} />
      </Section>
    </ScrollView>
  );
}

/** A label with a minutes box. Saves on blur or Enter; anything outside 5–1440 snaps back to the saved value. */
function MinutesRow({
  label,
  value,
  onChange,
  info,
}: {
  label: string;
  value: number;
  onChange: (minutes: number) => void;
  info: { text: string; open: boolean; onToggle: () => void };
}) {
  const styles = useStyles();
  const [rowHeight, setRowHeight] = useState(0);
  const [text, setText] = useState(String(value));
  const commit = () => {
    const minutes = Number.parseInt(text, 10);
    if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440) {
      onChange(minutes);
      setText(String(minutes));
    } else setText(String(value));
  };
  return (
    <View style={styles.minutesRow} onLayout={(e) => setRowHeight(e.nativeEvent.layout.height)}>
      <View style={styles.minutesLabelGroup}>
        <Text style={styles.minutesLabelText}>{label}</Text>
        <InfoButton label={label} open={info.open} onPress={info.onToggle} />
      </View>
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
      {info.open ? <InfoCard text={info.text} top={rowHeight} /> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  segment: { padding: spacing.md },
  widgetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: WIDGET_GAP, padding: WIDGET_GAP },
  widgetTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  widgetLabel: { fontSize: 13, fontWeight: '500', color: colors.text },
  minutesRow: { zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  minutesLabelGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  minutesLabelText: { fontSize: 16, fontWeight: '500', color: colors.text },
  minutesLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  minutesInput: { width: 76, textAlign: 'right', paddingVertical: 8 },
  calendarPick: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  minutesUnit: { fontSize: 15, color: colors.textMuted },
}));
