import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Occurrence } from '../services/occurrences';
import { createStyles } from '../theme';
import { readableOn } from '../utils/color';
import { eventLabel } from '../utils/format';
import { EventGlyph, eventIconKey } from './Icon';

export const SPAN_BAR_HEIGHT = 17;
export const SPAN_LANE_HEIGHT = SPAN_BAR_HEIGHT + 2;
/** The small size the month grid uses to fit more rows into a cell. */
export const COMPACT_BAR_HEIGHT = 14;
export const COMPACT_LANE_HEIGHT = COMPACT_BAR_HEIGHT + 1;

/** One long bar for an all-day or multi-day event; a square end means it carries on past that side. */
export function SpanBar({
  occ,
  fromPrev,
  toNext,
  onPress,
  compact = false,
  style,
}: {
  occ: Occurrence;
  fromPrev: boolean;
  toNext: boolean;
  onPress?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const fg = readableOn(occ.color);
  const shape = {
    borderTopLeftRadius: fromPrev ? 0 : 5,
    borderBottomLeftRadius: fromPrev ? 0 : 5,
    borderTopRightRadius: toNext ? 0 : 5,
    borderBottomRightRadius: toNext ? 0 : 5,
  };
  const content = (
    <>
      {eventIconKey(occ.event.emoji) ? <EventGlyph value={occ.event.emoji} size={compact ? 9 : 10} color={fg} /> : null}
      <Text numberOfLines={1} style={[styles.text, compact && styles.textCompact, { color: fg }]}>
        {eventLabel(occ.event)}
      </Text>
    </>
  );
  const box = [styles.bar, compact && styles.barCompact, { backgroundColor: occ.color }, shape, style];
  if (!onPress) return <View style={box}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={box}>
      {content}
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  bar: { height: SPAN_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4, overflow: 'hidden' },
  barCompact: { height: COMPACT_BAR_HEIGHT, paddingHorizontal: 3, gap: 2 },
  text: { flex: 1, fontSize: 10.5, fontWeight: '600' },
  textCompact: { fontSize: 9.5, lineHeight: 12 },
}));
