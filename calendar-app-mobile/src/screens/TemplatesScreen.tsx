import React, { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, HeaderButton } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { formatDuration } from '../utils/format';

export function TemplatesScreen({ navigation }: ScreenProps<'Templates'>) {
  const { templates, calendarsById, moveTemplate } = useCalendarContext();

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderButton title="+ New" bold onPress={() => navigation.navigate('TemplateEdit')} /> });
  }, [navigation]);

  if (templates.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          emoji="🔖"
          title="Save events you repeat often"
          subtitle="A stamp stores title, duration, color, reminders, calendar and location. Drop it on any date and just confirm the time."
        >
          <Button title="Create your first stamp" onPress={() => navigation.navigate('TemplateEdit')} />
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {templates.map((t, i) => {
        const cal = calendarsById[t.calendarId];
        const color = t.color ?? cal?.color ?? colors.primary;
        return (
          <View key={t.id} style={[styles.card, { borderLeftColor: color }]}>
            <Pressable style={styles.cardMain} onPress={() => navigation.navigate('TemplateEdit', { templateId: t.id })}>
              <Text style={styles.emoji}>{t.emoji ?? '🔖'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {t.isAllDay ? 'All day' : formatDuration(t.durationMinutes)}
                  {cal ? ` · ${cal.name}` : ''}
                  {t.location ? ` · ${t.location}` : ''}
                </Text>
              </View>
            </Pressable>
            <View style={styles.actions}>
              <Pressable
                onPress={() => moveTemplate(t.id, -1)}
                disabled={i === 0}
                style={[styles.order, i === 0 && styles.disabled]}
                accessibilityLabel={`Move ${t.name} up`}
              >
                <Text style={styles.orderText}>↑</Text>
              </Pressable>
              <Pressable
                onPress={() => moveTemplate(t.id, 1)}
                disabled={i === templates.length - 1}
                style={[styles.order, i === templates.length - 1 && styles.disabled]}
                accessibilityLabel={`Move ${t.name} down`}
              >
                <Text style={styles.orderText}>↓</Text>
              </Pressable>
              <Button small variant="secondary" title="Use" onPress={() => navigation.navigate('Stamp', { templateId: t.id })} />
            </View>
          </View>
        );
      })}
      <Text style={styles.footer}>Tip: tap an empty time slot in Day or Week view to drop a stamp right there.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderLeftWidth: 5, paddingRight: 10 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  emoji: { fontSize: 26 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  order: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  disabled: { opacity: 0.3 },
  footer: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
});
