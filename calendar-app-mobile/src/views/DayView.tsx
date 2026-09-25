import { isSameDay } from 'date-fns';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EventPill } from '../components/EventPill';
import { EventGlyph, eventIconKey, Icon } from '../components/Icon';
import { Button } from '../components/ui';
import type { Occurrence } from '../services/occurrences';
import { createStyles, fonts, radius, shadow, useTheme } from '../theme';
import { deepText, softBg } from '../utils/color';
import { atMinutes, dayKey, formatTime, minutesSinceMidnight } from '../utils/dates';
import { eventLabel, formatDelta } from '../utils/format';
import { isAllDayLike, layoutTimed, PX_PER_MIN, slotMinutesFromPress, type PositionedOccurrence } from './layout';
import { GRID_HEIGHT, HourGutter, HourLines, NowLine } from './TimeGrid';

const SNAP_MINUTES = 15;
const TAP_SLOP = 6;
const snap = (dy: number) => Math.round(dy / PX_PER_MIN / SNAP_MINUTES) * SNAP_MINUTES;

interface DragHandlers {
  onStart: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number | null) => void;
}

/*
 * Gesture model (checkbox-style selection mode, the robust fallback from the spec):
 *  - Normal mode: tap opens an event, long-press enters selection mode with that event checked.
 *  - Selection mode: tap an unselected event to add it; touching a *selected* event claims the
 *    gesture (scrolling is disabled while dragging) and vertical drag shifts every selected event
 *    together in 15-minute steps, preserving relative offsets. A tap on a selected event unchecks it.
 *  - Scrolling still works by dragging anywhere that is not a selected event.
 *  - The toolbar also offers ±15 min nudges for precise, gesture-free moves.
 */
