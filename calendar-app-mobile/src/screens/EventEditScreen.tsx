import { addHours, endOfDay, setHours, startOfDay } from 'date-fns';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { DateTimeField } from '../components/DateTimeField';
import { EmojiPicker } from '../components/EmojiPicker';
import { PauseWindowsEditor } from '../components/PauseWindowsEditor';
import { RecurrenceEditor } from '../components/RecurrenceEditor';
import { CalendarSelector, ReminderPicker, TagEditor } from '../components/Selectors';
import { Button, Divider, Field, HeaderButton, Section, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Event } from '../models/Event';
import type { EventDraft, ScreenProps } from '../navigation/types';
import { templateFromEvent } from '../services/templates';
import { colors, radius, spacing } from '../theme';
import { confirmAsync, notify } from '../utils/confirm';
import { formatPauseWindow, nextRoundedHour } from '../utils/dates';
import { newId } from '../utils/id';

function buildInitial(existing: Event | undefined, draft: EventDraft | undefined, defaultCalendarId: string): Event {
  if (existing) return existing;
  const start = draft?.startDate ? new Date(draft.startDate) : nextRoundedHour();
  const merged: Event = {
    id: newId(),
    title: '',
    startDate: start.toISOString(),
    endDate: addHours(start, 1).toISOString(),
    isAllDay: false,
    calendarId: defaultCalendarId,
    pauseWindows: [],
    reminders: [10],
    tags: [],
  };
  if (draft) {
    for (const [k, v] of Object.entries(draft)) {
      if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return merged;
}

export function EventEditScreen({ navigation, route }: ScreenProps<'EventEdit'>) {
  const { calendars, calendarsById, events, saveEvent, deleteEvent, saveTemplate, allTags } = useCalendarContext();
  const existing = route.params?.eventId ? events.find((e) => e.id === route.params?.eventId) : undefined;
  const [form, setForm] = useState<Event>(() => {
    const initial = buildInitial(existing, route.params?.draft, calendars[0]?.id ?? '');
    return calendarsById[initial.calendarId] ? initial : { ...initial, calendarId: calendars[0]?.id ?? '' };
  });
  const [showEmoji, setShowEmoji] = useState(false);

  const update = (patch: Partial<Event>) => setForm((f) => ({ ...f, ...patch }));
  const start = new Date(form.startDate);
  const end = new Date(form.endDate);
  const calendar = calendarsById[form.calendarId];

  const setStart = (d: Date) => {
    const duration = Math.max(0, end.getTime() - start.getTime());
    update({ startDate: d.toISOString(), endDate: new Date(d.getTime() + duration).toISOString() });
  };
  const setEnd = (d: Date) => update({ endDate: (form.isAllDay ? endOfDay(d) : d).toISOString() });
  const setAllDay = (allDay: boolean) =>
    update(
      allDay
        ? { isAllDay: true, startDate: startOfDay(start).toISOString(), endDate: endOfDay(end < start ? start : end).toISOString() }
        : {
            isAllDay: false,
            startDate: setHours(startOfDay(start), 9).toISOString(),
            endDate: setHours(startOfDay(start), 10).toISOString(),
          },
    );

  const normalized = (): Event | null => {
    const title = form.title.trim();
    if (!title) {
      notify('Add a title', 'Give your event a name before saving.');
      return null;
    }
    const s = form.isAllDay ? startOfDay(start) : start;
    const e = form.isAllDay ? endOfDay(end) : end;
    if (e < s) {
      notify('Check the times', 'The event ends before it starts.');
      return null;
    }
    return {
      ...form,
      title,
      startDate: s.toISOString(),
      endDate: e.toISOString(),
      location: form.location?.trim() || undefined,
      description: form.description?.trim() || undefined,
      pauseWindows: form.recurrenceRule ? form.pauseWindows : [],
    };
  };

  const save = () => {
    const event = normalized();
    if (!event) return;
    saveEvent(event);
    navigation.goBack();
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Event' : 'New Event',
      headerLeft: () => <HeaderButton title="Cancel" onPress={() => navigation.goBack()} />,
      headerRight: () => <HeaderButton title="Save" bold onPress={() => saveRef.current()} />,
    });
  }, [navigation, existing]);

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAsync(
      'Delete event?',
      existing.recurrenceRule ? 'This deletes every occurrence of this repeating event.' : 'This cannot be undone.',
      'Delete',
      true,
    );
    if (!ok) return;
    deleteEvent(existing.id);
    navigation.goBack();
  };

  const saveAsStamp = () => {
    const event = normalized();
    if (!event) return;
    saveTemplate(templateFromEvent(event));
    notify('Saved as stamp', `“${event.title}” is now in Settings › Stamps and can be dropped onto any date.`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.titleCard}>
        <Pressable style={styles.emojiButton} onPress={() => setShowEmoji((v) => !v)} accessibilityLabel="Choose emoji">
          <Text style={[styles.emojiText, !form.emoji && styles.emojiPlaceholder]}>{form.emoji ?? '☺︎'}</Text>
        </Pressable>
        <TextInput
          style={styles.titleInput}
          placeholder="Event title"
          placeholderTextColor={colors.textFaint}
          value={form.title}
          onChangeText={(title) => update({ title })}
          autoFocus={!existing && !form.title}
          returnKeyType="done"
        />
      </View>
      {showEmoji ? (
        <Section title="Emoji" footer="Shown next to the title in every view.">
          <EmojiPicker
            value={form.emoji}
            onChange={(emoji) => {
              update({ emoji });
              setShowEmoji(false);
            }}
          />
        </Section>
      ) : null}

      <Section title="Calendar">
        <CalendarSelector calendars={calendars} value={form.calendarId} onChange={(calendarId) => update({ calendarId })} />
      </Section>

      <Section title="When">
        <SwitchRow label="All day" value={form.isAllDay} onValueChange={setAllDay} />
        <Divider />
        <Field label="Starts">
          <DateTimeField value={start} onChange={setStart} mode={form.isAllDay ? 'date' : 'datetime'} />
        </Field>
        <Field label="Ends">
          <DateTimeField value={end} onChange={setEnd} mode={form.isAllDay ? 'date' : 'datetime'} />
        </Field>
      </Section>

      <Section title="Repeat">
        <RecurrenceEditor value={form.recurrenceRule} start={start} onChange={(recurrenceRule) => update({ recurrenceRule })} />
      </Section>

      {form.recurrenceRule ? (
        <Section title="Pauses" footer="Occurrences inside a pause are skipped and the series resumes automatically afterwards.">
          <PauseWindowsEditor value={form.pauseWindows} onChange={(pauseWindows) => update({ pauseWindows })} />
          {calendar && calendar.pauseWindows.length > 0 ? (
            <Text style={styles.inherited}>
              Also paused by “{calendar.name}”: {calendar.pauseWindows.map(formatPauseWindow).join(', ')}
            </Text>
          ) : null}
        </Section>
      ) : null}

      <Section title="Reminders">
        <ReminderPicker value={form.reminders} onChange={(reminders) => update({ reminders })} />
      </Section>

      <Section title="Details">
        <Field label="Location">
          <TextField value={form.location ?? ''} onChangeText={(location) => update({ location })} placeholder="Add a place" />
        </Field>
        <Field label="Notes">
          <TextField value={form.description ?? ''} onChangeText={(description) => update({ description })} placeholder="Add a description" multiline />
        </Field>
        <Field label="Tags">
          <TagEditor value={form.tags} onChange={(tags) => update({ tags })} suggestions={allTags} />
        </Field>
      </Section>

      <Section title="Color" footer="Overrides the calendar color for this event only.">
        <ColorPicker value={form.color} inheritColor={calendar?.color} onChange={(color) => update({ color })} />
      </Section>

      <View style={styles.actions}>
        <Button variant="secondary" title="🔖  Save as stamp" onPress={saveAsStamp} />
        {existing ? <Button variant="danger" title="Delete event" onPress={remove} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: spacing.lg,
  },
  emojiButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26 },
  emojiPlaceholder: { color: colors.textFaint, fontSize: 24 },
  titleInput: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text, paddingVertical: 6 },
  inherited: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 16, paddingBottom: 14 },
  actions: { gap: 10, marginTop: 4 },
});
