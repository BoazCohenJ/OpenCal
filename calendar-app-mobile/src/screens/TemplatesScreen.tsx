import React, { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, HeaderButton } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { EventGlyph, Icon } from '../components/Icon';
import { colors, radius, spacing } from '../theme';
import { deepText, softBg } from '../utils/color';
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
          icon="stamp"
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
              <View style={[styles.glyph, { backgroundColor: softBg(color) }]}>
                <EventGlyph value={t.emoji} fallback="event" size={20} color={deepText(color)} />
              </View>
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
                <Icon name="arrow-up" size={16} />
              </Pressable>
              <Pressable
                onPress={() => moveTemplate(t.id, 1)}
                disabled={i === templates.length - 1}
                style={[styles.order, i === templates.length - 1 && styles.disabled]}
                accessibilityLabel={`Move ${t.name} down`}
              >
                <Icon name="arrow-down" size={16} />
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 5,
    paddingRight: 10,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  glyph: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  order: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  footer: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
});
