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
import { Sheet } from '../components/Sheet';
import { Button, Chip, IconButton, Segmented } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import type { Occurrence } from '../services/occurrences';
import { colors, radius, shadow, spacing } from '../theme';
import { nextRoundedHour, WEEK_STARTS_ON } from '../utils/dates';
import { formatDuration } from '../utils/format';
import { DayView } from '../views/DayView';
import { MonthView } from '../views/MonthView';
import { WeekView } from '../views/WeekView';

type ViewMode = 'day' | 'week' | 'month';

export function CalendarScreen({ navigation }: ScreenProps<'Calendar'>) {
  const insets = useSafeAreaInsets();
  const { calendars, visibleCalendarIds, toggleCalendarVisibility, getOccurrences, events, saveEvents, templates } =
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
  const title = mode === 'day' ? format(cursor, 'EEEE') : mode === 'week' ? format(range.start, 'MMMM yyyy') : format(cursor, 'MMMM');
  const subtitle =
    mode === 'day'
      ? format(cursor, 'MMMM d, yyyy')
      : mode === 'week'
        ? `${format(range.start, 'MMM d')} – ${format(endOfWeek(range.start, { weekStartsOn: WEEK_STARTS_ON }), 'MMM d')}`
        : format(cursor, 'yyyy');
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
          <Pressable onPress={goToday} style={styles.titleBlock} accessibilityLabel="Go to today">
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </Pressable>
          <View style={styles.headerActions}>
            <IconButton icon="‹" onPress={() => step(-1)} accessibilityLabel="Previous" />
            {!showingToday ? <Button small variant="secondary" title="Today" onPress={goToday} /> : null}
            <IconButton icon="›" onPress={() => step(1)} accessibilityLabel="Next" />
            <IconButton icon="⚙︎" onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" />
          </View>
        </View>
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
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            style={({ pressed }) => [styles.nlInput, pressed && { opacity: 0.8 }]}
            onPress={() => navigation.navigate('QuickAdd')}
            accessibilityLabel="Quick add with natural language"
          >
            <Text style={styles.nlIcon}>✨</Text>
            <Text style={styles.nlPlaceholder} numberOfLines={1}>
              “Lunch with John Fri 1pm at Cafe X”
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.roundButton, pressed && { opacity: 0.8 }]}
            onPress={() => navigation.navigate('Stamp', { start: defaultStart().toISOString() })}
            accessibilityLabel="Add from a stamp"
          >
            <Text style={styles.roundIcon}>🔖</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.fab, shadow, pressed && { opacity: 0.85 }]}
            onPress={() => newEventAt(defaultStart())}
            accessibilityLabel="New event"
          >
            <Text style={styles.fabIcon}>＋</Text>
          </Pressable>
        </View>
      ) : null}

      <Sheet visible={!!slot} onClose={() => setSlot(null)} title={slot ? format(slot, 'EEE, MMM d · h:mm a') : ''} actionLabel="Close">
        <View style={styles.slotSheet}>
          <Button
            title="＋ New event here"
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
              <Text style={styles.slotEmpty}>No stamps yet. Tap to create one (e.g. “☕ Coffee with John”).</Text>
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
                  <Text style={styles.stampEmoji}>{t.emoji ?? '🔖'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stampName}>{t.name}</Text>
                    <Text style={styles.stampMeta}>{t.isAllDay ? 'All day' : formatDuration(t.durationMinutes)}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: spacing.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleBlock: { flexShrink: 1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calendarChips: { gap: 8, paddingVertical: 2 },
  body: { flex: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  nlInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 46,
  },
  nlIcon: { fontSize: 16 },
  nlPlaceholder: { flex: 1, color: colors.textFaint, fontSize: 14 },
  roundButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  roundIcon: { fontSize: 20 },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  fabIcon: { color: '#FFFFFF', fontSize: 26, fontWeight: '600', marginTop: -2 },
  slotSheet: { gap: 12 },
  slotHeading: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, marginTop: 4 },
  slotEmpty: { fontSize: 14, color: colors.primary, lineHeight: 20 },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.md },
  stampEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  stampName: { fontSize: 16, fontWeight: '600', color: colors.text },
  stampMeta: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textFaint },
});
