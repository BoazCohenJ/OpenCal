import { isSameDay } from 'date-fns';
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EventPill } from '../components/EventPill';
import { EventGlyph, eventIconKey, Icon } from '../components/Icon';
import type { Occurrence } from '../services/occurrences';
import { createStyles } from '../theme';
import { deepText, softBg } from '../utils/color';
import { atMinutes, dayKey, formatTime, minutesSinceMidnight } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { isAllDayLike, layoutTimed, PX_PER_MIN, slotMinutesFromPress, type PositionedOccurrence } from './layout';
import { SelectableBlock, SelectionCheckbox, SelectionToolbar, TOOLBAR_CLEARANCE, useEventSelection, type PendingMove, type SelectedOccurrence } from './selection';
import { GRID_HEIGHT, HourGutter, HourLines, NowLine, type TimeGridHandle } from './TimeGrid';

function EventContent({ pos, selectionMode, selected }: { pos: PositionedOccurrence; selectionMode: boolean; selected: boolean }) {
  const styles = useStyles();
  const { occ } = pos;
  const tall = pos.height >= 44;
  return (
    <View style={styles.blockInner}>
      {selectionMode ? <SelectionCheckbox color={occ.color} checked={selected} /> : null}
      <View style={styles.blockBody}>
        <View style={styles.titleRow}>
          {eventIconKey(occ.event.emoji) ? <EventGlyph value={occ.event.emoji} size={13} color={deepText(occ.color)} /> : null}
          <Text numberOfLines={tall ? 2 : 1} style={[styles.blockTitle, { color: deepText(occ.color) }]}>
            {eventLabel(occ.event)}
          </Text>
        </View>
        {tall ? (
          <Text numberOfLines={1} style={[styles.blockMeta, { color: deepText(occ.color) }]}>
            {formatTime(occ.start)} – {formatTime(occ.end)}
            {occ.event.location ? ` · ${occ.event.location}` : ''}
          </Text>
        ) : null}
      </View>
      {occ.event.recurrenceRule ? <Icon name="repeat" size={12} color={deepText(occ.color)} /> : null}
    </View>
  );
}

export function DayView({
  date,
  occurrences,
  onPressEvent,
  onPressSlot,
  onCommitMoves,
  onDeleteEvents,
  onSelectionModeChange,
  active = true,
  onScrollY,
  ref,
}: {
  date: Date;
  occurrences: Occurrence[];
  onPressEvent: (o: Occurrence) => void;
  onPressSlot: (start: Date) => void;
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
  const key = dayKey(date);
  const [columnWidth, setColumnWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isToday = isSameDay(date, new Date());
  // Vertical-only drags here (columnWidth 0): sideways swipes change the day.
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
  } = useEventSelection({ resetKey: `${key}:${active}`, columnWidth: 0, occurrences, onCommitMoves, onSelectionModeChange });
  const allDay = useMemo(() => displayed.filter(isAllDayLike), [displayed]);
  const timed = useMemo(() => layoutTimed(displayed.filter((o) => !isAllDayLike(o)), date), [displayed, date]);

  useImperativeHandle(ref, () => ({ scrollToY: (y) => scrollRef.current?.scrollTo({ y, animated: false }) }), []);

  useEffect(() => {
    const minutes = isSameDay(date, new Date()) ? Math.max(0, minutesSinceMidnight(new Date()) - 90) : 7 * 60;
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: minutes * PX_PER_MIN, animated: false }), 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const handleSlotPress = (e: GestureResponderEvent) => {
    // Tapping empty space ends selection like Done (staged moves are saved).
    if (selectionMode) {
      done();
      return;
    }
    onPressSlot(atMinutes(date, slotMinutesFromPress(e)));
  };

  const selectedHasRecurring = timed.some((p) => selected.includes(p.occ.key) && p.occ.event.recurrenceRule);

  return (
    <View style={styles.container}>
      {allDay.length > 0 ? (
        <View style={styles.allDay}>
          <Text style={styles.allDayLabel}>ALL DAY</Text>
          <View style={styles.allDayList}>
            {allDay.map((o) => (
              <EventPill key={o.key} occ={o} variant="solid" onPress={() => onPressEvent(o)} />
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        onScroll={onScrollY ? (e) => onScrollY(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: selectionMode ? TOOLBAR_CLEARANCE : 24 }}
      >
        <View style={[styles.grid, { height: GRID_HEIGHT }]}>
          <HourGutter />
          <View style={styles.column} onLayout={(e) => setColumnWidth(e.nativeEvent.layout.width)}>
            <HourLines />
            <Pressable style={StyleSheet.absoluteFill} onPress={handleSlotPress} accessibilityLabel="Add event at this time" />
            {columnWidth > 0 &&
              timed.map((pos) => {
                const w = (columnWidth - 8) / pos.columns;
                const isSelected = selected.includes(pos.occ.key);
                return (
                  <SelectableBlock
                    key={pos.occ.key}
                    style={[
                      styles.block,
                      {
                        top: pos.top,
                        height: pos.height - 2,
                        left: 2 + pos.column * w,
                        width: w - 3,
                        backgroundColor: softBg(pos.occ.color),
                        borderLeftColor: pos.occ.color,
                      },
                    ]}
                    selectedStyle={[styles.blockSelected, { borderColor: pos.occ.color }]}
                    selected={isSelected}
                    selectionMode={selectionMode}
                    drag={drag}
                    offset={offset}
                    onOpen={() => onPressEvent(pos.occ)}
                    onToggle={() => toggle(pos.occ)}
                    onLongPress={() => select(pos.occ)}
                    accessibilityLabel={pos.occ.event.title}
                  >
                    <EventContent pos={pos} selectionMode={selectionMode} selected={isSelected} />
                  </SelectableBlock>
                );
              })}
            {isToday ? <NowLine /> : null}
          </View>
        </View>
      </ScrollView>

      {selectionMode ? (
        <SelectionToolbar
          count={selected.length}
          summary={summary}
          hasPending={hasPending}
          hasRecurring={selectedHasRecurring}
          showDayNudges={false}
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
  allDay: { padding: 12, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  allDayLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, letterSpacing: 1.4 },
  allDayList: { gap: 4 },
  grid: { flexDirection: 'row' },
  column: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  block: {
    position: 'absolute',
    borderRadius: 10,
    borderLeftWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  blockSelected: { borderWidth: 2, borderLeftWidth: 4 },
  blockInner: { flexDirection: 'row', gap: 6, flex: 1 },
  blockBody: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  blockTitle: { flexShrink: 1, fontSize: 13, fontWeight: '700' },
  blockMeta: { fontSize: 11, opacity: 0.85, marginTop: 1 },
}));
