import { addDays, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EventPill } from '../components/EventPill';
import { COMPACT_LANE_HEIGHT, SpanBar } from '../components/SpanBar';
import { occurrencesByDay, type Occurrence } from '../services/occurrences';
import { createStyles, fonts } from '../theme';
import { dayKey, WEEK_STARTS_ON } from '../utils/dates';
import { isAllDayLike, layoutSpans } from './layout';

// Vertical space above the first pill in a cell (padding, day number, margin), and the height of one pill row.
const CELL_HEAD = 23;
const DEFAULT_CAPACITY = 3;
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Memoized: the pages beside the current one keep their props while swiping, so they skip rendering. */
export const MonthView = React.memo(function MonthView({
  month,
  occurrences,
  onPressDay,
}: {
  month: Date;
  occurrences: Occurrence[];
  onPressDay: (d: Date) => void;
}) {
  const styles = useStyles();
  // As many pill rows as the cells are tall: the week rows share the height, so measure one.
  const [rowHeight, setRowHeight] = useState(0);
  const capacity = rowHeight > 0 ? Math.max(1, Math.floor((rowHeight - CELL_HEAD) / COMPACT_LANE_HEIGHT)) : DEFAULT_CAPACITY;
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    const lists = occurrencesByDay(occurrences, days[0]!, days.length);
    days.forEach((d, i) =>
      map.set(
        dayKey(d),
        lists[i]!.filter((o) => !isAllDayLike(o)).sort((a, b) => a.start.getTime() - b.start.getTime()),
      ),
    );
    return map;
  }, [days, occurrences]);

  const today = new Date();
  // Each week: its all-day and multi-day events as bars across their days (up to MAX_PER_CELL rows of
  // them), with the day cells leaving room underneath for the timed events.
  const weeks = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((w) => {
        const week = days.slice(w * 7, w * 7 + 7);
        const { segments, lanes } = layoutSpans(occurrences, week[0]!);
        const shownLanes = Math.min(lanes, capacity);
        return { week, shownLanes, segments: segments.filter((s) => s.lane < shownLanes), hidden: segments.filter((s) => s.lane >= shownLanes) };
      }),
    [days, occurrences, capacity],
  );

  return (
    <View style={styles.container}>
      <View style={styles.weekdays}>
        {days.slice(0, 7).map((d) => (
          <Text key={d.getDay()} style={[styles.weekday, isWeekend(d) && styles.weekdayWeekend]}>
            {format(d, 'EEEEE')}
          </Text>
        ))}
      </View>
      {weeks.map(({ week, shownLanes, segments, hidden }, wi) => (
        <View key={wi} style={styles.week} onLayout={wi === 0 ? (e) => setRowHeight(e.nativeEvent.layout.height) : undefined}>
          {week.map((d, col) => {
            const list = byDay.get(dayKey(d)) ?? [];
            const room = capacity - shownLanes;
            const hiddenHere = hidden.filter((h) => col >= h.col && col < h.col + h.length).length;
            // When something doesn't fit, the last row becomes the "+N more" line.
            const overflow = list.length + hiddenHere > room;
            const shown = overflow ? Math.max(0, room - 1) : list.length;
            const more = overflow ? list.length - shown + hiddenHere : 0;
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
                {/* Events here are only a preview: a tap anywhere in the cell opens the day. */}
                <View style={[styles.events, { marginTop: shownLanes * COMPACT_LANE_HEIGHT }]} pointerEvents="none">
                  {list.slice(0, shown).map((o) => (
                    <EventPill key={o.key} occ={o} compact />
                  ))}
                  {more > 0 ? <Text style={styles.more}>+{more} more</Text> : null}
                </View>
              </Pressable>
            );
          })}
          <View style={styles.spans} pointerEvents="none">
            {segments.map((seg) => (
              <SpanBar
                key={`${seg.occ.key}@${seg.col}`}
                occ={seg.occ}
                compact
                fromPrev={seg.fromPrev}
                toNext={seg.toNext}
                style={{ position: 'absolute', top: seg.lane * COMPACT_LANE_HEIGHT, left: `${(seg.col / 7) * 100}%`, width: `${(seg.length / 7) * 100}%` }}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  weekdays: { flexDirection: 'row', paddingTop: 12, paddingBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 1 },
  weekdayWeekend: { color: colors.primary, opacity: 0.7 },
  week: { flex: 1, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  cell: { flex: 1, paddingHorizontal: 2, paddingTop: 2, overflow: 'hidden' },
  cellWeekend: { backgroundColor: colors.weekend },
  cellPressed: { backgroundColor: colors.primarySoft },
  dayBadge: { alignSelf: 'center', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  dayBadgeToday: { backgroundColor: colors.primary },
  dayText: { fontSize: 12, fontFamily: fonts.display, color: colors.text },
  dayTextOutside: { color: colors.textFaint, opacity: 0.6 },
  dayTextToday: { color: colors.onPrimary },
  events: { gap: 1 },
  // Below the day number (2 padding + 20 badge + 1 margin).
  spans: { position: 'absolute', top: 23, left: 1, right: 1 },
  more: { fontSize: 9.5, lineHeight: 14, color: colors.textMuted, fontWeight: '700', paddingLeft: 3 },
}));
