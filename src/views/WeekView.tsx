import { addDays, format, isSameDay } from 'date-fns';
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SpanBar, SPAN_LANE_HEIGHT } from '../components/SpanBar';
import { EventGlyph, eventIconKey } from '../components/Icon';
import { occurrencesByDay, type Occurrence } from '../services/occurrences';
import { createStyles, fonts } from '../theme';
import { readableOn } from '../utils/color';
import { atMinutes, dayKey, minutesSinceMidnight } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { isAllDayLike, layoutSpans, layoutTimed, PX_PER_MIN, slotMinutesFromPress } from './layout';
import { SelectableBlock, SelectionCheckbox, SelectionToolbar, TOOLBAR_CLEARANCE, useEventSelection, type PendingMove, type SelectedOccurrence } from './selection';
import { GRID_HEIGHT, GUTTER_WIDTH, HourGutter, HourLines, NowLine, type TimeGridHandle } from './TimeGrid';

const MAX_SPAN_LANES = 4;

export function WeekView({
  weekStart,
  occurrences,
  onPressEvent,
  onPressSlot,
  onPressDay,
  onCommitMoves,
  onDeleteEvents,
  onSelectionModeChange,
  active = true,
  onScrollY,
  ref,
}: {
  weekStart: Date;
  occurrences: Occurrence[];
  onPressEvent: (o: Occurrence) => void;
  onPressSlot: (start: Date) => void;
  onPressDay: (d: Date) => void;
  /** Saves moves staged in selection mode (on Done, or when leaving the page). */
  onCommitMoves: (moves: PendingMove[]) => void;
  onDeleteEvents: (picked: SelectedOccurrence[]) => void;
  onSelectionModeChange?: (active: boolean) => void;
  /** False for the neighbouring pages drawn beside the current one while swiping. */
  active?: boolean;
  onScrollY?: (y: number) => void;
  ref?: React.Ref<TimeGridHandle>;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const today = new Date();
  const colWidth = width / 7;
  // Checked events drag sideways a whole column (day) at a time.
  const {
    selected,
    selectionMode,
    hasPending,
    summary,
    select,
    toggle,
    move,
    done,
    cancel,
    selectedOccurrences,
    displayed,
    drag,
    offset,
    scrollEnabled,
  } = useEventSelection({ resetKey: `${dayKey(weekStart)}:${active}`, columnWidth: colWidth, occurrences, onCommitMoves, onSelectionModeChange });

  const perDay = useMemo(
    () => {
      const lists = occurrencesByDay(displayed, weekStart, 7);
      return lists.map((occs, i) => {
        const day = addDays(weekStart, i);
        return { day, timed: layoutTimed(occs.filter((o) => !isAllDayLike(o)), day, 17) };
      });
    },
    [weekStart, displayed],
  );
  // All-day and multi-day events run across the days they cover as one bar each.
  const spans = useMemo(() => layoutSpans(displayed, weekStart), [displayed, weekStart]);
  const spanLanes = Math.min(spans.lanes, MAX_SPAN_LANES);
  const hiddenSpans = spans.segments.filter((s) => s.lane >= MAX_SPAN_LANES).length;
  const selectedHasRecurring = occurrences.some((o) => selected.includes(o.key) && o.event.recurrenceRule);

  useImperativeHandle(ref, () => ({ scrollToY: (y) => scrollRef.current?.scrollTo({ y, animated: false }) }), []);

  useEffect(() => {
    const minutes = Math.max(0, minutesSinceMidnight(new Date()) - 120);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.min(minutes, 7 * 60) * PX_PER_MIN, animated: false }), 50);
    return () => clearTimeout(id);
  }, [weekStart]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ width: GUTTER_WIDTH }} />
        {perDay.map(({ day }) => {
          const isToday = isSameDay(day, today);
          return (
            <Pressable key={dayKey(day)} style={styles.dayHeader} onPress={() => onPressDay(day)}>
              <Text style={[styles.dow, isToday && styles.todayText]}>{format(day, 'EEE')}</Text>
              <View style={[styles.dateBadge, isToday && styles.dateBadgeToday]}>
                <Text style={[styles.dateText, isToday && styles.dateTextToday]}>{format(day, 'd')}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {spans.segments.length > 0 ? (
        <View style={styles.allDayRow}>
          <View style={[styles.allDayGutter, { width: GUTTER_WIDTH }]}>
            <Text style={styles.allDayLabel}>all-day</Text>
          </View>
          <View style={styles.allDayBars}>
            <View style={{ height: spanLanes * SPAN_LANE_HEIGHT }}>
              {spans.segments
                .filter((s) => s.lane < MAX_SPAN_LANES)
                .map((s) => (
                  <SpanBar
                    key={`${s.occ.key}@${s.col}`}
                    occ={s.occ}
                    fromPrev={s.fromPrev}
                    toNext={s.toNext}
                    onPress={() => onPressEvent(s.occ)}
                    style={{ position: 'absolute', top: s.lane * SPAN_LANE_HEIGHT, left: `${(s.col / 7) * 100}%`, width: `${(s.length / 7) * 100}%` }}
                  />
                ))}
            </View>
            {hiddenSpans > 0 ? <Text style={styles.more}>+{hiddenSpans} more</Text> : null}
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        onScroll={onScrollY ? (e) => onScrollY(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: selectionMode ? TOOLBAR_CLEARANCE : 8 }}
      >
        <View style={[styles.grid, { height: GRID_HEIGHT }]}>
          <HourGutter />
          <View style={styles.columns} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            <HourLines />
            {width > 0 &&
              perDay.map(({ day, timed }, i) => {
                const hasSelected = timed.some((pos) => selected.includes(pos.occ.key));
                return (
                  <View
                    key={dayKey(day)}
                    style={[
                      styles.dayColumn,
                      { left: i * colWidth, width: colWidth },
                      isSameDay(day, today) && styles.todayColumn,
                      // Keep dragged events above the neighbouring columns they slide over.
                      hasSelected && styles.raisedColumn,
                    ]}
                  >
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      onPress={(e) => (selectionMode ? done() : onPressSlot(atMinutes(day, slotMinutesFromPress(e))))}
                    />
                    {timed.map((pos) => {
                      const inner = colWidth - 2;
                      const isSelected = selected.includes(pos.occ.key);
                      return (
                        <SelectableBlock
                          key={pos.occ.key}
                          style={[
                            styles.block,
                            {
                              top: pos.top,
                              height: pos.height - 1,
                              left: 1 + pos.x * inner,
                              width: pos.w * inner - 1,
                              backgroundColor: pos.occ.color,
                              borderLeftColor: pos.occ.color,
                            },
                          ]}
                          selectedStyle={[styles.blockSelected, { borderColor: readableOn(pos.occ.color) }]}
                          selected={isSelected}
                          selectionMode={selectionMode}
                          drag={drag}
                          offset={offset}
                          onOpen={() => onPressEvent(pos.occ)}
                          onToggle={() => toggle(pos.occ)}
                          onLongPress={() => select(pos.occ)}
                          accessibilityLabel={pos.occ.event.title}
                        >
                          {selectionMode ? (
                            <View style={styles.checkboxCorner}>
                              <SelectionCheckbox color={pos.occ.color} checked={isSelected} size={13} />
                            </View>
                          ) : null}
                          {pos.height > 40 && eventIconKey(pos.occ.event.emoji) ? (
                            <EventGlyph value={pos.occ.event.emoji} size={11} color={readableOn(pos.occ.color)} />
                          ) : null}
                          <Text numberOfLines={pos.height > 40 ? 3 : 1} style={[styles.blockText, { color: readableOn(pos.occ.color) }]}>
                            {eventLabel(pos.occ.event)}
                          </Text>
                        </SelectableBlock>
                      );
                    })}
                    {isSameDay(day, today) ? <NowLine /> : null}
                  </View>
                );
              })}
          </View>
        </View>
      </ScrollView>

      {selectionMode ? (
        <SelectionToolbar
          count={selected.length}
          summary={summary}
          hasPending={hasPending}
          hasRecurring={selectedHasRecurring}
          showDayNudges
          onMove={move}
          onDelete={() => {
            onDeleteEvents(selectedOccurrences());
            cancel();
          }}
          onCancel={cancel}
          onDone={done}
        />
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: 'row', paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  dayHeader: { flex: 1, alignItems: 'center', gap: 2 },
  dow: { fontSize: 10, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  todayText: { color: colors.primary },
  dateBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dateBadgeToday: { backgroundColor: colors.primary },
  dateText: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
  dateTextToday: { color: colors.onPrimary },
  allDayRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, paddingVertical: 3 },
  allDayGutter: { justifyContent: 'center', alignItems: 'flex-end', paddingRight: 8 },
  allDayLabel: { fontSize: 10, color: colors.textFaint },
  allDayBars: { flex: 1, paddingHorizontal: 1 },
  more: { fontSize: 10, color: colors.textMuted, paddingLeft: 4 },
  grid: { flexDirection: 'row' },
  columns: { flex: 1 },
  dayColumn: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  todayColumn: { backgroundColor: 'rgba(226, 85, 58, 0.05)' },
  raisedColumn: { zIndex: 5 },
  block: { position: 'absolute', borderRadius: 6, paddingHorizontal: 3, paddingVertical: 2, justifyContent: 'center', overflow: 'hidden' },
  blockSelected: { borderWidth: 2 },
  checkboxCorner: { alignSelf: 'flex-end', marginBottom: 1 },
  blockText: { fontSize: 10.5, fontWeight: '700' },
}));
