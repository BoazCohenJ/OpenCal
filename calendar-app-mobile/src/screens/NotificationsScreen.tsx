import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { ReminderPicker } from '../components/Selectors';
import { Sheet } from '../components/Sheet';
import { TimePicker } from '../components/DateTimeField';
import { Button, ColorDot, Divider, Row, Section, Segmented, SwitchRow } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { notificationsSupported, planReminders, sendTestNotification } from '../services/notifications';
import { colors, fonts, radius, spacing } from '../theme';
import { notify } from '../utils/confirm';
import { formatTime } from '../utils/dates';

const HORIZONS = ['7', '14', '30', '60'] as const;

const timeOfDay = (minutes: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};
const formatMinutes = (minutes: number) => formatTime(timeOfDay(minutes));

type TimeField = 'quietStart' | 'quietEnd' | 'allDayTime';
const TIME_FIELD_TITLE: Record<TimeField, string> = {
  quietStart: 'Quiet hours start',
  quietEnd: 'Quiet hours end',
  allDayTime: 'All-day reminder time',
};

export function NotificationsScreen(_: ScreenProps<'Notifications'>) {
  const { notificationPrefs: prefs, updateNotificationPrefs, reminderStatus, refreshReminders, calendars, events, calendarsById } =
    useCalendarContext();
  const [editing, setEditing] = useState<TimeField | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshReminders();
    }, [refreshReminders]),
  );

  const upcoming = useMemo(() => planReminders(events, calendarsById, prefs), [events, calendarsById, prefs]);
  const status = reminderStatus?.status ?? (notificationsSupported ? 'undetermined' : 'unsupported');

  const editingMinutes =
    editing === 'quietStart' ? prefs.quietHours.start : editing === 'quietEnd' ? prefs.quietHours.end : prefs.allDayTime;
  const setEditingMinutes = (d: Date) => {
    const m = d.getHours() * 60 + d.getMinutes();
    if (editing === 'quietStart') updateNotificationPrefs({ quietHours: { ...prefs.quietHours, start: m } });
    else if (editing === 'quietEnd') updateNotificationPrefs({ quietHours: { ...prefs.quietHours, end: m } });
    else if (editing === 'allDayTime') updateNotificationPrefs({ allDayTime: m });
  };

  const toggleMuted = (id: string, on: boolean) =>
    updateNotificationPrefs({
      mutedCalendarIds: on ? prefs.mutedCalendarIds.filter((x) => x !== id) : [...prefs.mutedCalendarIds, id],
    });

  const test = async () => {
    const ok = await sendTestNotification(prefs);
    if (!ok) notify('Notifications are blocked', 'Allow notifications for OpenCal in your device settings, then try again.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusCard
        status={status}
        enabled={prefs.enabled}
        scheduled={reminderStatus?.scheduled ?? 0}
        upcoming={upcoming.length}
        next={reminderStatus?.next ?? upcoming[0]?.date ?? null}
        truncated={reminderStatus?.truncated ?? false}
        horizonDays={prefs.horizonDays}
        onEnable={() => void refreshReminders({ askPermission: true })}
      />

      <Section>
        <SwitchRow
          label="Event reminders"
          subtitle={prefs.enabled ? 'On for events that have reminders' : 'All reminders are paused'}
          value={prefs.enabled}
          onValueChange={(enabled) => updateNotificationPrefs({ enabled })}
        />
        <Divider />
        <SwitchRow
          label="Play sound"
          subtitle="Off delivers every reminder silently"
          value={prefs.sound}
          onValueChange={(sound) => updateNotificationPrefs({ sound })}
        />
      </Section>

      <Section title="Quiet hours" footer="Reminders during quiet hours still arrive, just without sound.">
        <SwitchRow
          label="Quiet hours"
          value={prefs.quietHours.enabled}
          onValueChange={(enabled) => updateNotificationPrefs({ quietHours: { ...prefs.quietHours, enabled } })}
        />
        {prefs.quietHours.enabled ? (
          <>
            <Divider />
            <Row label="From" value={formatMinutes(prefs.quietHours.start)} onPress={() => setEditing('quietStart')} />
            <Divider />
            <Row label="Until" value={formatMinutes(prefs.quietHours.end)} onPress={() => setEditing('quietEnd')} />
          </>
        ) : null}
      </Section>

      <Section title="Defaults for new events" footer="Existing events keep their own reminders.">
        <Text style={styles.subhead}>Timed events</Text>
        <ReminderPicker value={prefs.defaultReminders} onChange={(defaultReminders) => updateNotificationPrefs({ defaultReminders })} />
        <Divider />
        <Text style={styles.subhead}>All-day events</Text>
        <ReminderPicker
          value={prefs.defaultAllDayReminders}
          onChange={(defaultAllDayReminders) => updateNotificationPrefs({ defaultAllDayReminders })}
        />
        <Divider />
        <Row
          label="All-day reminder time"
          subtitle="“At start” on an all-day event fires at this time"
          value={formatMinutes(prefs.allDayTime)}
          onPress={() => setEditing('allDayTime')}
        />
      </Section>

      <Section
        title="Schedule ahead"
        footer="Phones limit how many reminders an app can queue. OpenCal queues the soonest ones and tops up each time you open it."
      >
        <View style={styles.segmentWrap}>
          <Segmented
            options={HORIZONS.map((d) => ({ value: d, label: `${d} days` }))}
            value={(HORIZONS.find((d) => Number(d) === prefs.horizonDays) ?? '30') as (typeof HORIZONS)[number]}
            onChange={(d) => updateNotificationPrefs({ horizonDays: Number(d) })}
          />
        </View>
      </Section>

      {calendars.length > 0 ? (
        <Section title="Calendars" footer="Turn a calendar off to silence all of its reminders.">
          {calendars.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.calendarRow}>
                <ColorDot color={c.color} size={12} />
                <View style={styles.flex}>
                  <SwitchRow
                    label={c.name}
                    value={!prefs.mutedCalendarIds.includes(c.id)}
                    onValueChange={(on) => toggleMuted(c.id, on)}
                  />
                </View>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {notificationsSupported ? <Button variant="secondary" title="Send a test notification" onPress={() => void test()} /> : null}

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={editing ? TIME_FIELD_TITLE[editing] : ''}>
        {editing ? <TimePicker value={timeOfDay(editingMinutes)} onChange={setEditingMinutes} /> : null}
      </Sheet>
    </ScrollView>
  );
}

function StatusCard({
  status,
  enabled,
  scheduled,
  upcoming,
  next,
  truncated,
  horizonDays,
  onEnable,
}: {
  status: string;
  enabled: boolean;
  scheduled: number;
  upcoming: number;
  next: Date | null;
  truncated: boolean;
  horizonDays: number;
  onEnable: () => void;
}) {
  let icon: IconName = 'bell-ring';
  let title = 'Reminders are on';
  let body = next
    ? `${scheduled || upcoming} queued for the next ${horizonDays} days. Next: ${format(next, 'EEE, MMM d')} at ${formatTime(next)}.`
    : `Nothing due in the next ${horizonDays} days.`;
  let action: React.ReactNode = null;
  let tone: 'ok' | 'warn' = 'ok';

  if (status === 'unsupported') {
    icon = 'bell-off';
    title = 'Not available here';
    body = 'Reminders work in the iOS and Android apps. Your settings are saved and apply there.';
    tone = 'warn';
  } else if (!enabled) {
    icon = 'bell-off';
    title = 'Reminders are paused';
    body = 'Turn event reminders back on below.';
    tone = 'warn';
  } else if (status === 'denied') {
    icon = 'bell-off';
    title = 'Blocked by your device';
    body = 'Allow notifications for OpenCal in system settings to get reminders.';
    action = <Button small title="Open settings" onPress={() => void Linking.openSettings()} />;
    tone = 'warn';
  } else if (status === 'undetermined') {
    icon = 'bell';
    title = 'Allow notifications';
    body = 'OpenCal needs permission to remind you before events.';
    action = <Button small title="Enable" onPress={onEnable} />;
    tone = 'warn';
  } else if (truncated) {
    body += ' More are waiting and will be queued as these pass.';
  }

  return (
    <View style={[styles.status, tone === 'warn' && styles.statusWarn]}>
      <View style={[styles.statusIcon, tone === 'warn' && styles.statusIconWarn]}>
        <Icon name={icon} size={20} color={tone === 'warn' ? colors.primary : colors.onInk} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.statusTitle, tone === 'ok' && styles.statusTitleOk]}>{title}</Text>
        <Text style={[styles.statusBody, tone === 'ok' && styles.statusBodyOk]}>{body}</Text>
        {action ? <View style={styles.statusAction}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  flex: { flex: 1 },
  subhead: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: -8 },
  segmentWrap: { padding: spacing.md },
  calendarRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg },
  status: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    marginBottom: spacing.lg,
  },
  statusWarn: { backgroundColor: colors.primarySoft },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 252, 247, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconWarn: { backgroundColor: colors.surface },
  statusTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.text },
  statusBody: { fontSize: 14, color: colors.textMuted, marginTop: 3, lineHeight: 20 },
  statusTitleOk: { color: colors.onInk },
  statusBodyOk: { color: 'rgba(255, 252, 247, 0.7)' },
  statusAction: { alignSelf: 'flex-start', marginTop: 10 },
});
