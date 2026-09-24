import { addHours } from 'date-fns';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarSelector } from '../components/Selectors';
import { Button, Chip, HeaderButton, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { parseEventText } from '../services/naturalLanguage';
import { Icon, type IconName } from '../components/Icon';
import { colors, fonts, radius, spacing } from '../theme';
import { formatRange, nextRoundedHour } from '../utils/dates';

const EXAMPLES = ['Lunch with John Fri 1pm at Cafe X', 'Dentist next Tuesday 9:30am', 'Team offsite Oct 12 - Oct 14', 'Call mom tomorrow 7pm'];

export function QuickAddScreen({ navigation }: ScreenProps<'QuickAdd'>) {
  const { calendars } = useCalendarContext();
  const [text, setText] = useState('');
  const [calendarId, setCalendarId] = useState(calendars[0]?.id ?? '');
  const parsed = useMemo(() => parseEventText(text), [text]);
  const hasInput = text.trim().length > 0;

  useLayoutEffect(() => {
    navigation.setOptions({ headerLeft: () => <HeaderButton title="Cancel" onPress={() => navigation.goBack()} /> });
  }, [navigation]);

  const review = () => {
    const start = parsed.start ?? nextRoundedHour();
    const end = parsed.end ?? addHours(start, 1);
    navigation.replace('EventEdit', {
      draft: {
        title: parsed.title,
        location: parsed.location,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isAllDay: parsed.isAllDay,
        calendarId,
      },
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.inputCard}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Describe your event…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoFocus
          multiline
          submitBehavior="submit"
          onSubmitEditing={() => hasInput && review()}
          returnKeyType="done"
        />
      </View>

      {!hasInput ? (
        <View style={styles.examples}>
          <Text style={styles.examplesTitle}>TRY</Text>
          <View style={styles.wrap}>
            {EXAMPLES.map((e) => (
              <Chip key={e} label={e} onPress={() => setText(e)} />
            ))}
          </View>
        </View>
      ) : (
        <Section title="We understood" footer="You can fix anything on the next screen before saving.">
          <PreviewRow icon="title" label="Title" value={parsed.title || 'Untitled'} muted={!parsed.title} />
          <PreviewRow
            icon="calendar"
            label="When"
            value={parsed.start && parsed.end ? formatRange(parsed.start, parsed.end, parsed.isAllDay) : 'No date found, defaults to the next hour'}
            muted={!parsed.start}
            hint={parsed.dateText ? `from “${parsed.dateText}”` : undefined}
          />
          <PreviewRow icon="map-pin" label="Where" value={parsed.location ?? 'No location'} muted={!parsed.location} />
        </Section>
      )}

      <Section title="Calendar">
        <CalendarSelector calendars={calendars} value={calendarId} onChange={setCalendarId} />
      </Section>

      <Button title="Review & confirm" onPress={review} disabled={!hasInput} />
    </ScrollView>
  );
}

function PreviewRow({ icon, label, value, muted, hint }: { icon: IconName; label: string; value: string; muted?: boolean; hint?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, muted && styles.muted]}>{value}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: spacing.lg,
  },
  input: { fontSize: 22, fontFamily: fonts.display, color: colors.text, minHeight: 60 },
  examples: { marginBottom: spacing.lg, gap: 8 },
  examplesTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  rowValue: { fontSize: 16, color: colors.text, marginTop: 2 },
  muted: { color: colors.textFaint },
  hint: { fontSize: 12, color: colors.primary, marginTop: 2 },
});
