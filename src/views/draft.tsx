import { addDays, addMinutes, differenceInMinutes } from 'date-fns';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { createStyles, shadow } from '../theme';
import { deepText } from '../utils/color';
import { atMinutes, formatTime } from '../utils/dates';
import { PX_PER_MIN } from './layout';

/*
 * The new-event pill drawn where an empty time was tapped. Drag it to move it (15-minute steps,
 * and in Week view sideways by whole days); drag its top or bottom edge to change the length.
 * Nothing is saved: the calendar screen turns it into an event (Done on phones, the quick-create
 * panel on desktop).
 */

const SNAP_MINUTES = 15;
const TAP_SLOP = 6;
const DAY_MINUTES = 24 * 60;

export interface DraftRange {
  start: Date;
  end: Date;
}

/** What a time-grid view needs to draw the draft. */
export interface DraftProps {
  range: DraftRange;
  color: string;
  label: string;
  onChange: (range: DraftRange) => void;
  /** A tap on the pill (without dragging). */
  onPress?: () => void;
}

type DragKind = 'move' | 'top' | 'bottom';
interface LiveDrag {
  kind: DragKind;
  minutes: number;
  days: number;
}

const snap = (dy: number) => Math.round(dy / PX_PER_MIN / SNAP_MINUTES) * SNAP_MINUTES;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clockMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
// React Native Web passes these through to CSS; native ignores them. `touchAction` stops a touch
// drag on the web from scrolling the page instead of moving the pill.
const webCursor = (cursor: string) => (Platform.OS === 'web' ? ({ cursor, touchAction: 'none' } as unknown as ViewStyle) : null);

/** Start and end (minutes into `day`) after applying a live drag, kept inside the day. */
function applyDrag(startMin: number, endMin: number, drag: LiveDrag | null): { startMin: number; endMin: number } {
  if (!drag) return { startMin, endMin };
  const length = endMin - startMin;
  if (drag.kind === 'move') {
    const s = clamp(startMin + drag.minutes, 0, DAY_MINUTES - length);
    return { startMin: s, endMin: s + length };
  }
  if (drag.kind === 'top') return { startMin: clamp(startMin + drag.minutes, 0, endMin - SNAP_MINUTES), endMin };
  return { startMin, endMin: clamp(endMin + drag.minutes, startMin + SNAP_MINUTES, DAY_MINUTES) };
}

