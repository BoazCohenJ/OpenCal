import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';
import { BIRTHDAY_COLOR, BIRTHDAYS_CALENDAR_ID } from '../services/birthdays';
import { createStyles, radius, spacing, useTheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';

export type ViewMode = 'schedule' | 'day' | 'week' | 'month';

export const VIEW_OPTIONS: { value: ViewMode; label: string; icon: IconName }[] = [
  { value: 'schedule', label: 'Schedule', icon: 'view-schedule' },
  { value: 'day', label: 'Day', icon: 'view-day' },
  { value: 'week', label: 'Week', icon: 'view-week' },
  { value: 'month', label: 'Month', icon: 'view-month' },
];

/**
 * The calendar's view switcher and calendar filter in one sheet, so the screen above the grid
 * stays short. Picking a view closes it; calendar toggles keep it open.
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
  const { calendars, visibleCalendarIds, toggleCalendarVisibility, birthdays } = useCalendarContext();
  const rows = [
    ...calendars.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    ...(birthdays.length ? [{ id: BIRTHDAYS_CALENDAR_ID, name: 'Birthdays', color: BIRTHDAY_COLOR }] : []),
  ];

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

      <Text style={styles.heading}>CALENDARS</Text>
      <ScrollView style={styles.list} bounces={false}>
        {rows.map((c) => {
          const on = visibleCalendarIds.includes(c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => toggleCalendarVisibility(c.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              <View style={[styles.box, { borderColor: c.color, backgroundColor: on ? c.color : 'transparent' }]}>
                {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
              <Text style={[styles.rowName, !on && styles.rowNameOff]} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
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
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowName: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  rowNameOff: { color: colors.textMuted },
  manage: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, borderRadius: 0 },
  manageText: { flex: 1, fontSize: 15, color: colors.textMuted },
}));
