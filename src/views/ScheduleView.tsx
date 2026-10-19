import { addDays, format, isSameDay, isSameMonth, startOfDay } from 'date-fns';
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { EventGlyph, eventIconKey, Icon } from '../components/Icon';
import { occurrencesByDay, type Occurrence } from '../services/occurrences';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { dayKey, formatTime } from '../utils/dates';
import { eventLabel } from '../utils/format';

const PAGE_DAYS = 60;
const MAX_DAYS = 730;

interface DayRow {
  day: Date;
  data: Occurrence[];
}

interface DaySection {
  key: string;
  day: Date;
  /** First section of a new month: shows a month divider above the day. */
  newMonth: boolean;
  data: Occurrence[];
}

/**
 * The days from `fromMs` that have something on them (plus today), worked out a page at a time and
 * kept, so loading more only works out the new page.
 */
function dayPages(getOccurrences: (from: Date, to: Date) => Occurrence[], fromMs: number): (page: number) => DayRow[] {
  const cache = new Map<number, DayRow[]>();
  return (page) => {
    const cached = cache.get(page);
    if (cached) return cached;
    const from = addDays(new Date(fromMs), page * PAGE_DAYS);
    const count = Math.min(PAGE_DAYS, MAX_DAYS - page * PAGE_DAYS);
    const byDay = occurrencesByDay(getOccurrences(from, addDays(from, count)), from, count);
    const today = startOfDay(new Date());
    const rows: DayRow[] = [];
    for (let i = 0; i < count; i++) {
      const day = addDays(from, i);
      const data = byDay[i]!.sort(
        (a, b) => Number(b.event.isAllDay) - Number(a.event.isAllDay) || a.start.getTime() - b.start.getTime(),
      );
      if (data.length || isSameDay(day, today)) rows.push({ day, data });
    }
    cache.set(page, rows);
    return rows;
  };
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

  // A short list asks for more pages straight away; redoing every earlier day each time held up taps for seconds.
  const pageRows = useMemo(() => dayPages(getOccurrences, fromMs), [getOccurrences, fromMs]);

  const sections = useMemo<DaySection[]>(() => {
    const result: DaySection[] = [];
    let prev: Date | null = null;
    for (let page = 0; page * PAGE_DAYS < days; page++) {
      for (const { day, data } of pageRows(page)) {
        result.push({ key: dayKey(day), day, newMonth: !prev || !isSameMonth(prev, day), data });
        prev = day;
      }
    }
    return result;
  }, [pageRows, days]);

  // A transition, so a tap (like the View button) is handled between pages instead of after them all.
  const loadMore = useCallback(() => startTransition(() => setDays((d) => Math.min(d + PAGE_DAYS, MAX_DAYS))), []);
  const now = new Date();

  return (
    <SectionList
      ref={listRef}
      sections={sections}
      keyExtractor={(o) => o.key}
      stickySectionHeadersEnabled={false}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={40}
      windowSize={7}
      removeClippedSubviews
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
        const allDay = o.event.isAllDay;
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
