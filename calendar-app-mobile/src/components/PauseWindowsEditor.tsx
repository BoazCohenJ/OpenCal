import { format, isAfter, startOfMonth } from 'date-fns';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PauseWindow } from '../models/PauseWindow';
import { colors, radius } from '../theme';
import { Icon } from './Icon';
import { dayKey, formatPauseWindow } from '../utils/dates';
import { MiniMonth } from './MiniMonth';
import { Sheet } from './Sheet';
import { Button } from './ui';

/** List of date-range pauses with a range picker to add new ones. */
export function PauseWindowsEditor({ value, onChange }: { value: PauseWindow[]; onChange: (v: PauseWindow[]) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [rangeStart, setRangeStart] = useState<Date | undefined>();
  const [rangeEnd, setRangeEnd] = useState<Date | undefined>();

  const today = dayKey(new Date());
  const sorted = [...value].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const pick = (d: Date) => {
    if (!rangeStart || rangeEnd) {
      setRangeStart(d);
      setRangeEnd(undefined);
    } else if (isAfter(rangeStart, d)) {
      setRangeStart(d);
    } else {
      setRangeEnd(d);
    }
  };

  const save = () => {
    if (!rangeStart) return;
    const w = { startDate: dayKey(rangeStart), endDate: dayKey(rangeEnd ?? rangeStart) };
    onChange([...value, w]);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {sorted.length === 0 ? <Text style={styles.empty}>No pauses. Occurrences run as scheduled.</Text> : null}
      {sorted.map((w) => {
        const status = w.endDate < today ? 'Past' : w.startDate <= today ? 'Active now' : 'Upcoming';
        return (
          <View key={`${w.startDate}-${w.endDate}`} style={styles.item}>
            <Icon name="pause" size={16} color={colors.textMuted} />
            <View style={styles.itemBody}>
              <Text style={styles.itemText}>{formatPauseWindow(w)}</Text>
              <Text style={[styles.status, status === 'Active now' && { color: colors.primary }]}>{status}</Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => onChange(value.filter((x) => x !== w))}
              accessibilityLabel={`Remove pause ${formatPauseWindow(w)}`}
            >
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        );
      })}
      <Button
        small
        variant="secondary"
        title="Add pause"
        onPress={() => {
          setRangeStart(undefined);
          setRangeEnd(undefined);
          setMonth(startOfMonth(new Date()));
          setOpen(true);
        }}
      />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Pause dates" actionLabel="Add" onAction={save}>
        <Text style={styles.hint}>
          {!rangeStart
            ? 'Tap the first day of the pause.'
            : !rangeEnd
              ? `From ${format(rangeStart, 'MMM d')} — now tap the last day (or Add for a single day).`
              : `${format(rangeStart, 'MMM d, yyyy')} → ${format(rangeEnd, 'MMM d, yyyy')}`}
        </Text>
        <MiniMonth month={month} onChangeMonth={setMonth} rangeStart={rangeStart} rangeEnd={rangeEnd} onSelectDay={pick} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  empty: { fontSize: 14, color: colors.textMuted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 12,
  },
  itemBody: { flex: 1 },
  itemText: { fontSize: 15, fontWeight: '600', color: colors.text },
  status: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  remove: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  hint: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
});
