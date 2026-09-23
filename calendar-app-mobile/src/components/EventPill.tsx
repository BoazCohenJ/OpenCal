import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Occurrence } from '../services/occurrences';
import { colors } from '../theme';
import { deepText, readableOn, softBg } from '../utils/color';
import { eventLabel } from '../utils/format';

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
  if (variant === 'dot') {
    return (
      <Pressable onPress={onPress} hitSlop={2} style={styles.dotRow}>
        <View style={[styles.dot, { backgroundColor: occ.color }]} />
        <Text numberOfLines={1} style={[styles.dotText, compact && styles.compactText]}>
          {label}
        </Text>
      </Pressable>
    );
  }
  const solid = variant === 'solid';
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
      <Text
        numberOfLines={1}
        style={[styles.pillText, compact && styles.compactText, { color: solid ? readableOn(occ.color) : deepText(occ.color) }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 6, paddingVertical: 4 },
  pillCompact: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderLeftWidth: 2 },
  pillText: { fontSize: 13, fontWeight: '600' },
  compactText: { fontSize: 10.5 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotText: { flex: 1, fontSize: 12, color: colors.text },
});
