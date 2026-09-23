import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../theme';

const EMOJIS = [
  '☕', '🍽️', '🍕', '🥗', '🍻', '🎂', '🎉', '💼', '📞', '💻',
  '📚', '✏️', '🏋️', '🏃', '🧘', '⚽', '🎾', '🚴', '🏊', '🩺',
  '💊', '🦷', '✂️', '🛒', '🏠', '🧹', '🐶', '👶', '❤️', '✈️',
  '🚗', '🏖️', '🎬', '🎵', '🎮', '📅', '⭐', '🔔', '💰', '🌱',
];

export function EmojiPicker({ value, onChange }: { value?: string; onChange: (emoji: string | undefined) => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <Pressable onPress={() => onChange(undefined)} style={[styles.cell, !value && styles.cellActive]} accessibilityLabel="No emoji">
          <Text style={styles.none}>None</Text>
        </Pressable>
        {EMOJIS.map((e) => (
          <Pressable key={e} onPress={() => onChange(e)} style={[styles.cell, value === e && styles.cellActive]}>
            <Text style={styles.emoji}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={value && !EMOJIS.includes(value) ? value : ''}
        onChangeText={(t) => onChange(t.trim() ? t.trim() : undefined)}
        placeholder="Or type any emoji…"
        placeholderTextColor={colors.textFaint}
        maxLength={8}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  cellActive: { backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary },
  emoji: { fontSize: 22 },
  none: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  input: { fontSize: 16, color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
});
