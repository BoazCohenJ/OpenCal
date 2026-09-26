import { addDays, addMinutes } from 'date-fns';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import type { Occurrence } from '../services/occurrences';
import { createStyles, fonts, radius, shadow, useTheme } from '../theme';
import { formatDelta } from '../utils/format';
import { PX_PER_MIN } from './layout';

/*
 * Multi-select on the Day and Week time grids (checkbox-style selection mode):
 *  - Normal mode: tap opens an event, long-press enters selection mode with that occurrence checked.
 *  - Selection mode: tap an unchecked occurrence to add it, tap a checked one to remove it (which
 *    also drops any unsaved move it had). Touching a *checked* occurrence claims the gesture
 *    (scrolling pauses) and dragging moves every checked one together: vertically in 15-minute
 *    steps and, in Week view, sideways by whole days. The toolbar also offers nudges.
 *  - Selection is per occurrence: moving one day of a repeating event splits that day off into its
 *    own event instead of moving the series (the event editor moves a whole series).
 *  - Moves are only previewed until Done. Tapping empty space or leaving the page also saves them;
 *    Cancel discards them. Delete removes the checked occurrences (asking about repeating ones).
 */

const SNAP_MINUTES = 15;
const TAP_SLOP = 6;

export interface MoveDelta {
  days: number;
  minutes: number;
}

export interface DragHandlers {
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  /** null when the gesture was cancelled or was a tap. */
  onEnd: (dx: number | null, dy: number | null) => void;
}

const NO_DELTA: MoveDelta = { days: 0, minutes: 0 };
const isZero = (d: MoveDelta) => !d.days && !d.minutes;
const sameDelta = (a: MoveDelta, b: MoveDelta) => a.days === b.days && a.minutes === b.minutes;
const addDelta = (a: MoveDelta, b: MoveDelta): MoveDelta => ({ days: a.days + b.days, minutes: a.minutes + b.minutes });

/** Days are added as calendar days (a 9:00 event stays at 9:00 across DST), then minutes. */
export const shiftDate = (d: Date, { days, minutes }: MoveDelta): Date => addMinutes(addDays(d, days), minutes);

/** A checked occurrence and the move staged for it (not saved until Done). */
export interface PendingMove {
  occurrence: Occurrence;
  delta: MoveDelta;
}

/** A checked occurrence, as passed to Delete. */
export interface SelectedOccurrence {
  eventId: string;
  occurrenceStart: Date;
}

type Picked = Record<string, PendingMove>;

/**
 * Selection state, staged moves and drag handling. `columnWidth` enables sideways day moves (Week
 * view); pass 0 for vertical-only (Day view). When `resetKey` changes (another day/week, or the page
 * stops being the one on screen) or the view unmounts, staged moves are saved and the selection ends.
 *
 * `displayed` is `occurrences` with staged moves applied, for drawing.
 */