function EventBlock({
  pos,
  left,
  width,
  selected,
  selectionMode,
  dragY,
  drag,
  onOpen,
  onToggle,
  onLongPress,
}: {
  pos: PositionedOccurrence;
  left: number;
  width: number;
  selected: boolean;
  selectionMode: boolean;
  dragY: Animated.Value;
  drag: DragHandlers;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const latest = useRef({ drag, onToggle });
  latest.current = { drag, onToggle };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => latest.current.drag.onStart(),
        onPanResponderMove: (_, g) => latest.current.drag.onMove(g.dy),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dy) < TAP_SLOP && Math.abs(g.dx) < TAP_SLOP) {
            latest.current.drag.onEnd(null);
            latest.current.onToggle();
          } else {
            latest.current.drag.onEnd(g.dy);
          }
        },
        onPanResponderTerminate: () => latest.current.drag.onEnd(null),
      }),
    [],
  );

  const { occ } = pos;
  const tall = pos.height >= 44;
  const blockStyle = [
    styles.block,
    {
      top: pos.top,
      height: pos.height - 2,
      left,
      width,
      backgroundColor: softBg(occ.color),
      borderLeftColor: occ.color,
    },
    selected && [styles.blockSelected, { borderColor: occ.color }],
  ];

  const content = (
    <View style={styles.blockInner}>
      {selectionMode ? (
        <View style={[styles.checkbox, { borderColor: occ.color }, selected && { backgroundColor: occ.color }]}>
          {selected ? <Icon name="check" size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
        </View>
      ) : null}
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

  if (selectionMode && selected) {
    return (
      <Animated.View {...responder.panHandlers} style={[blockStyle, shadow, { zIndex: 10, transform: [{ translateY: dragY }] }]}>
        {content}
      </Animated.View>
    );
  }
  return (
    <Pressable
      onPress={selectionMode ? onToggle : onOpen}
      onLongPress={selectionMode ? undefined : onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [blockStyle, pressed && { opacity: 0.8 }]}
    >
      {content}
    </Pressable>
  );
}

export function DayView({
  date,
  occurrences,
  onPressEvent,
  onPressSlot,
  onMoveEvents,
  onSelectionModeChange,
}: {
  date: Date;
  occurrences: Occurrence[];
  onPressEvent: (o: Occurrence) => void;
  onPressSlot: (start: Date) => void;
  onMoveEvents: (eventIds: string[], deltaMinutes: number) => void;
  onSelectionModeChange?: (active: boolean) => void;
}) {
  const styles = useStyles();
  const key = dayKey(date);
  const allDay = useMemo(() => occurrences.filter(isAllDayLike), [occurrences]);
  const timed = useMemo(() => layoutTimed(occurrences.filter((o) => !isAllDayLike(o)), date), [occurrences, date]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [dragMinutes, setDragMinutes] = useState(0);
  const [columnWidth, setColumnWidth] = useState(0);
  const dragY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const lastSnap = useRef(0);
  const selectionMode = selected.length > 0;
  const isToday = isSameDay(date, new Date());

  useEffect(() => setSelected([]), [key]);
  useEffect(() => onSelectionModeChange?.(selectionMode), [selectionMode, onSelectionModeChange]);
  useEffect(() => () => onSelectionModeChange?.(false), [onSelectionModeChange]);

  useEffect(() => {
    const minutes = isSameDay(date, new Date()) ? Math.max(0, minutesSinceMidnight(new Date()) - 90) : 7 * 60;
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: minutes * PX_PER_MIN, animated: false }), 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const latest = useRef({ selected, onMoveEvents });
  latest.current = { selected, onMoveEvents };

  const drag = useMemo<DragHandlers>(
    () => ({
      onStart: () => {
        lastSnap.current = 0;
        setScrollEnabled(false);
      },
      onMove: (dy) => {
        const m = snap(dy);
        dragY.setValue(m * PX_PER_MIN);
        if (m !== lastSnap.current) {
          lastSnap.current = m;
          setDragMinutes(m);
        }
      },
      onEnd: (dy) => {
        const m = dy === null ? 0 : snap(dy);
        if (m !== 0 && latest.current.selected.length) latest.current.onMoveEvents(latest.current.selected, m);
        dragY.setValue(0);
        lastSnap.current = 0;
        setDragMinutes(0);
        setScrollEnabled(true);
      },
    }),
    [dragY],
  );

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSlotPress = (e: GestureResponderEvent) => {
    if (selectionMode) {
      setSelected([]);
      return;
    }
    onPressSlot(atMinutes(date, slotMinutesFromPress(e)));
  };

  const selectedHasRecurring = timed.some((p) => selected.includes(p.occ.event.id) && p.occ.event.recurrenceRule);

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

      <ScrollView ref={scrollRef} scrollEnabled={scrollEnabled} contentContainerStyle={{ paddingVertical: 8, paddingBottom: selectionMode ? 140 : 24 }}>
        <View style={[styles.grid, { height: GRID_HEIGHT }]}>
          <HourGutter />
          <View style={styles.column} onLayout={(e) => setColumnWidth(e.nativeEvent.layout.width)}>
            <HourLines />
            <Pressable style={StyleSheet.absoluteFill} onPress={handleSlotPress} accessibilityLabel="Add event at this time" />
            {columnWidth > 0 &&
              timed.map((pos) => {
                const w = (columnWidth - 8) / pos.columns;
                return (
                  <EventBlock
                    key={pos.occ.key}
                    pos={pos}
                    left={2 + pos.column * w}
                    width={w - 3}
                    selected={selected.includes(pos.occ.event.id)}
                    selectionMode={selectionMode}
                    dragY={dragY}
                    drag={drag}
                    onOpen={() => onPressEvent(pos.occ)}
                    onToggle={() => toggle(pos.occ.event.id)}
                    onLongPress={() => setSelected([pos.occ.event.id])}
                  />
                );
              })}
            {isToday ? <NowLine /> : null}
          </View>
        </View>
      </ScrollView>

      {selectionMode ? (
        <View style={[styles.toolbar, shadow]}>
          <View style={styles.toolbarTop}>
            <Text style={styles.toolbarTitle}>
              {selected.length} selected{dragMinutes ? `  ·  ${formatDelta(dragMinutes)}` : ''}
            </Text>
            <Button small variant="ghost" title="Done" onPress={() => setSelected([])} />
          </View>
          <Text style={styles.toolbarHint}>
            Drag a checked event to move all of them together. Tap events to add or remove.
            {selectedHasRecurring ? ' Repeating events shift the whole series.' : ''}
          </Text>
          <View style={styles.toolbarActions}>
            <Button small variant="secondary" title="− 1 hr" onPress={() => onMoveEvents(selected, -60)} style={styles.flex} />
            <Button small variant="secondary" title="− 15 min" onPress={() => onMoveEvents(selected, -15)} style={styles.flex} />
            <Button small variant="secondary" title="+ 15 min" onPress={() => onMoveEvents(selected, 15)} style={styles.flex} />
            <Button small variant="secondary" title="+ 1 hr" onPress={() => onMoveEvents(selected, 60)} style={styles.flex} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
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
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  toolbar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 8,
  },
  toolbarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  toolbarHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  toolbarActions: { flexDirection: 'row', gap: 6 },
}));
