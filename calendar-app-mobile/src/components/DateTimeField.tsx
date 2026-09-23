import { format, startOfMonth } from 'date-fns';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { MiniMonth } from './MiniMonth';
import { Sheet } from './Sheet';

const ITEM_H = 44;
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function OptionColumn({
  items,
  selectedKey,
  onSelect,
}: {
  items: { key: number; label: string }[];
  selectedKey: number;
  onSelect: (key: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const idx = items.findIndex((i) => i.key === selectedKey);
    const id = setTimeout(() => ref.current?.scrollTo({ y: Math.max(0, (idx - 2) * ITEM_H), animated: false }), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView ref={ref} style={styles.column} showsVerticalScrollIndicator={false}>
      {items.map((i) => {
        const active = i.key === selectedKey;
        return (
          <Pressable key={i.key} onPress={() => onSelect(i.key)} style={[styles.option, active && styles.optionActive]}>
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{i.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const h24 = value.getHours();
  const pm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minute = value.getMinutes();
  const set = (hour12: number, min: number, isPm: boolean) => {
    const d = new Date(value);
    d.setHours((hour12 % 12) + (isPm ? 12 : 0), min, 0, 0);
    onChange(d);
  };
  return (
    <View style={styles.timeRow}>
      <OptionColumn items={HOURS_12.map((h) => ({ key: h, label: String(h) }))} selectedKey={h12} onSelect={(h) => set(h, minute, pm)} />
      <OptionColumn
        items={MINUTES.map((m) => ({ key: m, label: String(m).padStart(2, '0') }))}
        selectedKey={minute - (minute % 5)}
        onSelect={(m) => set(h12, m, pm)}
      />
      <OptionColumn
        items={[
          { key: 0, label: 'AM' },
          { key: 1, label: 'PM' },
        ]}
        selectedKey={pm ? 1 : 0}
        onSelect={(k) => set(h12, minute, k === 1)}
      />
    </View>
  );
}

/** Tappable date (and optional time) pills that open bottom-sheet pickers. */
export function DateTimeField({
  value,
  onChange,
  mode = 'datetime',
}: {
  value: Date;
  onChange: (d: Date) => void;
  mode?: 'date' | 'datetime';
}) {
  const [open, setOpen] = useState<'date' | 'time' | null>(null);
  const [month, setMonth] = useState(startOfMonth(value));
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        onPress={() => {
          setMonth(startOfMonth(value));
          setOpen('date');
        }}
      >
        <Text style={styles.pillText}>{format(value, 'EEE, MMM d, yyyy')}</Text>
      </Pressable>
      {mode === 'datetime' ? (
        <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => setOpen('time')}>
          <Text style={styles.pillText}>{format(value, 'h:mm a')}</Text>
        </Pressable>
      ) : null}

      <Sheet visible={open === 'date'} onClose={() => setOpen(null)} title="Pick a date">
        <MiniMonth
          month={month}
          onChangeMonth={setMonth}
          selected={value}
          onSelectDay={(d) => {
            const next = new Date(d);
            next.setHours(value.getHours(), value.getMinutes(), 0, 0);
            onChange(next);
            setOpen(null);
          }}
        />
      </Sheet>
      <Sheet visible={open === 'time'} onClose={() => setOpen(null)} title="Pick a time">
        <TimePicker value={value} onChange={onChange} />
      </Sheet>
    </View>
  );
}

/** Date button that can be cleared, used for optional filters. */
export function OptionalDateButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(value ?? new Date()));
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.pill, value && styles.pillActive, pressed && styles.pressed]}
        onPress={() => {
          setMonth(startOfMonth(value ?? new Date()));
          setOpen(true);
        }}
      >
        <Text style={[styles.pillText, value && styles.pillTextActive]}>
          {label}: {value ? format(value, 'MMM d, yyyy') : 'Any'}
        </Text>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityLabel={`Clear ${label}`}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        ) : null}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <MiniMonth
          month={month}
          onChangeMonth={setMonth}
          selected={value ?? undefined}
          onSelectDay={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  pillActive: { backgroundColor: colors.primarySoft },
  pillText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  pillTextActive: { color: colors.primary },
  clear: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  timeRow: { flexDirection: 'row', gap: 8, height: ITEM_H * 5 },
  column: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  option: { height: ITEM_H, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, marginHorizontal: 4 },
  optionActive: { backgroundColor: colors.primary },
  optionText: { fontSize: 17, color: colors.text },
  optionTextActive: { color: '#FFFFFF', fontWeight: '700' },
});
