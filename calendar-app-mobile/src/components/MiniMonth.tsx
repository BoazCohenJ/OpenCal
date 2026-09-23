import { addDays, addMonths, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { dayKey, WEEK_STARTS_ON } from '../utils/dates';

interface Props {
  month: Date;
  onChangeMonth: (month: Date) => void;
  onSelectDay: (day: Date) => void;
  selected?: Date;
  rangeStart?: Date;
  rangeEnd?: Date;
}

export function MiniMonth({ month, onChangeMonth, onSelectDay, selected, rangeStart, rangeEnd }: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const weeks = [0, 1, 2, 3, 4, 5].map((w) => days.slice(w * 7, w * 7 + 7));
  const today = new Date();

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => onChangeMonth(addMonths(month, -1))} hitSlop={12} style={styles.nav} accessibilityLabel="Previous month">
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{format(month, 'MMMM yyyy')}</Text>
        <Pressable onPress={() => onChangeMonth(addMonths(month, 1))} hitSlop={12} style={styles.nav} accessibilityLabel="Next month">
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        {days.slice(0, 7).map((d) => (
          <Text key={d.getDay()} style={styles.dow}>
            {format(d, 'EEEEE')}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((d) => {
            const isEndpoint =
              (!!selected && isSameDay(d, selected)) ||
              (!!rangeStart && isSameDay(d, rangeStart)) ||
              (!!rangeEnd && isSameDay(d, rangeEnd));
            const inRange =
              !!rangeStart && !!rangeEnd && d > startOfDay(rangeStart) && d < startOfDay(rangeEnd);
            const isToday = isSameDay(d, today);
            return (
              <Pressable key={dayKey(d)} onPress={() => onSelectDay(d)} style={[styles.cell, inRange && styles.inRange]}>
                <View style={[styles.circle, isEndpoint && styles.circleSelected]}>
                  <Text
                    style={[
                      styles.dayText,
                      !isSameMonth(d, month) && styles.outside,
                      isToday && styles.today,
                      isEndpoint && styles.selectedText,
                    ]}
                  >
                    {format(d, 'd')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.surfaceAlt },
  navText: { fontSize: 22, color: colors.text, marginTop: -2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textFaint, paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  inRange: { backgroundColor: colors.primarySoft },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  circleSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 15, color: colors.text },
  outside: { color: colors.textFaint },
  today: { color: colors.primary, fontWeight: '700' },
  selectedText: { color: '#FFFFFF', fontWeight: '700' },
});
