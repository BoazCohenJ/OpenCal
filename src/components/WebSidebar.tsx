import { startOfDay } from 'date-fns';
import React, { useState } from 'react';
import { Pressable, PressableStateCallbackType, ScrollView, Switch, Text, View } from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';
import { DEFAULT_FOLD, type Calendar } from '../models/Calendar';
import { BIRTHDAY_COLOR, BIRTHDAYS_CALENDAR_ID } from '../services/birthdays';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { MiniMonth } from './MiniMonth';

type Hover = PressableStateCallbackType & { hovered?: boolean };

/**
 * The desktop browser's left rail: new event, a month to jump around in, the calendars to show,
 * and the places the phone reaches through its menus. Only used on wide web windows.
 */
export function WebSidebar({
  cursor,
  onSelectDay,
  onNewEvent,
  onOpenSettings,
  onOpenStamps,
  onManageCalendars,
}: {
  cursor: Date;
  onSelectDay: (d: Date) => void;
  onNewEvent: () => void;
  onOpenSettings: () => void;
  onOpenStamps: () => void;
  onManageCalendars: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { calendars, visibleCalendarIds, toggleCalendarVisibility, saveCalendar, birthdays, showAllEvents, setShowAllEvents } = useCalendarContext();
  const [month, setMonth] = useState(cursor);
  const cursorMonth = cursor.getFullYear() * 12 + cursor.getMonth();
  // Follow the main view when it moves to another month.
  const [seenMonth, setSeenMonth] = useState(cursorMonth);
  if (seenMonth !== cursorMonth) {
    setSeenMonth(cursorMonth);
    setMonth(cursor);
  }
  const rows: { id: string; name: string; color: string; calendar?: Calendar }[] = [
    ...calendars.map((c) => ({ id: c.id, name: c.name, color: c.color, calendar: c })),
    ...(birthdays.length ? [{ id: BIRTHDAYS_CALENDAR_ID, name: 'Birthdays', color: BIRTHDAY_COLOR }] : []),
  ];
  const anyFolded = calendars.some((c) => c.fold?.enabled && visibleCalendarIds.includes(c.id));
  const toggleFolded = (calendar: Calendar) =>
    saveCalendar({ ...calendar, fold: { ...DEFAULT_FOLD, ...calendar.fold, enabled: !calendar.fold?.enabled } });

  return (
    <View style={styles.root}>
      <View style={styles.brand}>
        <Logo size={30} />
        <Text style={styles.brandText}>OpenCal</Text>
      </View>

      <Pressable onPress={onNewEvent} style={({ hovered }: Hover) => [styles.newButton, hovered && styles.newButtonHover]} accessibilityLabel="New event">
        <Icon name="plus" size={18} color={colors.onPrimary} strokeWidth={2.5} />
        <Text style={styles.newText}>New event</Text>
        <Text style={styles.newKey}>C</Text>
      </Pressable>

      <View style={styles.mini}>
        <MiniMonth month={month} onChangeMonth={setMonth} onSelectDay={(d) => onSelectDay(startOfDay(d))} selected={cursor} compact />
      </View>

      <ScrollView style={styles.list}>
        {rows.map((c) => {
          const on = visibleCalendarIds.includes(c.id);
          const folded = on && !!c.calendar?.fold?.enabled;
          return (
            <View key={c.id} style={styles.calRowWrap}>
              <Pressable
                onPress={() => toggleCalendarVisibility(c.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={({ hovered }: Hover) => [styles.row, styles.calRowMain, hovered && styles.rowHover]}
              >
                <View style={[styles.box, { borderColor: c.color, backgroundColor: on ? c.color : 'transparent' }]}>
                  {on ? <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3.5} /> : null}
                </View>
                <Text style={[styles.rowName, !on && styles.rowNameOff]} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
              {c.calendar && on && (folded || c.calendar.fold) ? (
                <Pressable
                  onPress={() => toggleFolded(c.calendar!)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={folded ? `Unfold ${c.name}` : `Fold ${c.name}`}
                  style={({ hovered }: Hover) => [styles.foldPill, folded && styles.foldPillOn, hovered && styles.foldPillHover]}
                >
                  <Text style={[styles.foldPillText, folded && styles.foldPillTextOn]}>{folded ? 'Folded' : 'Fold'}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {anyFolded ? (
          <View style={styles.showAllRow}>
            <Text style={styles.showAllText}>Show all events</Text>
            <Switch
              value={showAllEvents}
              onValueChange={setShowAllEvents}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <NavRow icon="calendar" label="Manage calendars" onPress={onManageCalendars} />
        <NavRow icon="stamp" label="Stamps" onPress={onOpenStamps} />
        <NavRow icon="settings" label="Settings" onPress={onOpenSettings} />
        <Text style={styles.keys}>T today · ← → move · D W M S views</Text>
      </View>
    </View>
  );
}

function NavRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ hovered }: Hover) => [styles.row, hovered && styles.rowHover]}>
      <Icon name={icon} size={17} color={colors.textMuted} />
      <Text style={styles.navText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  root: { width: 264, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, borderRightWidth: 1, borderRightColor: colors.hairline, backgroundColor: colors.bg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg, paddingLeft: 2 },
  brandText: { fontFamily: fonts.displayBold, fontSize: 21, color: colors.text, letterSpacing: -0.4 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
  },
  newButtonHover: { opacity: 0.9 },
  newText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.onPrimary },
  newKey: { fontSize: 11, fontWeight: '700', color: colors.onPrimary, opacity: 0.7 },
  mini: { marginBottom: spacing.md },
  list: { flex: 1, minHeight: 90 },
  calRowWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calRowMain: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: radius.sm },
  rowHover: { backgroundColor: colors.surfaceAlt },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowName: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  rowNameOff: { color: colors.textMuted },
  foldPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  foldPillOn: { backgroundColor: colors.primarySoft },
  foldPillHover: { opacity: 0.8 },
  foldPillText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  foldPillTextOn: { color: colors.primary },
  showAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  showAllText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  footer: { marginTop: 'auto', paddingTop: spacing.md, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.hairline },
  navText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  keys: { fontSize: 11, color: colors.textFaint, marginTop: spacing.md, paddingLeft: 8 },
}));
