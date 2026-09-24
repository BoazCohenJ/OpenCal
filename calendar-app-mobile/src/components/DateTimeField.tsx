import { format, startOfMonth } from 'date-fns';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { Icon } from './Icon';
import { MiniMonth } from './MiniMonth';
import { Sheet } from './Sheet';

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const NUDGES = [-15, -1, 1, 15];

function GridCell({ label, active, near, onPress }: { label: string; active: boolean; near?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.cell, near && styles.cellNear, active && styles.cellActive, pressed && styles.pressed]}
    >
      <Text style={[styles.cellText, active && styles.cellTextActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Tap-only time picker: big readout with an AM/PM toggle, a 12-hour grid in clock order and a
 * 5-minute grid, plus nudges for exact minutes. Any time is at most three taps away, no scrolling.
 */
export function TimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const h24 = value.getHours();
  const pm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minute = value.getMinutes();
  const setMinutesOfDay = (total: number) => {
    const wrapped = ((total % 1440) + 1440) % 1440;
    const d = new Date(value);
    d.setHours(Math.floor(wrapped / 60), wrapped % 60, 0, 0);
    onChange(d);
  };
  const set = (hour12: number, min: number, isPm: boolean) => setMinutesOfDay(((hour12 % 12) + (isPm ? 12 : 0)) * 60 + min);

  return (
    <View style={styles.timePicker}>
      <View style={styles.readout}>
        <Text style={styles.readoutTime} accessibilityLiveRegion="polite">
          {format(value, 'h:mm')}
        </Text>
        <View style={styles.meridiem}>
          {(['AM', 'PM'] as const).map((m) => {
            const active = (m === 'PM') === pm;
            return (
              <Pressable
                key={m}
                onPress={() => set(h12, minute, m === 'PM')}
                accessibilityState={{ selected: active }}
                style={[styles.meridiemButton, active && styles.meridiemActive]}
              >
                <Text style={[styles.meridiemText, active && styles.meridiemTextActive]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.gridLabel}>HOUR</Text>
      <View style={styles.grid}>
        {HOURS_12.map((h) => (
          <GridCell key={h} label={String(h)} active={h === h12} onPress={() => set(h, minute, pm)} />
        ))}
      </View>

      <Text style={styles.gridLabel}>MINUTE</Text>
      <View style={styles.grid}>
        {MINUTES.map((m) => (
          <GridCell
            key={m}
            label={`:${String(m).padStart(2, '0')}`}
            active={m === minute}
            near={minute % 5 !== 0 && m === minute - (minute % 5)}
            onPress={() => set(h12, m, pm)}
          />
        ))}
      </View>

      <View style={styles.nudges}>
        {NUDGES.map((n) => (
          <Pressable
            key={n}
            onPress={() => setMinutesOfDay(h24 * 60 + minute + n)}
            style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
            accessibilityLabel={`${n > 0 ? 'Add' : 'Subtract'} ${Math.abs(n)} minute${Math.abs(n) === 1 ? '' : 's'}`}
          >
            <Text style={styles.nudgeText}>
              {n > 0 ? '+' : '−'}
              {Math.abs(n)} min
            </Text>
          </Pressable>
        ))}
      </View>
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
            <Icon name="x" size={13} color={colors.primary} strokeWidth={2.5} />
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
  pressed: { opacity: 0.7 },
  timePicker: { alignSelf: 'center', width: '100%', maxWidth: 420, gap: 8, paddingBottom: 4 },
  readout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 6 },
  readoutTime: { fontFamily: fonts.displayBold, fontSize: 52, color: colors.text, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  meridiem: { gap: 4 },
  meridiemButton: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  meridiemActive: { backgroundColor: colors.ink },
  meridiemText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  meridiemTextActive: { color: colors.onInk },
  gridLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: colors.textMuted, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    flexBasis: '15%',
    flexGrow: 1,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellNear: { borderColor: colors.primary, borderStyle: 'dashed' },
  cellActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellText: { fontSize: 16, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  cellTextActive: { color: colors.onInk, fontWeight: '800' },
  nudges: { flexDirection: 'row', gap: 6, marginTop: 8 },
  nudge: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center' },
  nudgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
