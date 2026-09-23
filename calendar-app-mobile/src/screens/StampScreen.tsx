import { addDays, addMinutes, endOfDay, format } from 'date-fns';
import React, { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateTimeField } from '../components/DateTimeField';
import { Button, ColorDot, EmptyState, Field, HeaderButton, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { eventFromTemplate } from '../services/templates';
import { colors, radius, spacing } from '../theme';
import { formatTime, nextRoundedHour } from '../utils/dates';
import { formatDuration, formatReminder } from '../utils/format';

/** Drop a saved stamp onto a date/time: everything pre-fills, only the time needs confirming. */
export function StampScreen({ navigation, route }: ScreenProps<'Stamp'>) {
  const { templates, calendars, calendarsById, saveEvent } = useCalendarContext();
  const [templateId, setTemplateId] = useState(route.params?.templateId);
  const [start, setStart] = useState(() => (route.params?.start ? new Date(route.params.start) : nextRoundedHour()));
  const template = templates.find((t) => t.id === templateId);

  useLayoutEffect(() => {
    navigation.setOptions({ headerLeft: () => <HeaderButton title="Cancel" onPress={() => navigation.goBack()} /> });
  }, [navigation]);

  if (!template) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {templates.length === 0 ? (
          <EmptyState
            emoji="🔖"
            title="No stamps yet"
            subtitle="Stamps are reusable events for things that happen often but not on a schedule, like “Coffee with John”."
          >
            <Button title="Create a stamp" onPress={() => navigation.replace('TemplateEdit')} />
          </EmptyState>
        ) : (
          <>
            <Text style={styles.heading}>Choose a stamp for {format(start, 'EEE, MMM d · h:mm a')}</Text>
            {templates.map((t) => {
              const cal = calendarsById[t.calendarId];
              const color = t.color ?? cal?.color ?? colors.primary;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTemplateId(t.id)}
                  style={({ pressed }) => [styles.card, { borderLeftColor: color }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.cardEmoji}>{t.emoji ?? '🔖'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{t.name}</Text>
                    <Text style={styles.cardMeta}>
                      {t.isAllDay ? 'All day' : formatDuration(t.durationMinutes)}
                      {cal ? ` · ${cal.name}` : ''}
                      {t.location ? ` · ${t.location}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  }

  const calendar = calendarsById[template.calendarId] ?? calendars[0];
  const color = template.color ?? calendar?.color ?? colors.primary;
  const days = Math.max(1, Math.round(template.durationMinutes / 1440));
  const end = template.isAllDay ? endOfDay(addDays(start, days - 1)) : addMinutes(start, template.durationMinutes);

  const add = () => {
    if (!calendar) return;
    saveEvent(eventFromTemplate(template, start, calendar.id));
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.preview, { borderLeftColor: color }]}>
        <Text style={styles.previewEmoji}>{template.emoji ?? '🔖'}</Text>
        <Text style={styles.previewTitle}>{template.title}</Text>
        <View style={styles.metaRow}>
          {calendar ? (
            <View style={styles.metaItem}>
              <ColorDot color={calendar.color} size={10} />
              <Text style={styles.metaText}>{calendar.name}</Text>
            </View>
          ) : null}
          <Text style={styles.metaText}>{template.isAllDay ? `${days} day${days > 1 ? 's' : ''}` : formatDuration(template.durationMinutes)}</Text>
          {template.location ? <Text style={styles.metaText}>📍 {template.location}</Text> : null}
        </View>
        {template.reminders.length ? <Text style={styles.metaText}>🔔 {template.reminders.map(formatReminder).join(', ')}</Text> : null}
      </View>

      <Section title="When">
        <Field label={template.isAllDay ? 'Date' : 'Starts'}>
          <DateTimeField value={start} onChange={setStart} mode={template.isAllDay ? 'date' : 'datetime'} />
        </Field>
        <Text style={styles.ends}>
          {template.isAllDay ? `Ends ${format(end, 'EEE, MMM d')}` : `Ends ${format(end, 'EEE, MMM d')} at ${formatTime(end)}`}
        </Text>
      </Section>

      <View style={styles.actions}>
        <Button title="Add to calendar" onPress={add} />
        <Button variant="ghost" title="Choose another stamp" onPress={() => setTemplateId(undefined)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  heading: { fontSize: 15, color: colors.textMuted, marginBottom: spacing.md, fontWeight: '500' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderLeftWidth: 5, padding: 14, marginBottom: 10 },
  cardEmoji: { fontSize: 26 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textFaint },
  preview: { backgroundColor: colors.surface, borderRadius: radius.lg, borderLeftWidth: 6, padding: 18, gap: 8, marginBottom: spacing.lg },
  previewEmoji: { fontSize: 36 },
  previewTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: colors.textMuted },
  ends: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 16, paddingBottom: 14 },
  actions: { gap: 8 },
});
