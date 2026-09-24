import { addDays, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EventPill } from '../components/EventPill';
import { occurrencesForDay, type Occurrence } from '../services/occurrences';
import { colors, fonts } from '../theme';
import { dayKey, WEEK_STARTS_ON } from '../utils/dates';
import { isAllDayLike } from './layout';

const MAX_PER_CELL = 3;
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export function MonthView({
  month,
  occurrences,
  onPressDay,
  onPressEvent,
}: {
  month: Date;
  occurrences: Occurrence[];
  onPressDay: (d: Date) => void;
  onPressEvent: (o: Occurrence) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const d of days) {
      map.set(
        dayKey(d),
        occurrencesForDay(occurrences, d).sort(
          (a, b) => Number(isAllDayLike(b)) - Number(isAllDayLike(a)) || a.start.getTime() - b.start.getTime(),
        ),
      );
    }
    return map;
  }, [days, occurrences]);

  const today = new Date();
  const weeks = [0, 1, 2, 3, 4, 5].map((w) => days.slice(w * 7, w * 7 + 7));

  return (
    <View style={styles.container}>
      <View style={styles.weekdays}>
        {days.slice(0, 7).map((d) => (
          <Text key={d.getDay()} style={[styles.weekday, isWeekend(d) && styles.weekdayWeekend]}>
            {format(d, 'EEEEE')}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((d) => {
            const list = byDay.get(dayKey(d)) ?? [];
            const isToday = isSameDay(d, today);
            const inMonth = isSameMonth(d, month);
            return (
              <Pressable
                key={dayKey(d)}
                onPress={() => onPressDay(d)}
                style={({ pressed }) => [styles.cell, isWeekend(d) && styles.cellWeekend, pressed && styles.cellPressed]}
                accessibilityLabel={`${format(d, 'EEEE, MMMM d')}, ${list.length} events`}
              >
                <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                  <Text style={[styles.dayText, !inMonth && styles.dayTextOutside, isToday && styles.dayTextToday]}>
                    {format(d, 'd')}
                  </Text>
                </View>
                <View style={styles.events}>
                  {list.slice(0, MAX_PER_CELL).map((o) => (
                    <EventPill
                      key={o.key}
                      occ={o}
                      compact
                      variant={isAllDayLike(o) ? 'solid' : 'dot'}
                      onPress={() => onPressEvent(o)}
                    />
                  ))}
                  {list.length > MAX_PER_CELL ? <Text style={styles.more}>+{list.length - MAX_PER_CELL} more</Text> : null}
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
  container: { flex: 1, backgroundColor: colors.surface },
  weekdays: { flexDirection: 'row', paddingTop: 12, paddingBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 1 },
  weekdayWeekend: { color: colors.primary, opacity: 0.7 },
  week: { flex: 1, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  cell: { flex: 1, paddingHorizontal: 2, paddingTop: 4, overflow: 'hidden' },
  cellWeekend: { backgroundColor: colors.weekend },
  cellPressed: { backgroundColor: colors.primarySoft },
  dayBadge: { alignSelf: 'center', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  dayBadgeToday: { backgroundColor: colors.primary },
  dayText: { fontSize: 14, fontFamily: fonts.display, color: colors.text },
  dayTextOutside: { color: colors.textFaint, opacity: 0.6 },
  dayTextToday: { color: colors.onInk },
  events: { gap: 2 },
  more: { fontSize: 10, color: colors.textMuted, fontWeight: '700', paddingLeft: 3 },
});
