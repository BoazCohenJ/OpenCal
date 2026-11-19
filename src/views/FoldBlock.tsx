import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '../components/Icon';
import { foldOf } from '../services/fold';
import type { Occurrence } from '../services/occurrences';
import { createStyles, radius } from '../theme';
import { deepText, readableOn, softBg } from '../utils/color';
import { formatTime } from '../utils/dates';

/** Blocks at least this tall (px) repeat their name in the middle. */
const MIDDLE_LABEL_MIN = 240;

const plural = (n: number) => `${n} event${n === 1 ? '' : 's'}`;

/**
 * A folded calendar's block on a time grid (see services/fold). Folded: a tinted box named after the
 * calendar with how many events it holds; tapping it unfolds that day. Unfolded: a thin rail beside
 * the events with a Fold button at the top.
 */
export function FoldBlock({
  occ,
  height,
  style,
  compact = false,
  onToggle,
}: {
  occ: Occurrence;
  height: number;
  /** Position on the grid (top, left, width, height). */
  style: StyleProp<ViewStyle>;
  /** Week view: narrow columns, so less text. */
  compact?: boolean;
  onToggle: () => void;
}) {
  const styles = useStyles();
  const fold = foldOf(occ);
  if (!fold) return null;
  const color = occ.color;
  const count = fold.members.length;

  if (fold.expanded) {
    return (
      <View style={[style, styles.expanded]} pointerEvents="box-none">
        <Pressable onPress={onToggle} hitSlop={6} style={[styles.rail, { backgroundColor: color }]} accessibilityLabel={`Fold ${occ.event.title}`} />
        <Pressable
          onPress={onToggle}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Fold ${occ.event.title} back into one block`}
          style={[styles.foldButton, compact && styles.foldButtonCompact, { backgroundColor: color }]}
        >
          <Icon name="chevron-up" size={compact ? 10 : 12} color={readableOn(color)} strokeWidth={3} />
          {compact ? null : <Text style={[styles.foldText, { color: readableOn(color) }]}>Fold {occ.event.title}</Text>}
        </Pressable>
      </View>
    );
  }

  const fg = deepText(color);
  const tall = height >= 44;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${occ.event.title}, ${plural(count)}. Tap to show them.`}
      style={({ pressed }) => [style, styles.block, compact && styles.blockCompact, { backgroundColor: softBg(color), borderColor: color }, pressed && styles.pressed]}
    >
      {compact ? (
        <>
          <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.compactTitle, { color: fg }]}>
            {occ.event.title}
          </Text>
          {tall ? <Text style={[styles.compactMeta, { color: fg }]}>{count}</Text> : null}
        </>
      ) : (
        <>
          <View style={styles.head}>
            <Text numberOfLines={1} style={[styles.title, { color: fg }]}>
              {occ.event.title}
            </Text>
            <View style={[styles.chip, { backgroundColor: color }]}>
              <Text style={[styles.chipText, { color: readableOn(color) }]}>{plural(count)}</Text>
              <Icon name="chevron-down" size={11} color={readableOn(color)} strokeWidth={3} />
            </View>
          </View>
          {tall ? (
            <Text numberOfLines={1} style={[styles.meta, { color: fg }]}>
              {formatTime(occ.start)} – {formatTime(occ.end)}
            </Text>
          ) : null}
        </>
      )}
      {/* A tall block is often scrolled past its top, so say what it is in the middle too. */}
      {height >= MIDDLE_LABEL_MIN ? (
        <View style={styles.middle} pointerEvents="none">
          <Text numberOfLines={1} style={[compact ? styles.middleTitleCompact : styles.middleTitle, { color: fg }]}>
            {occ.event.title}
          </Text>
          <Text numberOfLines={compact ? 2 : 1} style={[styles.middleHint, compact && styles.middleHintCompact, { color: fg }]}>
            {plural(count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  block: { position: 'absolute', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  blockCompact: { paddingHorizontal: 3, paddingVertical: 2, borderRadius: 7 },
  pressed: { opacity: 0.75 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 10.5, fontWeight: '700' },
  compactTitle: { fontSize: 10, fontWeight: '700' },
  compactMeta: { fontSize: 10, fontWeight: '600', opacity: 0.8 },
  middle: { position: 'absolute', left: 4, right: 4, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.55 },
  middleTitle: { fontSize: 18, fontWeight: '800' },
  middleTitleCompact: { fontSize: 11, fontWeight: '800' },
  middleHint: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  middleHintCompact: { fontSize: 9.5, textAlign: 'center' },
  expanded: { position: 'absolute', zIndex: 3 },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 2 },
  foldButton: {
    position: 'absolute',
    right: 4,
    top: -20,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  foldButtonCompact: { right: 1, top: -15, paddingHorizontal: 3, paddingVertical: 2 },
  foldText: { fontSize: 10.5, fontWeight: '700' },
}));
