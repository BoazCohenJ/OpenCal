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
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventGlyph, Icon } from '../components/Icon';
import { MonthYearSheet } from '../components/MonthYearPicker';
import { RepeatDeleteSheet, type RepeatDeleteChoice } from '../components/RepeatDeleteSheet';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { Button, Chip, IconButton, PressableScale, Segmented } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Event } from '../models/Event';
import type { EventTemplate } from '../models/Template';
import type { ScreenProps } from '../navigation/types';
import { BIRTHDAY_COLOR, BIRTHDAYS_CALENDAR_ID, birthdayIdOf } from '../services/birthdays';
import { occurrenceDayKey } from '../services/eventTimes';
import type { Occurrence } from '../services/occurrences';
import { confirmDeleteStamp, eventFromTemplate } from '../services/templates';
import { createStyles, fonts, radius, shadow, spacing, useTheme } from '../theme';
import { deepText, softBg } from '../utils/color';
import { dayKey, nextRoundedHour, parseDayKey, parseTimestamp, relativeLabel, WEEK_STARTS_ON } from '../utils/dates';
import { formatDuration } from '../utils/format';
import { newId } from '../utils/id';
import { endRuleBefore } from '../utils/recurrence';
import { DayView } from '../views/DayView';
import { MonthView } from '../views/MonthView';
import { ScheduleView } from '../views/ScheduleView';
import { shiftDate, type PendingMove, type SelectedOccurrence } from '../views/selection';
import type { TimeGridHandle } from '../views/TimeGrid';
import { WeekView } from '../views/WeekView';

type ViewMode = 'schedule' | 'day' | 'week' | 'month';

interface Range {
  start: Date;
  end: Date;
}

function rangeFor(mode: ViewMode, cursor: Date): Range {
  if (mode === 'day' || mode === 'schedule') return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) };
  if (mode === 'week') {
    const s = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
    return { start: s, end: addDays(s, 7) };
  }
  const s = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
  return { start: s, end: addDays(s, 42) };
}

/** Moves the cursor by `n` periods of the current view (Schedule steps by weeks). */
const shiftCursor = (mode: ViewMode, c: Date, n: number): Date =>
  n === 0 ? c : mode === 'day' ? addDays(c, n) : mode === 'month' ? addMonths(c, n) : addWeeks(c, n);

/** Names a page, so the same day/week/month keeps its component (and scroll position) as it slides. */
const pageKey = (mode: ViewMode, c: Date): string =>
  mode === 'month' ? format(c, 'yyyy-MM') : mode === 'week' ? dayKey(startOfWeek(c, { weekStartsOn: WEEK_STARTS_ON })) : dayKey(c);

interface RepeatItem {
  event: Event;
  /** The event's own date (see occurrenceDayKey) of the occurrence it was selected by, at local midnight. */
  day: Date;
}

