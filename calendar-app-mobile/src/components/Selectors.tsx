import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Calendar } from '../models/Calendar';
import { colors, radius } from '../theme';
import { formatReminder } from '../utils/format';
import { Icon } from './Icon';
import { Chip, TextField } from './ui';

const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 1440, 10080];

export function ReminderPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (m: number) =>
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b));
  return (
    <View style={styles.wrap}>
      <Chip label="None" selected={value.length === 0} onPress={() => onChange([])} />
      {REMINDER_OPTIONS.map((m) => (
        <Chip key={m} label={formatReminder(m).replace(' before', '')} selected={value.includes(m)} onPress={() => toggle(m)} />
      ))}
    </View>
  );
}

export function CalendarSelector({
  calendars,
  value,
  onChange,
}: {
  calendars: Calendar[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
      {calendars.map((c) => (
        <Chip key={c.id} label={c.name} color={c.color} selected={c.id === value} onPress={() => onChange(c.id)} />
      ))}
    </ScrollView>
  );
}

export function TagEditor({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])));
    setText('');
  };
  const remaining = suggestions.filter((s) => !value.includes(s)).slice(0, 8);
  return (
    <View style={styles.tagEditor}>
      {value.length > 0 ? (
        <View style={styles.wrapTight}>
          {value.map((t) => (
            <Pressable key={t} style={styles.tag} onPress={() => onChange(value.filter((x) => x !== t))} accessibilityLabel={`Remove tag ${t}`}>
              <Text style={styles.tagText}>#{t}</Text>
              <Icon name="x" size={12} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextField
        value={text}
        onChangeText={(t) => (t.endsWith(',') ? add(t) : setText(t))}
        onSubmitEditing={() => add(text)}
        onBlur={() => text.trim() && add(text)}
        placeholder="Add a tag and press return"
        returnKeyType="done"
        autoCapitalize="none"
        submitBehavior="submit"
      />
      {remaining.length > 0 ? (
        <View style={styles.wrapTight}>
          {remaining.map((s) => (
            <Chip key={s} label={`+ #${s}`} onPress={() => add(s)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  wrapTight: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hRow: { gap: 8, padding: 16 },
  tagEditor: { gap: 10 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tagText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
