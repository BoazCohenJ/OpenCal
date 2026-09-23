import React, { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { PauseWindowsEditor } from '../components/PauseWindowsEditor';
import { Button, Chip, Field, HeaderButton, Section, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Calendar } from '../models/Calendar';
import type { ScreenProps } from '../navigation/types';
import { colors, PALETTE, spacing } from '../theme';
import { confirmAsync, notify } from '../utils/confirm';
import { newId } from '../utils/id';

export function CalendarEditScreen({ navigation, route }: ScreenProps<'CalendarEdit'>) {
  const { calendars, events, saveCalendar, deleteCalendar } = useCalendarContext();
  const existing = calendars.find((c) => c.id === route.params?.calendarId);
  const [form, setForm] = useState<Calendar>(
    () =>
      existing ?? {
        id: newId(),
        name: '',
        color: PALETTE[calendars.length % PALETTE.length]!,
        sortOrder: calendars.length,
        pauseWindows: [],
      },
  );
  const others = calendars.filter((c) => c.id !== form.id);
  const [reassignTo, setReassignTo] = useState<string | null>(others[0]?.id ?? null);
  const eventCount = events.filter((e) => e.calendarId === form.id).length;
  const recurringCount = events.filter((e) => e.calendarId === form.id && e.recurrenceRule).length;

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      notify('Name your calendar', 'For example “Work” or “Personal”.');
      return;
    }
    saveCalendar({ ...form, name });
    navigation.goBack();
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Calendar' : 'New Calendar',
      headerRight: () => <HeaderButton title="Save" bold onPress={() => saveRef.current()} />,
    });
  }, [navigation, existing]);

  const remove = async () => {
    if (!existing) return;
    const target = others.find((c) => c.id === reassignTo);
    const message =
      eventCount === 0
        ? 'This calendar has no events.'
        : target
          ? `Its ${eventCount} event(s) will move to “${target.name}”.`
          : `Its ${eventCount} event(s) will be deleted.`;
    if (!(await confirmAsync(`Delete “${existing.name}”?`, message, 'Delete', true))) return;
    deleteCalendar(existing.id, eventCount > 0 ? reassignTo : null);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Section>
        <Field label="Name">
          <TextField value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="e.g. Work" autoFocus={!existing} />
        </Field>
      </Section>

      <Section title="Default color" footer="Events in this calendar use this color unless they set their own.">
        <ColorPicker value={form.color} onChange={(color) => color && setForm((f) => ({ ...f, color }))} />
      </Section>

      <Section
        title="Pause calendar"
        footer={`Pausing skips every repeating event in this calendar during these dates${
          recurringCount ? ` (${recurringCount} repeating event${recurringCount === 1 ? '' : 's'})` : ''
        }. It combines with each event's own pauses, and the events resume automatically afterwards.`}
      >
        <PauseWindowsEditor value={form.pauseWindows} onChange={(pauseWindows) => setForm((f) => ({ ...f, pauseWindows }))} />
      </Section>

      {existing && others.length > 0 ? (
        <Section title="Delete calendar">
          <View style={styles.deleteBox}>
            {eventCount > 0 ? (
              <>
                <Text style={styles.deleteText}>What should happen to its {eventCount} event(s)?</Text>
                <View style={styles.wrap}>
                  {others.map((c) => (
                    <Chip key={c.id} label={`Move to ${c.name}`} color={c.color} selected={reassignTo === c.id} onPress={() => setReassignTo(c.id)} />
                  ))}
                  <Chip label="Delete them" selected={reassignTo === null} onPress={() => setReassignTo(null)} />
                </View>
              </>
            ) : null}
            <Button variant="danger" title="Delete calendar" onPress={remove} />
          </View>
        </Section>
      ) : null}
      {existing && others.length === 0 ? <Text style={styles.note}>This is your only calendar, so it can’t be deleted.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  deleteBox: { padding: 16, gap: 12 },
  deleteText: { fontSize: 14, color: colors.textMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
