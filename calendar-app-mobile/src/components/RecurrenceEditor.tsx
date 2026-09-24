import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addMonths } from 'date-fns';
import { colors } from '../theme';
import { dayKey, parseDayKey } from '../utils/dates';
import {
  buildRRule,
  describeRepeat,
  parseRRule,
  WEEKDAY_LETTER,
  type RepeatConfig,
  type RepeatFreq,
} from '../utils/recurrence';
import { DateTimeField } from './DateTimeField';
import { Chip, Segmented, Stepper } from './ui';

const FREQS: { value: RepeatFreq; label: string }[] = [
  { value: 'none', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const UNIT: Record<Exclude<RepeatFreq, 'none'>, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};

/** Visual editor over an RRULE string (recurrence math is delegated to rrule.js). */
export function RecurrenceEditor({
  value,
  start,
  onChange,
}: {
  value?: string;
  start: Date;
  onChange: (rule: string | undefined) => void;
}) {
  const config = parseRRule(value, start);
  const update = (patch: Partial<RepeatConfig>) => onChange(buildRRule({ ...config, ...patch }));

  return (
    <View style={styles.container}>
      <View style={styles.wrap}>
        {FREQS.map((f) => (
          <Chip key={f.value} label={f.label} selected={config.freq === f.value} onPress={() => update({ freq: f.value })} />
        ))}
      </View>

      {config.freq !== 'none' ? (
        <>
          <View style={styles.line}>
            <Text style={styles.label}>Every</Text>
            <Stepper
              value={config.interval}
              min={1}
              max={99}
              onChange={(interval) => update({ interval })}
              format={(v) => `${v} ${UNIT[config.freq as Exclude<RepeatFreq, 'none'>][v === 1 ? 0 : 1]}`}
            />
          </View>

          {config.freq === 'weekly' ? (
            <View style={styles.weekdays}>
              {WEEKDAY_LETTER.map((letter, i) => {
                const active = config.weekdays.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      const next = active ? config.weekdays.filter((d) => d !== i) : [...config.weekdays, i];
                      if (next.length) update({ weekdays: next });
                    }}
                    style={[styles.weekday, active && styles.weekdayActive]}
                  >
                    <Text style={[styles.weekdayText, active && styles.weekdayTextActive]}>{letter}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.block}>
            <Text style={styles.label}>Ends</Text>
            <Segmented
              options={[
                { value: 'never', label: 'Never' },
                { value: 'until', label: 'On date' },
                { value: 'count', label: 'After' },
              ]}
              value={config.end.type}
              onChange={(type) =>
                update({
                  end:
                    type === 'until'
                      ? { type, date: dayKey(addMonths(start, 3)) }
                      : type === 'count'
                        ? { type, count: 10 }
                        : { type: 'never' },
                })
              }
            />
            {config.end.type === 'until' ? (
              <DateTimeField
                mode="date"
                value={parseDayKey(config.end.date)}
                onChange={(d) => update({ end: { type: 'until', date: dayKey(d) } })}
              />
            ) : null}
            {config.end.type === 'count' ? (
              <Stepper
                value={config.end.count}
                min={1}
                max={999}
                onChange={(count) => update({ end: { type: 'count', count } })}
                format={(v) => `${v} time${v === 1 ? '' : 's'}`}
              />
            ) : null}
          </View>
        </>
      ) : null}

      <Text style={styles.summary}>{describeRepeat(config)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  block: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  weekdays: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  weekdayActive: { backgroundColor: colors.primary },
  weekdayText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  weekdayTextActive: { color: colors.onInk },
  summary: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
