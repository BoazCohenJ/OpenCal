import { addHours } from 'date-fns';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarSelector } from '../components/Selectors';
import { Button, Chip, HeaderButton, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { parseEventText } from '../services/naturalLanguage';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { formatRange, nextRoundedHour } from '../utils/dates';

const EXAMPLES = ['Lunch with John Fri 1pm at Cafe X', 'Dentist next Tuesday 9:30am', 'Team offsite Oct 12 - Oct 14', 'Call mom tomorrow 7pm'];

export function QuickAddScreen({ navigation, route }: ScreenProps<'QuickAdd'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { calendars, defaultCalendarId } = useCalendarContext();
  const sharedText = route.params?.sharedText;
  const [text, setText] = useState(sharedText ?? '');
  const [calendarId, setCalendarId] = useState(defaultCalendarId);
  const parsed = useMemo(() => parseEventText(text), [text]);
  const hasInput = text.trim().length > 0;

  useLayoutEffect(() => {
    navigation.setOptions({ headerLeft: () => <HeaderButton title="Cancel" onPress={() => navigation.goBack()} /> });
  }, [navigation]);

  const review = () => {
    const start = parsed.start ?? nextRoundedHour();
    const end = parsed.end ?? addHours(start, 1);
    // Push (not replace) so "Edit text" in the editor returns here with the text intact.
    navigation.push('EventEdit', {
      fromQuickAdd: true,
      draft: {
        title: parsed.title,
        location: parsed.location,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isAllDay: parsed.isAllDay,
        calendarId,
        // The whole message someone shared, so nothing in it is lost once the title is trimmed.
        description: sharedText,
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
        <View style={styles.wrap}>
          {EXAMPLES.map((e) => (
            <Chip key={e} label={e} onPress={() => setText(e)} />
          ))}
        </View>
      ) : (
        <Section title="Preview">
          <PreviewRow label="Title" value={parsed.title || 'Untitled'} muted={!parsed.title} />
          <PreviewRow
            label="When"
            value={parsed.start && parsed.end ? formatRange(parsed.start, parsed.end, parsed.isAllDay) : 'No date found, defaults to the next hour'}
            muted={!parsed.start}
            hint={parsed.dateText ? `from “${parsed.dateText}”` : undefined}
          />
          <PreviewRow label="Where" value={parsed.location ?? 'No location'} muted={!parsed.location} />
        </Section>
      )}

      <Section title="Calendar">
        <CalendarSelector calendars={calendars} value={calendarId} onChange={setCalendarId} />
      </Section>

      <Button title="Review & confirm" onPress={review} disabled={!hasInput} />
    </ScrollView>
  );
}

function PreviewRow({ label, value, muted, hint }: { label: string; value: string; muted?: boolean; hint?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, muted && styles.muted]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  row: { paddingHorizontal: 16, paddingVertical: 12 },
  rowLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  rowValue: { fontSize: 16, color: colors.text, marginTop: 2 },
  muted: { color: colors.textFaint },
  hint: { fontSize: 12, color: colors.primary, marginTop: 2 },
}));
