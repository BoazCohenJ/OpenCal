import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventGlyph, Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Button, Chip, IconButton, Segmented } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import type { Occurrence } from '../services/occurrences';
import { colors, fonts, radius, shadow, spacing } from '../theme';
import { deepText, softBg } from '../utils/color';
import { nextRoundedHour, WEEK_STARTS_ON } from '../utils/dates';
import { formatDuration } from '../utils/format';
import { DayView } from '../views/DayView';
import { MonthView } from '../views/MonthView';
import { WeekView } from '../views/WeekView';

type ViewMode = 'day' | 'week' | 'month';

export function CalendarScreen({ navigation }: ScreenProps<'Calendar'>) {
  const insets = useSafeAreaInsets();
  const { calendars, calendarsById, visibleCalendarIds, toggleCalendarVisibility, getOccurrences, events, saveEvents, templates } =
    useCalendarContext();
  const [mode, setMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selectionActive, setSelectionActive] = useState(false);
  const [slot, setSlot] = useState<Date | null>(null);

  const range = useMemo(() => {
    if (mode === 'day') return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) };
    if (mode === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
      return { start: s, end: addDays(s, 7) };
    }
    const s = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    return { start: s, end: addDays(s, 42) };
  }, [mode, cursor]);

  const occurrences = useMemo(() => getOccurrences(range.start, range.end), [getOccurrences, range]);

  const step = (dir: 1 | -1) =>
    setCursor((c) => (mode === 'day' ? addDays(c, dir) : mode === 'week' ? addWeeks(c, dir) : addMonths(c, dir)));
  const goToday = () => setCursor(startOfDay(new Date()));

  const now = new Date();
  const title =
    mode === 'day'
      ? format(cursor, 'EEEE')
      : mode === 'week'
        ? `${format(range.start, 'MMM d')} – ${format(endOfWeek(range.start, { weekStartsOn: WEEK_STARTS_ON }), 'd')}`
        : format(cursor, 'MMMM');
  const eyebrow =
    mode === 'day' ? format(cursor, 'MMMM d, yyyy') : mode === 'week' ? format(range.start, 'MMMM yyyy') : format(cursor, 'yyyy');
  const showingToday =
    mode === 'day' ? isSameDay(cursor, now) : mode === 'week' ? now >= range.start && now < range.end : isSameMonth(cursor, now);

  const defaultStart = (): Date => {
    if (isSameDay(cursor, new Date())) return nextRoundedHour();
    if (mode === 'month' && isSameMonth(cursor, new Date())) return nextRoundedHour();
    return setHours(startOfDay(cursor), 9);
  };

  const openEvent = (o: Occurrence) => navigation.navigate('EventEdit', { eventId: o.event.id });
  const openDay = (d: Date) => {
    setCursor(startOfDay(d));
    setMode('day');
  };
  const newEventAt = (start: Date) =>
    navigation.navigate('EventEdit', { draft: { startDate: start.toISOString(), endDate: addHours(start, 1).toISOString() } });

  const moveEvents = useCallback(
    (ids: string[], deltaMinutes: number) => {
      const ms = deltaMinutes * 60000;
      saveEvents(
        events
          .filter((e) => ids.includes(e.id))
          .map((e) => ({
            ...e,
            startDate: new Date(new Date(e.startDate).getTime() + ms).toISOString(),
            endDate: new Date(new Date(e.endDate).getTime() + ms).toISOString(),
          })),
      );
    },
    [events, saveEvents],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
          <View style={styles.headerActions}>
            <View style={styles.navPill}>
              <Pressable onPress={() => step(-1)} hitSlop={6} style={styles.navArrow} accessibilityLabel="Previous">
                <Icon name="chevron-left" size={18} />
              </Pressable>
              <Pressable onPress={goToday} disabled={showingToday} hitSlop={4} accessibilityLabel="Go to today">
                <Text style={[styles.todayText, showingToday && styles.todayTextOn]}>Today</Text>
              </Pressable>
              <Pressable onPress={() => step(1)} hitSlop={6} style={styles.navArrow} accessibilityLabel="Next">
                <Icon name="chevron-right" size={18} />
              </Pressable>
            </View>
            <IconButton icon="settings" onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" />
          </View>
        </View>
        <Pressable onPress={goToday} accessibilityLabel="Go to today">
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
        </Pressable>
        <Segmented
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarChips}>
          {calendars.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              color={c.color}
              selected={visibleCalendarIds.includes(c.id)}
              onPress={() => toggleCalendarVisibility(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.body}>
        {mode === 'month' ? (
          <MonthView month={cursor} occurrences={occurrences} onPressDay={openDay} onPressEvent={openEvent} />
        ) : mode === 'week' ? (
          <WeekView weekStart={range.start} occurrences={occurrences} onPressEvent={openEvent} onPressSlot={setSlot} onPressDay={openDay} />
        ) : (
          <DayView
            date={cursor}
            occurrences={occurrences}
            onPressEvent={openEvent}
            onPressSlot={setSlot}
            onMoveEvents={moveEvents}
            onSelectionModeChange={setSelectionActive}
          />
        )}
      </View>

      {!selectionActive ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.dock, shadow]}>
            <Pressable
              style={({ pressed }) => [styles.nlInput, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate('QuickAdd')}
              accessibilityLabel="Quick add with natural language"
            >
              <Icon name="sparkles" size={18} color={colors.primary} />
              <Text style={styles.nlPlaceholder} numberOfLines={1}>
                “Lunch with John Fri 1pm at Cafe X”
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.roundButton, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate('Stamp', { start: defaultStart().toISOString() })}
              accessibilityLabel="Add from a stamp"
            >
              <Icon name="stamp" size={20} color={colors.onInk} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
              onPress={() => newEventAt(defaultStart())}
              accessibilityLabel="New event"
            >
              <Icon name="plus" size={24} color={colors.onInk} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <Sheet visible={!!slot} onClose={() => setSlot(null)} title={slot ? format(slot, 'EEE, MMM d · h:mm a') : ''} actionLabel="Close">
        <View style={styles.slotSheet}>
          <Button
            title="New event here"
            onPress={() => {
              const s = slot;
              setSlot(null);
              if (s) newEventAt(s);
            }}
          />
          <Text style={styles.slotHeading}>DROP A STAMP</Text>
          {templates.length === 0 ? (
            <Pressable
              onPress={() => {
                setSlot(null);
                navigation.navigate('TemplateEdit');
              }}
            >
              <Text style={styles.slotEmpty}>No stamps yet. Tap to create one (e.g. “Coffee with John”).</Text>
            </Pressable>
          ) : (
            <ScrollView style={{ maxHeight: 280 }}>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  style={({ pressed }) => [styles.stampRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => {
                    const s = slot;
                    setSlot(null);
                    if (s) navigation.navigate('Stamp', { templateId: t.id, start: s.toISOString() });
                  }}
                >
                  <View style={[styles.stampGlyph, { backgroundColor: softBg(t.color ?? calendarsById[t.calendarId]?.color ?? colors.primary) }]}>
                    <EventGlyph value={t.emoji} fallback="event" size={18} color={deepText(t.color ?? calendarsById[t.calendarId]?.color ?? colors.primary)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stampName}>{t.name}</Text>
                    <Text style={styles.stampMeta}>{t.isAllDay ? 'All day' : formatDuration(t.durationMinutes)}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textFaint} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: -spacing.md },
  eyebrow: { flexShrink: 1, fontFamily: fonts.displayItalic, fontSize: 17, color: colors.primary },
  title: { fontFamily: fonts.displayBold, fontSize: 42, lineHeight: 50, color: colors.text, letterSpacing: -1.2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 2,
  },
  navArrow: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  todayText: { fontSize: 13, fontWeight: '700', color: colors.primary, paddingHorizontal: 2 },
  todayTextOn: { color: colors.textFaint },
  calendarChips: { gap: 8, paddingVertical: 2 },
  body: {
    flex: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  bottomBar: { paddingHorizontal: spacing.md, paddingTop: 10, backgroundColor: colors.surface },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  nlInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 46,
  },
  nlPlaceholder: { flex: 1, color: 'rgba(255, 252, 247, 0.55)', fontSize: 14, fontFamily: fonts.displayItalic },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 252, 247, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  slotSheet: { gap: 12 },
  slotHeading: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.4, marginTop: 4 },
  slotEmpty: { fontSize: 14, color: colors.primary, lineHeight: 20 },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.md },
  stampGlyph: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stampName: { fontSize: 16, fontWeight: '600', color: colors.text },
  stampMeta: { fontSize: 13, color: colors.textMuted },
});
