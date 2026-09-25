import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { animateNextLayout } from '../utils/motion';
import { formatAllDayReminder, formatOffsetShort, formatReminder } from '../utils/format';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, Segmented, Stepper } from './ui';

const TIMED_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440];
const ALL_DAY_PRESETS = [0, 1440, 2880, 10080];

type Unit = 'minutes' | 'hours' | 'days' | 'weeks';
const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };
const UNIT_MAX: Record<Unit, number> = { minutes: 59 * 24 * 7, hours: 24 * 7 * 4, days: 60, weeks: 8 };

/** Largest unit that expresses `minutes` exactly, so reopening a custom reminder shows e.g. "2 hours". */
function splitMinutes(minutes: number): { amount: number; unit: Unit } {
  for (const unit of ['weeks', 'days', 'hours'] as Unit[]) {
    if (minutes > 0 && minutes % UNIT_MINUTES[unit] === 0) return { amount: minutes / UNIT_MINUTES[unit], unit };
  }
  return { amount: minutes, unit: 'minutes' };
}

/**
 * Reminder list editor: current reminders as removable rows, one-tap presets, and a custom sheet
 * that accepts any value down to the minute. For all-day events, `allDayTime` (minutes since
 * midnight) anchors the labels ("1 day before at 9:00 AM").
 */
export function ReminderEditor({
  value,
  onChange,
  allDay = false,
  allDayTime = 9 * 60,
  emptyLabel = 'No reminders',
}: {
  value: number[];
  onChange: (v: number[]) => void;
  allDay?: boolean;
  allDayTime?: number;
  emptyLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [editing, setEditing] = useState<{ original: number | null; amount: number; unit: Unit } | null>(null);
  const sorted = [...value].sort((a, b) => a - b);
  const label = (m: number) => (allDay ? formatAllDayReminder(m, allDayTime) : formatReminder(m));
  const presets = (allDay ? ALL_DAY_PRESETS : TIMED_PRESETS).filter((m) => !value.includes(m));

  const add = (m: number) => {
    animateNextLayout();
    onChange(Array.from(new Set([...value, m])).sort((a, b) => a - b));
  };
  const remove = (m: number) => {
    animateNextLayout();
    onChange(value.filter((x) => x !== m));
  };

  const draftMinutes = editing ? editing.amount * UNIT_MINUTES[editing.unit] : 0;
  const saveDraft = () => {
    if (!editing) return;
    const without = editing.original === null ? value : value.filter((x) => x !== editing.original);
    animateNextLayout();
    onChange(Array.from(new Set([...without, draftMinutes])).sort((a, b) => a - b));
    setEditing(null);
  };

  return (
    <View style={styles.container}>
      {sorted.length === 0 ? (
        <View style={styles.emptyRow}>
          <Icon name="bell-off" size={16} color={colors.textFaint} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      ) : (
        sorted.map((m) => (
          <View key={m} style={styles.item}>
            <Pressable
              style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}
              onPress={() => setEditing({ original: m, ...splitMinutes(m) })}
              accessibilityLabel={`Edit reminder ${label(m)}`}
            >
              <View style={styles.bell}>
                <Icon name="bell" size={15} color={colors.primary} />
              </View>
              <Text style={styles.itemText}>{label(m)}</Text>
            </Pressable>
            <Pressable onPress={() => remove(m)} hitSlop={10} style={styles.remove} accessibilityLabel={`Remove reminder ${label(m)}`}>
              <Icon name="x" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.presets}>
        {presets.map((m) => (
          <Pressable
            key={m}
            onPress={() => add(m)}
            style={({ pressed }) => [styles.preset, pressed && styles.pressed]}
            accessibilityLabel={`Add reminder ${label(m)}`}
          >
            <Icon name="plus" size={12} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.presetText}>{allDay && m === 0 ? 'On the day' : formatOffsetShort(m)}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setEditing({ original: null, amount: allDay ? 1 : 20, unit: allDay ? 'days' : 'minutes' })}
          style={({ pressed }) => [styles.preset, styles.custom, pressed && styles.pressed]}
          accessibilityLabel="Add a custom reminder"
        >
          <Icon name="clock" size={12} color={colors.text} />
          <Text style={[styles.presetText, styles.customText]}>Custom…</Text>
        </Pressable>
      </View>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.original === null ? 'New reminder' : 'Edit reminder'}
        actionLabel="Cancel"
      >
        {editing ? (
          <View style={styles.sheet}>
            <Text style={styles.preview}>{label(draftMinutes)}</Text>
            <View style={styles.amountRow}>
              <Stepper
                value={editing.amount}
                min={0}
                max={UNIT_MAX[editing.unit]}
                onChange={(amount) => setEditing({ ...editing, amount })}
                format={(v) => String(v)}
              />
              <Text style={styles.unitLabel}>{editing.amount === 1 ? editing.unit.slice(0, -1) : editing.unit} before</Text>
            </View>
            <Segmented<Unit>
              options={[
                { value: 'minutes', label: 'Min' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
                { value: 'weeks', label: 'Weeks' },
              ]}
              value={editing.unit}
              onChange={(unit) => setEditing({ ...editing, unit, amount: Math.min(editing.amount, UNIT_MAX[unit]) })}
            />
            <Text style={styles.hint}>Tap the number to type it. Hold − or + to change it quickly.</Text>
            <Button title={editing.original === null ? 'Add reminder' : 'Save reminder'} onPress={saveDraft} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { padding: spacing.md, gap: 8 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6 },
  emptyText: { fontSize: 15, color: colors.textMuted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  bell: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  remove: { padding: 12 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  presetText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  custom: { backgroundColor: colors.surfaceAlt },
  customText: { color: colors.text },
  pressed: { opacity: 0.7 },
  sheet: { gap: 14, paddingBottom: 4 },
  preview: { fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  unitLabel: { fontSize: 16, color: colors.textMuted, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
}));
