import { useFocusEffect } from '@react-navigation/native';
import { format, isSameDay } from 'date-fns';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { ReminderEditor } from '../components/ReminderEditor';
import { Sheet } from '../components/Sheet';
import { TimePicker } from '../components/DateTimeField';
import { Button, ColorDot, Divider, Row, Section, Segmented, SwitchRow } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { FocusKind, FocusWindow } from '../models/NotificationPrefs';
import type { ScreenProps } from '../navigation/types';
import { activeFocusPeriod } from '../services/focus';
import { notificationsSupported, planReminders, sendTestNotification } from '../services/notifications';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { notify } from '../utils/confirm';
import { formatTime } from '../utils/dates';
import { animateNextLayout } from '../utils/motion';
import { describeRRule } from '../utils/recurrence';

const HORIZONS = ['7', '14', '30', '60'] as const;

const timeOfDay = (minutes: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};
const formatMinutes = (minutes: number) => formatTime(timeOfDay(minutes));

/** "Weekly on Mon · 5:00 PM – 6:00 PM", "Wed, Sep 30 · 10:00 PM – 7:00 AM". */
function describeWindow(w: FocusWindow): string {
  const start = new Date(w.startDate);
  const end = new Date(w.endDate);
  const time = `${formatTime(start)} – ${formatTime(end)}`;
  if (!w.recurrenceRule) {
    return end.getTime() - start.getTime() < 86400000
      ? `${format(start, 'EEE, MMM d')} · ${time}`
      : `${format(start, 'MMM d, h:mm a')} – ${format(end, 'MMM d, h:mm a')}`;
  }
  return `${describeRRule(w.recurrenceRule, start)} · ${time}`;
}

export function NotificationsScreen({ navigation }: ScreenProps<'Notifications'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { notificationPrefs: prefs, updateNotificationPrefs, reminderStatus, refreshReminders, calendars, events, calendarsById } =
    useCalendarContext();
  const [editingAllDayTime, setEditingAllDayTime] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshReminders();
    }, [refreshReminders]),
  );

  const upcoming = useMemo(() => planReminders(events, calendarsById, prefs), [events, calendarsById, prefs]);
  const status = reminderStatus?.status ?? (notificationsSupported ? 'undetermined' : 'unsupported');

  const activeFocus = useMemo(() => activeFocusPeriod(prefs.focusWindows), [prefs.focusWindows]);
  const windows = useMemo(
    () => [...prefs.focusWindows].sort((a, b) => a.kind.localeCompare(b.kind) || a.startDate.localeCompare(b.startDate)),
    [prefs.focusWindows],
  );
  const toggleWindow = (id: string, enabled: boolean) => {
    animateNextLayout();
    updateNotificationPrefs({ focusWindows: prefs.focusWindows.map((w) => (w.id === id ? { ...w, enabled } : w)) });
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
        focus={activeFocus ? { kind: activeFocus.kind, until: activeFocus.end } : null}
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

      <Section
        title="Quiet & Do Not Disturb"
        footer="Quiet time delivers reminders silently. Do Not Disturb skips them entirely. Both can repeat like events."
      >
        {windows.length === 0 ? <Text style={styles.emptyWindows}>No quiet times scheduled.</Text> : null}
        {windows.map((w, i) => (
          <View key={w.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              style={({ pressed }) => [styles.windowRow, pressed && styles.pressed, !w.enabled && styles.windowOff]}
              onPress={() => navigation.navigate('FocusEdit', { windowId: w.id })}
            >
              <View style={[styles.windowIcon, w.kind === 'dnd' && styles.windowIconDnd]}>
                <Icon name={w.kind === 'dnd' ? 'bell-off' : 'moon'} size={16} color={w.kind === 'dnd' ? colors.onPrimary : colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.windowTitle}>{w.label || (w.kind === 'dnd' ? 'Do Not Disturb' : 'Quiet')}</Text>
                <Text style={styles.windowMeta} numberOfLines={2}>
                  {describeWindow(w)}
                </Text>
              </View>
              <Switch
                value={w.enabled}
                onValueChange={(on) => toggleWindow(w.id, on)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
              />
            </Pressable>
          </View>
        ))}
        <View style={styles.windowActions}>
          <Button small variant="secondary" title="Add quiet time" onPress={() => navigation.navigate('FocusEdit', { kind: 'quiet' })} style={styles.flex} />
          <Button small variant="secondary" title="Add Do Not Disturb" onPress={() => navigation.navigate('FocusEdit', { kind: 'dnd' })} style={styles.flex} />
        </View>
      </Section>

      <Section title="Defaults for new events" footer="Existing events keep their own reminders.">
        <Text style={styles.subhead}>Timed events</Text>
        <ReminderEditor value={prefs.defaultReminders} onChange={(defaultReminders) => updateNotificationPrefs({ defaultReminders })} />
        <Divider />
        <Text style={styles.subhead}>All-day events</Text>
        <ReminderEditor
          allDay
          allDayTime={prefs.allDayTime}
          value={prefs.defaultAllDayReminders}
          onChange={(defaultAllDayReminders) => updateNotificationPrefs({ defaultAllDayReminders })}
        />
        <Divider />
        <Row
          label="All-day reminder time"
          subtitle="All-day reminders count back from this time"
          value={formatMinutes(prefs.allDayTime)}
          onPress={() => setEditingAllDayTime(true)}
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

      <Sheet visible={editingAllDayTime} onClose={() => setEditingAllDayTime(false)} title="All-day reminder time">
        {editingAllDayTime ? (
          <TimePicker
            value={timeOfDay(prefs.allDayTime)}
            onChange={(d) => updateNotificationPrefs({ allDayTime: d.getHours() * 60 + d.getMinutes() })}
          />
        ) : null}
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
  focus,
  onEnable,
}: {
  status: string;
  enabled: boolean;
  scheduled: number;
  upcoming: number;
  next: Date | null;
  truncated: boolean;
  horizonDays: number;
  focus: { kind: FocusKind; until: Date } | null;
  onEnable: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
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
  } else {
    if (truncated) body += ' More are waiting and will be queued as these pass.';
    if (focus) {
      icon = focus.kind === 'dnd' ? 'bell-off' : 'moon';
      const until = format(focus.until, isSameDay(focus.until, new Date()) ? 'h:mm a' : 'EEE h:mm a');
      title = `${focus.kind === 'dnd' ? 'Do Not Disturb' : 'Quiet'} until ${until}`;
    }
  }

  return (
    <View style={[styles.status, tone === 'warn' && styles.statusWarn]}>
      <View style={[styles.statusIcon, tone === 'warn' && styles.statusIconWarn]}>
        <Icon name={icon} size={20} color={tone === 'warn' ? colors.primary : colors.onPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.statusTitle, tone === 'ok' && styles.statusTitleOk]}>{title}</Text>
        <Text style={[styles.statusBody, tone === 'ok' && styles.statusBodyOk]}>{body}</Text>
        {action ? <View style={styles.statusAction}>{action}</View> : null}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  emptyWindows: { fontSize: 15, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  windowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  windowOff: { opacity: 0.55 },
  windowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  windowIconDnd: { backgroundColor: colors.primary },
  windowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  windowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  windowActions: { flexDirection: 'row', gap: 8, padding: spacing.md },
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconWarn: { backgroundColor: colors.surface },
  statusTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.text },
  statusBody: { fontSize: 14, color: colors.textMuted, marginTop: 3, lineHeight: 20 },
  statusTitleOk: { color: colors.onInk },
  statusBodyOk: { color: colors.onInkMuted },
  statusAction: { alignSelf: 'flex-start', marginTop: 10 },
}));