export function CalendarScreen({ navigation }: ScreenProps<'Calendar'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    calendars,
    calendarsById,
    visibleCalendarIds,
    toggleCalendarVisibility,
    getOccurrences,
    events,
    saveEvent,
    saveEvents,
    deleteEvent,
    deleteEvents,
    templates,
    deleteTemplate,
    birthdays,
    getEffectiveColor,
  } = useCalendarContext();
  const showToast = useToast();
  const [mode, setMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selectionActive, setSelectionActive] = useState(false);
  const [slot, setSlot] = useState<Date | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  // Bulk delete waiting on answers for its repeating events (one sheet per event).
  const [repeatQueue, setRepeatQueue] = useState<{ plain: Event[]; repeating: RepeatItem[]; choices: RepeatDeleteChoice[] } | null>(
    null,
  );

  const range = useMemo(() => rangeFor(mode, cursor), [mode, cursor]);

  // Day, Week and Month are a strip of three pages: the previous and next period sit beside the
  // current one, so a swipe drags the neighbour in instead of revealing blank space.
  const [pageWidth, setPageWidth] = useState(0);
  const paging = mode !== 'schedule' && pageWidth > 0;
  const pages = useMemo(
    () =>
      (paging ? [-1, 0, 1] : [0]).map((offset) => {
        const c = shiftCursor(mode, cursor, offset);
        const r = rangeFor(mode, c);
        return { offset, cursor: c, range: r, key: pageKey(mode, c), occurrences: mode === 'schedule' ? [] : getOccurrences(r.start, r.end) };
      }),
    [paging, mode, cursor, getOccurrences],
  );
  // A fresh offset for every page set, created in the same render as the new pages, so the strip
  // re-centres on the page that just slid in without a frame of the old position.
  const currentKey = `${mode}:${pageKey(mode, cursor)}`;
  const [strip, setStrip] = useState(() => ({ key: currentKey, pan: new Animated.Value(0) }));
  if (strip.key !== currentKey) setStrip({ key: currentKey, pan: new Animated.Value(0) });
  const pan = strip.pan;
  const sliding = useRef(false);
  // Vertical scroll of the Day/Week page on screen; neighbours are lined up with it before a slide.
  const scrollY = useRef<number | null>(null);
  // Handles of the mounted Day/Week pages by page key (a stable map, mutated from callback refs).
  const [pageHandles] = useState(() => new Map<string, TimeGridHandle>());

  // Page transition for jumps (Today, month picker, view switches): a short slide or rise and fade.
  // Steps to a neighbouring page slide the strip instead and skip this.
  const transition = useState(() => new Animated.Value(1))[0];
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const skipFade = useRef(false);
  const cursorMs = cursor.getTime();
  useEffect(() => {
    if (skipFade.current) {
      skipFade.current = false;
      transition.setValue(1);
      return;
    }
    transition.setValue(0);
    Animated.timing(transition, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [cursorMs, mode, transition]);
  // Stable animated nodes (see Segmented): only rebuilt when the slide direction changes.
  const bodyMotion = useMemo(
    () => ({
      opacity: transition.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
      transform: [
        { translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [direction * 36, 0] }) },
        { translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [direction === 0 ? 10 : 0, 0] }) },
      ],
    }),
    [transition, direction],
  );

  const changeMode = (m: ViewMode) => {
    setDirection(0);
    setMode(m);
  };
  const syncNeighbours = () => {
    const y = scrollY.current;
    if (y === null) return;
    for (const p of pages) if (p.offset !== 0) pageHandles.get(p.key)?.scrollToY(y);
  };
  /** One period back or forward: slides the neighbouring page in, then makes it the current one. */
  const step = (dir: 1 | -1) => {
    if (sliding.current) return;
    if (!paging) {
      setDirection(dir);
      setCursor((c) => shiftCursor(mode, c, dir));
      return;
    }
    sliding.current = true;
    syncNeighbours();
    Animated.timing(pan, { toValue: -dir * pageWidth, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      sliding.current = false;
      skipFade.current = true;
      setCursor((c) => shiftCursor(mode, c, dir));
    });
  };
  // Swipe left/right on Day, Week and Month to move by one period. Only clearly horizontal
  // gestures are claimed, so vertical scrolling, taps and the event drags keep working.
  const springBack = () => Animated.spring(pan, { toValue: 0, useNativeDriver: false, speed: 30, bounciness: 4 }).start();
  const swipe = useRef({ enabled: false, paging, pan, step, springBack, syncNeighbours });
  useLayoutEffect(() => {
    swipe.current = { enabled: mode !== 'schedule' && !selectionActive, paging, pan, step, springBack, syncNeighbours };
  });
  // eslint-disable-next-line react-hooks/refs -- the handlers read refs when a gesture fires, never during render
  const [swipeResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        swipe.current.enabled && !sliding.current && Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => swipe.current.syncNeighbours(),
      // With neighbours on screen the strip follows the finger 1:1; otherwise it just gives a little.
      onPanResponderMove: (_, g) => swipe.current.pan.setValue(swipe.current.paging ? g.dx : g.dx * 0.55),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 70 || Math.abs(g.vx) > 0.45) swipe.current.step(g.dx < 0 ? 1 : -1);
        else swipe.current.springBack();
      },
      onPanResponderTerminate: () => swipe.current.springBack(),
    }),
  );

  const goToday = () => {
    const today = startOfDay(new Date());
    setDirection(today < cursor ? -1 : 1);
    setCursor(today);
  };

  /** From the month picker: the current month jumps to today, any other to its 1st. */
  const jumpToMonth = (month: Date) => {
    setMonthPickerOpen(false);
    const target = isSameMonth(month, new Date()) ? startOfDay(new Date()) : startOfMonth(month);
    if (target.getTime() === cursor.getTime()) return;
    setDirection(target < cursor ? -1 : 1);
    setCursor(target);
  };

  const now = new Date();
  const title =
    mode === 'schedule'
      ? format(cursor, 'MMMM')
      : mode === 'day'
      ? format(cursor, 'EEEE')
      : mode === 'week'
        ? `${format(range.start, 'MMM d')} – ${format(endOfWeek(range.start, { weekStartsOn: WEEK_STARTS_ON }), 'd')}`
        : format(cursor, 'MMMM');
  const eyebrow =
    mode === 'schedule'
      ? `From ${format(cursor, 'EEE, MMM d')}`
      : mode === 'day'
        ? format(cursor, 'MMMM d, yyyy')
        : mode === 'week'
          ? format(range.start, 'MMMM yyyy')
          : format(cursor, 'yyyy');
  const showingToday =
    mode === 'day' || mode === 'schedule'
      ? isSameDay(cursor, now)
      : mode === 'week'
        ? now >= range.start && now < range.end
        : isSameMonth(cursor, now);
  const positionLabel = relativeLabel(mode, mode === 'week' ? range.start : cursor, now);

  const defaultStart = (): Date => {
    if (isSameDay(cursor, new Date())) return nextRoundedHour();
    if (mode === 'month' && isSameMonth(cursor, new Date())) return nextRoundedHour();
    return setHours(startOfDay(cursor), 9);
  };

  const openEvent = (o: Occurrence) => {
    const birthdayId = birthdayIdOf(o.event);
    if (birthdayId) navigation.navigate('BirthdayEdit', { birthdayId });
    else navigation.navigate('EventEdit', { eventId: o.event.id });
  };
  const openDay = (d: Date) => {
    setDirection(0);
    setCursor(startOfDay(d));
    setMode('day');
  };

  /** Dropping a stamp on a tapped slot adds the event right away; the toast offers Undo. */
  const dropStamp = (template: EventTemplate, start: Date) => {
    const calendar = calendarsById[template.calendarId] ?? calendars[0];
    if (!calendar) return;
    const event = eventFromTemplate(template, start, calendar.id);
    saveEvent(event);
    showToast({
      icon: 'check',
      message: `Added ${template.title} · ${template.isAllDay ? format(start, 'EEE, MMM d') : format(start, 'EEE h:mm a')}`,
      actionLabel: 'Undo',
      onAction: () => deleteEvent(event.id),
    });
  };
  const newEventAt = (start: Date) =>
    navigation.navigate('EventEdit', { draft: { startDate: start.toISOString(), endDate: addHours(start, 1).toISOString() } });

  /**
   * Saves moves staged in selection mode (on Done, or when leaving the page). A one-off event just
   * moves. A moved occurrence of a repeating event is split off: the series skips that day and a
   * one-off copy is created at the new time; the whole series is moved from the event editor.
   * One Undo reverts everything.
   */
  const commitMoves = useCallback(
    (moves: PendingMove[]) => {
      const byId = new Map(events.map((e) => [e.id, e]));
      const originals = new Map<string, Event>();
      const changed = new Map<string, Event>();
      const created: Event[] = [];
      for (const { occurrence, delta } of moves) {
        const source = byId.get(occurrence.event.id);
        if (!source) continue;
        if (!originals.has(source.id)) originals.set(source.id, source);
        const startDate = shiftDate(occurrence.start, delta).toISOString();
        const endDate = shiftDate(occurrence.end, delta).toISOString();
        if (source.recurrenceRule) {
          const series = changed.get(source.id) ?? source;
          const skippedDates = [...new Set([...(series.skippedDates ?? []), occurrenceDayKey(source, occurrence.start)])].sort();
          changed.set(source.id, { ...series, skippedDates });
          created.push({ ...source, id: newId(), recurrenceRule: undefined, pauseWindows: [], skippedDates: [], startDate, endDate });
        } else {
          changed.set(source.id, { ...source, startDate, endDate });
        }
      }
      if (!changed.size) return;
      saveEvents([...changed.values(), ...created]);
      const n = moves.length;
      showToast({
        icon: 'check',
        message: `Moved ${n} event${n === 1 ? '' : 's'}${created.length ? ` · ${created.length} split from a series` : ''}`,
        actionLabel: 'Undo',
        onAction: () => {
          if (created.length) deleteEvents(created.map((e) => e.id));
          saveEvents([...originals.values()]);
        },
      });
    },
    [events, saveEvents, deleteEvents, showToast],
  );

  /**
   * Applies a bulk delete once every repeating event has an answer. "Only this" skips that day in the
   * series, "this and following" ends it the day before (or deletes it from its first day). One
   * Undo restores everything exactly as it was.
   */
  const applyDeletion = useCallback(
    (plain: Event[], repeating: RepeatItem[], choices: RepeatDeleteChoice[]) => {
      const originals: Event[] = [...plain];
      const deleteIds = plain.map((e) => e.id);
      const updated: Event[] = [];
      let occurrencesRemoved = 0;
      let seriesEnded = 0;
      repeating.forEach(({ event, day }, i) => {
        const choice = choices[i];
        if (!choice || choice === 'keep' || !event.recurrenceRule) return;
        originals.push(event);
        const firstDay = parseDayKey(occurrenceDayKey(event, parseTimestamp(event.startDate)));
        if (choice === 'all' || (choice === 'following' && day <= firstDay)) {
          deleteIds.push(event.id);
        } else if (choice === 'this') {
          const k = dayKey(day);
          updated.push({ ...event, skippedDates: [...new Set([...(event.skippedDates ?? []), k])].sort() });
          occurrencesRemoved++;
        } else {
          updated.push({ ...event, recurrenceRule: endRuleBefore(event.recurrenceRule, day) });
          seriesEnded++;
        }
      });
      if (!originals.length) return;
      if (deleteIds.length) deleteEvents(deleteIds);
      if (updated.length) saveEvents(updated);
      const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
      const parts = [
        deleteIds.length ? plural(deleteIds.length, 'event') : '',
        occurrencesRemoved ? plural(occurrencesRemoved, 'occurrence') : '',
        seriesEnded ? `${seriesEnded === 1 ? 'a series' : `${seriesEnded} series`} from the selected day on` : '',
      ].filter(Boolean);
      showToast({ icon: 'check', message: `Deleted ${parts.join(', ')}`, actionLabel: 'Undo', onAction: () => saveEvents(originals) });
    },
    [deleteEvents, saveEvents, showToast],
  );

  /** Bulk delete from the selection toolbar. Repeating events ask first, one sheet each. */
  const removeEvents = useCallback(
    (picked: SelectedOccurrence[]) => {
      const plain: Event[] = [];
      const repeating: RepeatItem[] = [];
      for (const p of picked) {
        const event = events.find((e) => e.id === p.eventId);
        if (!event) continue;
        if (event.recurrenceRule) repeating.push({ event, day: parseDayKey(occurrenceDayKey(event, p.occurrenceStart)) });
        else plain.push(event);
      }
      if (repeating.length) setRepeatQueue({ plain, repeating, choices: [] });
      else applyDeletion(plain, [], []);
    },
    [events, applyDeletion],
  );

  const answerRepeat = (choice: RepeatDeleteChoice) => {
    if (!repeatQueue) return;
    const choices = [...repeatQueue.choices, choice];
    if (choices.length < repeatQueue.repeating.length) {
      setRepeatQueue({ ...repeatQueue, choices });
      return;
    }
    setRepeatQueue(null);
    applyDeletion(repeatQueue.plain, repeatQueue.repeating, choices);
  };
  const currentRepeat = repeatQueue ? (repeatQueue.repeating[repeatQueue.choices.length] ?? null) : null;

  const renderPage = (page: (typeof pages)[number]) => {
    const active = page.offset === 0;
    const setRef = (handle: TimeGridHandle | null) => {
      if (handle) pageHandles.set(page.key, handle);
      else pageHandles.delete(page.key);
    };
    const onScrollY = active
      ? (y: number) => {
          scrollY.current = y;
        }
      : undefined;
    if (mode === 'month') {
      return <MonthView month={page.cursor} occurrences={page.occurrences} onPressDay={openDay} onPressEvent={openEvent} />;
    }
    if (mode === 'week') {
      return (
        <WeekView
          ref={setRef}
          active={active}
          onScrollY={onScrollY}
          weekStart={page.range.start}
          occurrences={page.occurrences}
          onPressEvent={openEvent}
          onPressSlot={setSlot}
          onPressDay={openDay}
          onCommitMoves={commitMoves}
          onDeleteEvents={removeEvents}
          onSelectionModeChange={active ? setSelectionActive : undefined}
        />
      );
    }
    return (
      <DayView
        ref={setRef}
        active={active}
        onScrollY={onScrollY}
        date={page.cursor}
        occurrences={page.occurrences}
        onPressEvent={openEvent}
        onPressSlot={setSlot}
        onCommitMoves={commitMoves}
        onDeleteEvents={removeEvents}
        onSelectionModeChange={active ? setSelectionActive : undefined}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => setMonthPickerOpen(true)} style={styles.eyebrowButton} accessibilityLabel="Choose a month">
            <Text style={styles.eyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
          </Pressable>
          <View style={styles.headerActions}>
            <View style={styles.navPill}>
              <Pressable onPress={() => step(-1)} hitSlop={6} style={styles.navArrow} accessibilityLabel="Previous">
                <Icon name="chevron-left" size={18} />
              </Pressable>
              <Pressable
                onPress={goToday}
                disabled={showingToday}
                hitSlop={4}
                accessibilityLabel={showingToday ? positionLabel : `${positionLabel}. Go to today`}
              >
                <Text style={[styles.todayText, showingToday && styles.todayTextOn]} numberOfLines={1}>
                  {positionLabel}
                </Text>
              </Pressable>
              <Pressable onPress={() => step(1)} hitSlop={6} style={styles.navArrow} accessibilityLabel="Next">
                <Icon name="chevron-right" size={18} />
              </Pressable>
            </View>
            <IconButton icon="settings" onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" />
          </View>
        </View>
        <Pressable onPress={() => setMonthPickerOpen(true)} style={styles.titleButton} accessibilityLabel={`${title}. Choose a month`}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
          <Icon name="chevron-down" size={22} color={colors.textFaint} strokeWidth={2.5} />
        </Pressable>
        <Segmented
          options={[
            { value: 'schedule', label: 'Schedule' },
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value={mode}
          onChange={changeMode}
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
          {birthdays.length ? (
            <Chip
              label="Birthdays"
              color={BIRTHDAY_COLOR}
              selected={visibleCalendarIds.includes(BIRTHDAYS_CALENDAR_ID)}
              onPress={() => toggleCalendarVisibility(BIRTHDAYS_CALENDAR_ID)}
            />
          ) : null}
        </ScrollView>
      </View>

      <Animated.View style={[styles.body, bodyMotion]} {...swipeResponder.panHandlers}>
        {mode === 'schedule' ? (
          <ScheduleView start={cursor} getOccurrences={getOccurrences} onPressEvent={openEvent} onPressDay={openDay} />
        ) : (
          <View style={styles.flex} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
            {paging ? (
              <Animated.View
                style={[styles.strip, { width: pageWidth * 3, transform: [{ translateX: -pageWidth }, { translateX: pan }] }]}
              >
                {pages.map((page) => (
                  <View key={page.key} style={[{ width: pageWidth }, page.offset !== 0 && styles.inert]}>
                    {renderPage(page)}
                  </View>
                ))}
              </Animated.View>
            ) : (
              renderPage(pages[0]!)
            )}
          </View>
        )}
      </Animated.View>

      {!selectionActive ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.dock, shadow]}>
            <PressableScale
              containerStyle={styles.flex}
              style={styles.nlInput}
              scaleTo={0.98}
              onPress={() => navigation.navigate('QuickAdd')}
              accessibilityLabel="Quick add with natural language"
            >
              <Icon name="sparkles" size={18} color={colors.primary} />
              <Text style={styles.nlPlaceholder} numberOfLines={1}>
                “Lunch with John Fri 1pm at Cafe X”
              </Text>
            </PressableScale>
            <PressableScale
              style={styles.roundButton}
              scaleTo={0.9}
              onPress={() => navigation.navigate('Stamp', { start: defaultStart().toISOString() })}
              accessibilityLabel="Add from a stamp"
            >
              <Icon name="stamp" size={20} color={colors.onDock} />
            </PressableScale>
            <PressableScale
              style={styles.fab}
              scaleTo={0.9}
              onPress={() => newEventAt(defaultStart())}
              accessibilityLabel="New event"
            >
              <Icon name="plus" size={24} color={colors.onPrimary} strokeWidth={2.5} />
            </PressableScale>
          </View>
        </View>
      ) : null}

      <RepeatDeleteSheet
        item={currentRepeat}
        color={currentRepeat ? getEffectiveColor(currentRepeat.event) : colors.primary}
        position={(repeatQueue?.choices.length ?? 0) + 1}
        total={repeatQueue?.repeating.length ?? 0}
        onChoose={answerRepeat}
        onCancel={() => setRepeatQueue(null)}
      />

      <MonthYearSheet visible={monthPickerOpen} onClose={() => setMonthPickerOpen(false)} value={cursor} onSelect={jumpToMonth} />

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
          <Text style={styles.slotHeading}>DROP A STAMP · ADDS INSTANTLY · HOLD TO DELETE</Text>
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
                    if (s) dropStamp(t, s);
                  }}
                  onLongPress={() => void confirmDeleteStamp(t, deleteTemplate)}
                  delayLongPress={400}
                  accessibilityHint="Long-press to delete this stamp"
                >
                  <View style={[styles.stampGlyph, { backgroundColor: softBg(t.color ?? calendarsById[t.calendarId]?.color ?? colors.primary) }]}>
                    <EventGlyph value={t.emoji} fallback="event" size={18} color={deepText(t.color ?? calendarsById[t.calendarId]?.color ?? colors.primary)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stampName}>{t.name}</Text>
                    <Text style={styles.stampMeta}>{t.isAllDay ? 'All day' : formatDuration(t.durationMinutes)}</Text>
                  </View>
                  <Icon name="plus" size={18} color={colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Sheet>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: -spacing.md },
  eyebrowButton: { flexShrink: 1 },
  eyebrow: { flexShrink: 1, fontFamily: fonts.displayItalic, fontSize: 17, color: colors.primary },
  titleButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  title: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 42, lineHeight: 50, color: colors.text, letterSpacing: -1.2 },
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
  todayText: { fontSize: 13, fontWeight: '700', color: colors.primary, paddingHorizontal: 4, maxWidth: 120 },
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
    backgroundColor: colors.dock,
  },
  flex: { flex: 1 },
  strip: { flex: 1, flexDirection: 'row' },
  // Neighbouring pages are only for looking at while they slide in.
  inert: { pointerEvents: 'none' },
  nlInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 46,
  },
  nlPlaceholder: { flex: 1, color: colors.onDockMuted, fontSize: 14, fontFamily: fonts.displayItalic },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.dockButton,
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
}));