export function useEventSelection({
  resetKey,
  columnWidth,
  occurrences,
  onCommitMoves,
  onSelectionModeChange,
}: {
  resetKey: string;
  columnWidth: number;
  occurrences: Occurrence[];
  onCommitMoves: (moves: PendingMove[]) => void;
  onSelectionModeChange?: (active: boolean) => void;
}) {
  const [picked, setPickedState] = useState<Picked>({});
  // Mirrors `picked` synchronously so the leave/unmount cleanup sees the latest staged moves.
  const pickedRef = useRef<Picked>({});
  const setPicked = (update: (prev: Picked) => Picked) => {
    const next = update(pickedRef.current);
    pickedRef.current = next;
    setPickedState(next);
  };
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [dragDelta, setDragDelta] = useState<MoveDelta>(NO_DELTA);
  const [offset] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const lastDelta = useRef(NO_DELTA);
  const selected = Object.keys(picked);
  const selectionMode = selected.length > 0;
  const pending = Object.values(picked).filter((m) => !isZero(m.delta));

  useEffect(() => onSelectionModeChange?.(selectionMode), [selectionMode, onSelectionModeChange]);
  useEffect(() => () => onSelectionModeChange?.(false), [onSelectionModeChange]);

  const latest = useRef({ onCommitMoves, columnWidth });
  useLayoutEffect(() => {
    latest.current = { onCommitMoves, columnWidth };
  });

  /** Saves staged moves (if any) and ends the selection. */
  const done = () => {
    const moves = Object.values(pickedRef.current).filter((m) => !isZero(m.delta));
    setPicked(() => ({}));
    if (moves.length) latest.current.onCommitMoves(moves);
  };
  const cancel = () => setPicked(() => ({}));

  // Leaving the day/week (or unmounting) counts as Done, so staged moves are never lost.
  useEffect(
    () => () => {
      const moves = Object.values(pickedRef.current).filter((m) => !isZero(m.delta));
      pickedRef.current = {};
      setPickedState({});
      if (moves.length) latest.current.onCommitMoves(moves);
    },
    [resetKey],
  );

  /** Stages a move for every checked occurrence. */
  const move = (d: MoveDelta) => {
    if (isZero(d)) return;
    setPicked((prev) => Object.fromEntries(Object.entries(prev).map(([k, m]) => [k, { ...m, delta: addDelta(m.delta, d) }])));
  };
  const moveRef = useRef(move);
  useLayoutEffect(() => {
    moveRef.current = move;
  });

  const [drag] = useState<DragHandlers>(() => {
    const toDelta = (dx: number, dy: number): MoveDelta => {
      const w = latest.current.columnWidth;
      return {
        days: w > 0 ? Math.round(dx / w) : 0,
        minutes: Math.round(dy / PX_PER_MIN / SNAP_MINUTES) * SNAP_MINUTES,
      };
    };
    const reset = () => {
      offset.setValue({ x: 0, y: 0 });
      lastDelta.current = NO_DELTA;
      setDragDelta(NO_DELTA);
      setScrollEnabled(true);
    };
    return {
      onStart: () => {
        lastDelta.current = NO_DELTA;
        setScrollEnabled(false);
      },
      onMove: (dx, dy) => {
        const d = toDelta(dx, dy);
        offset.setValue({ x: d.days * latest.current.columnWidth, y: d.minutes * PX_PER_MIN });
        if (!sameDelta(d, lastDelta.current)) {
          lastDelta.current = d;
          setDragDelta(d);
        }
      },
      onEnd: (dx, dy) => {
        if (dx !== null && dy !== null) moveRef.current(toDelta(dx, dy));
        reset();
      },
    };
  });

  /** Long-press: start a new selection with this occurrence. */
  const select = (occ: Occurrence) => setPicked(() => ({ [occ.key]: { occurrence: occ, delta: NO_DELTA } }));
  /** Tap in selection mode: check, or uncheck (dropping its staged move). */
  const toggle = (occ: Occurrence) =>
    setPicked((prev) => {
      if (!(occ.key in prev)) return { ...prev, [occ.key]: { occurrence: occ, delta: NO_DELTA } };
      const next = { ...prev };
      delete next[occ.key];
      return next;
    });
  /** The checked occurrences as originally scheduled, for Delete. */
  const selectedOccurrences = (): SelectedOccurrence[] =>
    Object.values(picked).map((m) => ({ eventId: m.occurrence.event.id, occurrenceStart: m.occurrence.start }));

  // Draw checked occurrences where their staged moves put them (same key, so they stay checked).
  const displayed = useMemo(
    () =>
      occurrences.map((o) => {
        const m = picked[o.key];
        return m && !isZero(m.delta) ? { ...o, start: shiftDate(o.start, m.delta), end: shiftDate(o.end, m.delta) } : o;
      }),
    [occurrences, picked],
  );

  // What the toolbar shows: the live drag, else the staged move when every checked item shares it.
  const staged = Object.values(picked).map((m) => m.delta);
  const summary: MoveDelta | 'mixed' =
    !isZero(dragDelta) ? dragDelta : staged.length && staged.every((d) => sameDelta(d, staged[0]!)) ? staged[0]! : 'mixed';

  return {
    selected,
    selectionMode,
    hasPending: pending.length > 0,
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
  };
}

/** Small check box drawn on events while selecting. */
export function SelectionCheckbox({ color, checked, size = 18 }: { color: string; checked: boolean; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.checkbox,
        { width: size, height: size, borderRadius: size * 0.28, borderColor: color },
        checked && { backgroundColor: color },
      ]}
    >
      {checked ? <Icon name="check" size={size * 0.66} color={colors.onPrimary} strokeWidth={3} /> : null}
    </View>
  );
}

/**
 * An event on the time grid that can be opened, long-pressed into selection, toggled and, once
 * checked, dragged. `style` positions and colors the block; checked blocks follow `offset`.
 */
