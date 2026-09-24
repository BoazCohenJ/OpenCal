import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Occurrence } from '../services/occurrences';
import { colors } from '../theme';
import { deepText, readableOn, softBg } from '../utils/color';
import { eventLabel } from '../utils/format';
import { EventGlyph, eventIconKey } from './Icon';

export function EventPill({
  occ,
  onPress,
  variant = 'soft',
  compact = false,
}: {
  occ: Occurrence;
  onPress?: () => void;
  variant?: 'soft' | 'solid' | 'dot';
  compact?: boolean;
}) {
  const label = eventLabel(occ.event);
  const hasIcon = eventIconKey(occ.event.emoji) !== null;
  if (variant === 'dot') {
    return (
      <Pressable onPress={onPress} hitSlop={2} style={styles.dotRow}>
        <View style={[styles.dot, { backgroundColor: occ.color }]} />
        {hasIcon && !compact ? <EventGlyph value={occ.event.emoji} size={12} color={occ.color} /> : null}
        <Text numberOfLines={1} style={[styles.dotText, compact && styles.compactText]}>
          {label}
        </Text>
      </Pressable>
    );
  }
  const solid = variant === 'solid';
  const fg = solid ? readableOn(occ.color) : deepText(occ.color);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={2}
      style={[
        styles.pill,
        compact && styles.pillCompact,
        { backgroundColor: solid ? occ.color : softBg(occ.color), borderLeftColor: occ.color },
      ]}
    >
      {hasIcon ? <EventGlyph value={occ.event.emoji} size={compact ? 10 : 14} color={fg} /> : null}
      <Text numberOfLines={1} style={[styles.pillText, compact && styles.compactText, { color: fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 7, borderLeftWidth: 3, paddingHorizontal: 7, paddingVertical: 5 },
  pillCompact: { gap: 3, paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 4, borderLeftWidth: 0 },
  pillText: { flex: 1, fontSize: 13, fontWeight: '700' },
  compactText: { fontSize: 10.5, fontWeight: '600' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 1 },
  dot: { width: 3, height: 10, borderRadius: 2 },
  dotText: { flex: 1, fontSize: 12, color: colors.text },
});
