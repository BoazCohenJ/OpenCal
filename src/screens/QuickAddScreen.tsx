import { addMinutes, format } from 'date-fns';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { CalendarSelector } from '../components/Selectors';
import { useToast } from '../components/Toast';
import { Button, Chip, Divider, HeaderButton, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { parseEventText } from '../services/naturalLanguage';
import { buildNewEvent } from '../services/newEvent';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { formatRange, nextRoundedHour } from '../utils/dates';

const EXAMPLES = ['Lunch with John Fri 1pm at Cafe X', 'Dentist next Tuesday 9:30am', 'Team offsite Oct 12 - Oct 14', 'Call mom tomorrow 7pm'];

export function QuickAddScreen({ navigation, route }: ScreenProps<'QuickAdd'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const showToast = useToast();
  const { calendars, calendarsById, defaultCalendarId, defaultEventMinutes, notificationPrefs, saveEvent, deleteEvent } =
    useCalendarContext();
  const sharedText = route.params?.sharedText;
  const [text, setText] = useState(sharedText ?? '');
  const [calendarId, setCalendarId] = useState(defaultCalendarId);
  const [focused, setFocused] = useState(true);
  const added = useRef(false);
  const parsed = useMemo(() => parseEventText(text), [text]);
  const hasInput = text.trim().length > 0;

  useLayoutEffect(() => {
    navigation.setOptions({ headerLeft: () => <HeaderButton title="Cancel" onPress={() => navigation.goBack()} /> });
  }, [navigation]);

  const resolvedTimes = () => {
    const start = parsed.start ?? nextRoundedHour();
    const end = parsed.end ?? addMinutes(start, defaultEventMinutes);
    return { start, end };
  };

  const addNow = () => {
    if (!hasInput || added.current) return;
    added.current = true;
    const { start, end } = resolvedTimes();
    const event = buildNewEvent(
      {
        title: parsed.title || text.trim(),
        location: parsed.location,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isAllDay: parsed.isAllDay,
        calendarId,
        description: sharedText,
      },
      defaultCalendarId,
      calendarsById,
      notificationPrefs,
      defaultEventMinutes,
    );
    saveEvent(event);
    navigation.goBack();
    showToast({
      icon: 'check',
      message: `Added ${event.title} · ${event.isAllDay ? format(start, 'EEE, MMM d') : format(start, 'EEE h:mm a')}`,
      actionLabel: 'Undo',
      onAction: () => deleteEvent(event.id),
    });
  };

  const review = () => {
    const { start, end } = resolvedTimes();
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
      <View style={[styles.inputCard, focused && styles.inputCardFocused]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Describe your event…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoFocus
          multiline
          submitBehavior="submit"
          onSubmitEditing={() => hasInput && addNow()}
          returnKeyType="done"
        />
        {hasInput ? (
          <Pressable onPress={() => setText('')} hitSlop={10} accessibilityLabel="Clear text" style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <Icon name="x" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
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
          <Divider />
          <PreviewRow
            label="When"
            value={parsed.start && parsed.end ? formatRange(parsed.start, parsed.end, parsed.isAllDay) : 'No date found, defaults to the next hour'}
            muted={!parsed.start}
            hint={parsed.dateText ? `from “${parsed.dateText}”` : undefined}
          />
          <Divider />
          <PreviewRow label="Where" value={parsed.location ?? 'No location'} muted={!parsed.location} />
        </Section>
      )}

      <Section title="Calendar">
        <CalendarSelector calendars={calendars} value={calendarId} onChange={setCalendarId} />
      </Section>

      <View style={styles.actions}>
        <Button title="Add event" onPress={addNow} disabled={!hasInput} />
        <Button variant="secondary" title="More options" onPress={review} disabled={!hasInput} />
      </View>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: spacing.lg,
  },
  inputCardFocused: { borderColor: colors.primary },
  input: { flex: 1, fontSize: 22, fontFamily: fonts.display, color: colors.text, minHeight: 60 },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pressed: { opacity: 0.7 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  row: { paddingHorizontal: 16, paddingVertical: 12 },
  rowLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  rowValue: { fontSize: 16, color: colors.text, marginTop: 2 },
  muted: { color: colors.textFaint },
  hint: { fontSize: 12, color: colors.primary, marginTop: 2 },
  actions: { gap: 10 },
}));
