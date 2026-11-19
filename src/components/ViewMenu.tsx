import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';
import { DEFAULT_FOLD, type Calendar } from '../models/Calendar';
import { BIRTHDAY_COLOR, BIRTHDAYS_CALENDAR_ID } from '../services/birthdays';
import { createStyles, radius, spacing, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { SwitchRow } from './ui';

type Visibility = 'show' | 'fold' | 'hide';

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'show', label: 'Show' },
  { value: 'fold', label: 'Fold' },
  { value: 'hide', label: 'Hide' },
];

export type ViewMode = 'schedule' | 'day' | 'week' | 'month';

export const VIEW_OPTIONS: { value: ViewMode; label: string; icon: IconName }[] = [
  { value: 'schedule', label: 'Schedule', icon: 'view-schedule' },
  { value: 'day', label: 'Day', icon: 'view-day' },
  { value: 'week', label: 'Week', icon: 'view-week' },
  { value: 'month', label: 'Month', icon: 'view-month' },
];

/**
 * The calendar's view switcher and calendar filter in one sheet, so the screen above the grid
 * stays short. Picking a view closes it; calendar toggles keep it open. Each calendar can be shown,
 * folded into one block per day (see services/fold) or hidden.
 */
export function ViewMenu({
  visible,
  onClose,
  mode,
  onChangeMode,
  onManageCalendars,
}: {
  visible: boolean;
  onClose: () => void;
  mode: ViewMode;
  onChangeMode: (mode: ViewMode) => void;
  onManageCalendars: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { calendars, visibleCalendarIds, toggleCalendarVisibility, saveCalendar, birthdays, showAllEvents, setShowAllEvents } =
    useCalendarContext();
  const rows: { id: string; name: string; color: string; calendar?: Calendar }[] = [
    ...calendars.map((c) => ({ id: c.id, name: c.name, color: c.color, calendar: c })),
    ...(birthdays.length ? [{ id: BIRTHDAYS_CALENDAR_ID, name: 'Birthdays', color: BIRTHDAY_COLOR }] : []),
  ];
  const anyFolded = calendars.some((c) => c.fold?.enabled && visibleCalendarIds.includes(c.id));

  const setVisibility = (id: string, calendar: Calendar | undefined, next: Visibility) => {
    const visible = visibleCalendarIds.includes(id);
    if (visible !== (next !== 'hide')) toggleCalendarVisibility(id);
    if (!calendar || next === 'hide') return;
    const folded = !!calendar.fold?.enabled;
    if (folded !== (next === 'fold')) saveCalendar({ ...calendar, fold: { ...DEFAULT_FOLD, ...calendar.fold, enabled: next === 'fold' } });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="View">
      <View style={styles.views}>
        {VIEW_OPTIONS.map((o) => {
          const active = o.value === mode;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                onChangeMode(o.value);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.viewTile, active && styles.viewTileActive, pressed && styles.pressed]}
            >
              <Icon name={o.icon} size={22} color={active ? colors.onInk : colors.text} />
              <Text style={[styles.viewLabel, active && styles.viewLabelActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {anyFolded ? (
        <View style={styles.showAll}>
          <SwitchRow
            label="Show all events"
            subtitle="Unfold every folded calendar"
            value={showAllEvents}
            onValueChange={setShowAllEvents}
          />
        </View>
      ) : null}

      <Text style={styles.heading}>CALENDARS</Text>
      <ScrollView style={styles.list} bounces={false}>
        {rows.map((c) => {
          const on = visibleCalendarIds.includes(c.id);
          const value: Visibility = !on ? 'hide' : c.calendar?.fold?.enabled ? 'fold' : 'show';
          // Birthdays are all-day, so there's nothing to fold.
          const options = c.calendar ? VISIBILITY_OPTIONS : VISIBILITY_OPTIONS.filter((o) => o.value !== 'fold');
          return (
            <View key={c.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: on ? c.color : 'transparent', borderColor: c.color }]} />
              <Text style={[styles.rowName, !on && styles.rowNameOff]} numberOfLines={1}>
                {c.name}
              </Text>
              <View style={styles.seg} accessibilityRole="radiogroup" accessibilityLabel={`${c.name}: show, fold or hide`}>
                {options.map((o) => {
                  const active = o.value === value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => setVisibility(c.id, c.calendar, o.value)}
                      hitSlop={4}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${o.label} ${c.name}`}
                      style={[styles.segItem, active && styles.segItemOn]}
                    >
                      <Text style={[styles.segText, active && styles.segTextOn]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        onPress={() => {
          onClose();
          onManageCalendars();
        }}
        style={({ pressed }) => [styles.row, styles.manage, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        <Icon name="settings" size={18} color={colors.textMuted} />
        <Text style={styles.manageText}>Manage calendars</Text>
        <Icon name="chevron-right" size={18} color={colors.textFaint} />
      </Pressable>
    </Sheet>
  );
}

const useStyles = createStyles((colors) => ({
  views: { flexDirection: 'row', gap: spacing.sm },
  viewTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  viewTileActive: { backgroundColor: colors.ink },
  viewLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  viewLabelActive: { color: colors.onInk },
  pressed: { opacity: 0.7 },
  heading: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.4, marginTop: spacing.lg, marginBottom: 4 },
  list: { maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6, borderRadius: radius.md },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  seg: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 2 },
  segItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  segItemOn: { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  segTextOn: { color: colors.text },
  showAll: { marginTop: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, overflow: 'hidden' },
  rowName: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  rowNameOff: { color: colors.textMuted },
  manage: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, borderRadius: 0 },
  manageText: { flex: 1, fontSize: 15, color: colors.textMuted },
}));