export function SelectableBlock({
  style,
  selectedStyle,
  selected,
  selectionMode,
  drag,
  offset,
  onOpen,
  onToggle,
  onLongPress,
  accessibilityLabel,
  children,
}: {
  style: StyleProp<ViewStyle>;
  selectedStyle: StyleProp<ViewStyle>;
  selected: boolean;
  selectionMode: boolean;
  drag: DragHandlers;
  offset: Animated.ValueXY;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  const latest = useRef({ drag, onToggle });
  useLayoutEffect(() => {
    latest.current = { drag, onToggle };
  });

  // eslint-disable-next-line react-hooks/refs -- the handlers read refs when a gesture fires, never during render
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => latest.current.drag.onStart(),
      onPanResponderMove: (_, g) => latest.current.drag.onMove(g.dx, g.dy),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) < TAP_SLOP && Math.abs(g.dx) < TAP_SLOP) {
          latest.current.drag.onEnd(null, null);
          latest.current.onToggle();
        } else {
          latest.current.drag.onEnd(g.dx, g.dy);
        }
      },
      onPanResponderTerminate: () => latest.current.drag.onEnd(null, null),
    }),
  );

  if (selectionMode && selected) {
    return (
      <Animated.View
        {...responder.panHandlers}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: true }}
        style={[style, selectedStyle, shadow, { zIndex: 10, transform: offset.getTranslateTransform() }]}
      >
        {children}
      </Animated.View>
    );
  }
  return (
    <Pressable
      onPress={selectionMode ? onToggle : onOpen}
      onLongPress={selectionMode ? undefined : onLongPress}
      delayLongPress={350}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={selectionMode ? 'Tap to select' : 'Long-press to select several events'}
      style={({ pressed }) => [style, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  );
}

const describeDelta = ({ days, minutes }: MoveDelta): string =>
  [days ? `${days > 0 ? '+' : '−'}${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}` : '', minutes ? formatDelta(minutes) : '']
    .filter(Boolean)
    .join(' ');

/**
 * Floating toolbar shown while occurrences are checked: count, the staged move, nudges, Delete,
 * and Done (saves) / Cancel (discards, only while there are unsaved moves).
 */
export function SelectionToolbar({
  count,
  summary,
  hasPending,
  hasRecurring,
  showDayNudges,
  onMove,
  onDelete,
  onCancel,
  onDone,
}: {
  count: number;
  summary: MoveDelta | 'mixed';
  hasPending: boolean;
  hasRecurring: boolean;
  /** Week view: also offers ±1 day, and the hint mentions sideways drags. */
  showDayNudges: boolean;
  onMove: (delta: MoveDelta) => void;
  onDelete: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const styles = useStyles();
  const moving = summary === 'mixed' ? (hasPending ? 'moved' : '') : describeDelta(summary);
  return (
    <View style={[styles.toolbar, shadow]}>
      <View style={styles.toolbarTop}>
        <View style={styles.toolbarTitleBlock}>
          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {count} selected
          </Text>
          {moving ? (
            <Text style={styles.toolbarMoving} numberOfLines={1}>
              {moving}
            </Text>
          ) : null}
        </View>
        <View style={styles.toolbarButtons}>
          <Button small variant="danger" title="Delete" onPress={onDelete} />
          {hasPending ? <Button small variant="ghost" title="Cancel" onPress={onCancel} /> : null}
          <Button small variant={hasPending ? 'primary' : 'ghost'} title="Done" onPress={onDone} />
        </View>
      </View>
      <Text style={styles.toolbarHint}>
        {showDayNudges
          ? 'Drag a checked event up or down to change the time, sideways to change the day.'
          : 'Drag a checked event to move all of them together.'}
        {' Nothing is saved until you tap Done.'}
        {hasRecurring ? ' A moved day of a repeating event becomes its own event; edit the event to move the whole series.' : ''}
      </Text>
      {showDayNudges ? (
        <View style={styles.toolbarActions}>
          <Button small variant="secondary" title="− 1 day" onPress={() => onMove({ days: -1, minutes: 0 })} style={styles.nudge} />
          <Button small variant="secondary" title="+ 1 day" onPress={() => onMove({ days: 1, minutes: 0 })} style={styles.nudge} />
        </View>
      ) : null}
      <View style={styles.toolbarActions}>
        <Button small variant="secondary" title="− 1 hr" onPress={() => onMove({ days: 0, minutes: -60 })} style={styles.nudge} />
        <Button small variant="secondary" title="− 15 min" onPress={() => onMove({ days: 0, minutes: -15 })} style={styles.nudge} />
        <Button small variant="secondary" title="+ 15 min" onPress={() => onMove({ days: 0, minutes: 15 })} style={styles.nudge} />
        <Button small variant="secondary" title="+ 1 hr" onPress={() => onMove({ days: 0, minutes: 60 })} style={styles.nudge} />
      </View>
    </View>
  );
}

/** Extra scroll padding so the toolbar never covers the last hours. */
export const TOOLBAR_CLEARANCE = 210;

const useStyles = createStyles((colors) => ({
  // Tight padding so "− 15 min" fits on one line on narrow phones.
  nudge: { flex: 1, paddingHorizontal: 4 },
  checkbox: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
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
  toolbarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toolbarTitleBlock: { flexShrink: 1 },
  toolbarTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  toolbarMoving: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 1 },
  toolbarButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolbarHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  toolbarActions: { flexDirection: 'row', gap: 6 },
}));