export function DraftBlock({
  draft,
  day,
  left,
  width,
  columnWidth = 0,
  minDays = 0,
  maxDays = 0,
  compact = false,
  onDragging,
}: {
  draft: DraftProps;
  /** The day of the column the pill is drawn in. */
  day: Date;
  left: number;
  width: number;
  /** Width of a day column; sideways drags move by whole days when set (Week view). */
  columnWidth?: number;
  /** How many days the pill may move back (negative) or forward from its column. */
  minDays?: number;
  maxDays?: number;
  /** Narrow columns: smaller text. */
  compact?: boolean;
  /** Lets the view pause scrolling while the pill is dragged. */
  onDragging?: (active: boolean) => void;
}) {
  const styles = useStyles();
  const [live, setLive] = useState<LiveDrag | null>(null);
  const startMin = clockMinutes(draft.range.start);
  const endMin = Math.min(DAY_MINUTES, startMin + differenceInMinutes(draft.range.end, draft.range.start));

  const latest = useRef({ draft, day, startMin, endMin, columnWidth, minDays, maxDays, onDragging });
  useLayoutEffect(() => {
    latest.current = { draft, day, startMin, endMin, columnWidth, minDays, maxDays, onDragging };
  });

  // eslint-disable-next-line react-hooks/refs -- the handlers read refs when a gesture fires, never during render
  const [responders] = useState(() => {
    const toDrag = (kind: DragKind, dx: number, dy: number): LiveDrag => {
      const { columnWidth: w, minDays: lo, maxDays: hi } = latest.current;
      return { kind, minutes: snap(dy), days: kind === 'move' && w > 0 ? clamp(Math.round(dx / w), lo, hi) : 0 };
    };
    const make = (kind: DragKind) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          latest.current.onDragging?.(true);
          setLive({ kind, minutes: 0, days: 0 });
        },
        onPanResponderMove: (_, g) => setLive(toDrag(kind, g.dx, g.dy)),
        onPanResponderRelease: (_, g) => {
          const { draft: d, day: col, startMin: s, endMin: e, onDragging: dragging } = latest.current;
          setLive(null);
          dragging?.(false);
          if (Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP) {
            if (kind === 'move') d.onPress?.();
            return;
          }
          const drag = toDrag(kind, g.dx, g.dy);
          const next = applyDrag(s, e, drag);
          const start = atMinutes(addDays(col, drag.days), next.startMin);
          d.onChange({ start, end: addMinutes(start, next.endMin - next.startMin) });
        },
        onPanResponderTerminate: () => {
          setLive(null);
          latest.current.onDragging?.(false);
        },
      });
    return { move: make('move'), top: make('top'), bottom: make('bottom') };
  });

  const shown = applyDrag(startMin, endMin, live);
  const height = Math.max((shown.endMin - shown.startMin) * PX_PER_MIN - 2, 14);
  const ink = deepText(draft.color);
  const showStart = atMinutes(day, shown.startMin);
  const time = `${formatTime(showStart)} – ${formatTime(addMinutes(showStart, shown.endMin - shown.startMin))}`;
  const short = height < 36;

  return (
    <View
      {...responders.move.panHandlers}
      accessibilityLabel={`New event, ${time}`}
      style={[
        styles.pill,
        { top: shown.startMin * PX_PER_MIN, height, left, width, borderColor: draft.color },
        live ? [styles.dragging, shadow] : null,
        live?.days ? { transform: [{ translateX: live.days * columnWidth }] } : null,
        webCursor(live?.kind === 'move' ? 'grabbing' : 'grab'),
      ]}
    >
      <View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: draft.color }]} />
      <Text numberOfLines={short ? 1 : 2} style={[styles.label, compact && styles.labelCompact, { color: ink }]}>
        {short ? `${draft.label}, ${time}` : draft.label}
      </Text>
      {short ? null : (
        <Text numberOfLines={1} style={[styles.time, compact && styles.timeCompact, { color: ink }]}>
          {time}
        </Text>
      )}
      <View {...responders.top.panHandlers} style={[styles.edge, styles.edgeTop, webCursor('ns-resize')]} accessibilityLabel="Change start time">
        <View style={[styles.grip, styles.gripTop, { borderColor: draft.color }]} />
      </View>
      <View {...responders.bottom.panHandlers} style={[styles.edge, styles.edgeBottom, webCursor('ns-resize')]} accessibilityLabel="Change end time">
        <View style={[styles.grip, styles.gripBottom, { borderColor: draft.color }]} />
      </View>
    </View>
  );
}

const EDGE = Platform.OS === 'web' ? 8 : 16;

const useStyles = createStyles((colors) => ({
  pill: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'solid',
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 15,
    overflow: 'visible',
  },
  dragging: { zIndex: 30, opacity: 0.95 },
  fill: { borderRadius: 7, opacity: 0.32 },
  label: { fontSize: 13, fontWeight: '700' },
  labelCompact: { fontSize: 10.5 },
  time: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  timeCompact: { fontSize: 9.5 },
  edge: { position: 'absolute', left: 0, right: 0, height: EDGE },
  edgeTop: { top: -EDGE / 2 },
  edgeBottom: { bottom: -EDGE / 2 },
  // Round handles like a text selection: top right and bottom left.
  grip: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: 'solid',
    backgroundColor: colors.surface,
  },
  gripTop: { right: 10, top: EDGE / 2 - 6 },
  gripBottom: { left: 10, bottom: EDGE / 2 - 6 },
}));
