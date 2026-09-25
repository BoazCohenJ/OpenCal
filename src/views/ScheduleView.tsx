import { addDays, format, isSameDay, isSameMonth, startOfDay } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { EventGlyph, eventIconKey, Icon } from '../components/Icon';
import { occurrencesForDay, type Occurrence } from '../services/occurrences';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { dayKey, formatTime } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { isAllDayLike } from './layout';

const PAGE_DAYS = 60;

interface DaySection {
  key: string;
  day: Date;
  /** First section of a new month: shows a month divider above the day. */
  newMonth: boolean;
  data: Occurrence[];
}

/**
 * Agenda list: every day that has something on it, starting at `start`, loading further ahead as
 * you scroll. Today is always shown (even when empty) so you know where "now" is.
 */
export function ScheduleView({
  start,
  getOccurrences,
  onPressEvent,
  onPressDay,
}: {
  start: Date;
  getOccurrences: (from: Date, to: Date) => Occurrence[];
  onPressEvent: (o: Occurrence) => void;
  onPressDay: (d: Date) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fromMs = startOfDay(start).getTime();
  const [days, setDays] = useState(PAGE_DAYS);
  // Restart the window whenever the start day changes (arrows / "Today").
  const [prevFrom, setPrevFrom] = useState(fromMs);
  if (prevFrom !== fromMs) {
    setPrevFrom(fromMs);
    setDays(PAGE_DAYS);
  }
  const listRef = useRef<SectionList<Occurrence, DaySection>>(null);
  useEffect(() => {
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  }, [fromMs]);

  const sections = useMemo<DaySection[]>(() => {
    const from = new Date(fromMs);
    const occs = getOccurrences(from, addDays(from, days));
    const today = startOfDay(new Date());
    const result: DaySection[] = [];
    let prev: Date | null = null;
    for (let i = 0; i < days; i++) {
      const day = addDays(from, i);
      const list = occurrencesForDay(occs, day).sort(
        (a, b) => Number(isAllDayLike(b)) - Number(isAllDayLike(a)) || a.start.getTime() - b.start.getTime(),
      );
      if (list.length === 0 && !isSameDay(day, today)) continue;
      result.push({ key: dayKey(day), day, newMonth: !prev || !isSameMonth(prev, day), data: list });
      prev = day;
    }
    return result;
  }, [getOccurrences, fromMs, days]);

  const loadMore = useCallback(() => setDays((d) => Math.min(d + PAGE_DAYS, 730)), []);
  const now = new Date();

  return (
    <SectionList
      ref={listRef}
      sections={sections}
      keyExtractor={(o) => o.key}
      stickySectionHeadersEnabled={false}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      contentContainerStyle={styles.content}
      renderSectionHeader={({ section }) => {
        const isToday = isSameDay(section.day, now);
        return (
          <View>
            {section.newMonth ? <Text style={styles.month}>{format(section.day, 'MMMM yyyy')}</Text> : null}
            <Pressable onPress={() => onPressDay(section.day)} style={styles.dayHeader} accessibilityLabel={`Open ${format(section.day, 'EEEE, MMMM d')}`}>
              <View style={[styles.dateBadge, isToday && styles.dateBadgeToday]}>
                <Text style={[styles.dateNum, isToday && styles.dateNumToday]}>{format(section.day, 'd')}</Text>
              </View>
              <Text style={[styles.weekday, isToday && styles.weekdayToday]}>
                {isToday ? 'Today' : format(section.day, 'EEEE')}
              </Text>
              {section.data.length === 0 ? <Text style={styles.nothing}>Nothing planned</Text> : null}
            </Pressable>
          </View>
        );
      }}
      renderItem={({ item: o }) => {
        const allDay = isAllDayLike(o);
        const past = o.end < now;
        return (
          <Pressable
            onPress={() => onPressEvent(o)}
            style={({ pressed }) => [styles.item, past && styles.past, pressed && styles.pressed]}
          >
            <View style={styles.time}>
              {allDay ? (
                <Text style={styles.timeMain}>All day</Text>
              ) : (
                <>
                  <Text style={styles.timeMain}>{formatTime(o.start)}</Text>
                  <Text style={styles.timeSub}>{formatTime(o.end)}</Text>
                </>
              )}
            </View>
            <View style={[styles.bar, { backgroundColor: o.color }]} />
            <View style={styles.body}>
              <View style={styles.titleRow}>
                {eventIconKey(o.event.emoji) ? <EventGlyph value={o.event.emoji} size={15} color={o.color} /> : null}
                <Text style={styles.title} numberOfLines={1}>
                  {eventLabel(o.event)}
                </Text>
                {o.event.recurrenceRule ? <Icon name="repeat" size={12} color={colors.textFaint} /> : null}
              </View>
              {o.event.location ? (
                <View style={styles.metaRow}>
                  <Icon name="map-pin" size={12} color={colors.textMuted} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {o.event.location}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={<Text style={styles.footer}>{`Showing ${days} days from ${format(fromMs, 'MMM d')}`}</Text>}
    />
  );
}

const useStyles = createStyles((colors) => ({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 32, paddingTop: 4 },
  month: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: 2,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, paddingBottom: 6 },
  dateBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  dateBadgeToday: { backgroundColor: colors.primary },
  dateNum: { fontFamily: fonts.display, fontSize: 16, color: colors.text },
  dateNumToday: { color: colors.onPrimary },
  weekday: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, color: colors.textMuted, textTransform: 'uppercase' },
  weekdayToday: { color: colors.primary },
  nothing: { fontSize: 13, color: colors.textFaint, marginLeft: 'auto' },
  item: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginLeft: 44,
    marginBottom: 6,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
  },
  past: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  time: { width: 56 },
  timeMain: { fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  timeSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  bar: { width: 3, borderRadius: 2 },
  body: { flex: 1, justifyContent: 'center', gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flexShrink: 1, fontSize: 13, color: colors.textMuted },
  footer: { textAlign: 'center', fontSize: 12, color: colors.textFaint, paddingVertical: spacing.lg },
}));
