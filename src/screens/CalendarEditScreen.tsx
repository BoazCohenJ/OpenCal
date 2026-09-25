import React, { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { PauseWindowsEditor } from '../components/PauseWindowsEditor';
import { RecurrenceEditor } from '../components/RecurrenceEditor';
import { ReminderEditor } from '../components/ReminderEditor';
import { TagEditor } from '../components/Selectors';
import { Button, Divider, Field, HeaderButton, Section, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Calendar, CalendarDefaults } from '../models/Calendar';
import type { ScreenProps } from '../navigation/types';
import { createStyles, PALETTE, spacing } from '../theme';
import { notify } from '../utils/confirm';
import { newId } from '../utils/id';
import { animateNextLayout } from '../utils/motion';

export function CalendarEditScreen({ navigation, route }: ScreenProps<'CalendarEdit'>) {
  const styles = useStyles();
  const { calendars, events, saveCalendar, allTags, notificationPrefs } = useCalendarContext();
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
  const eventCount = events.filter((e) => e.calendarId === form.id).length;
  const recurringCount = events.filter((e) => e.calendarId === form.id && e.recurrenceRule).length;
  const defaults = form.defaults ?? {};
  const setDefaults = (patch: CalendarDefaults) => setForm((f) => ({ ...f, defaults: { ...f.defaults, ...patch } }));
  // Only ever used as a reference date for the repeat editor's weekday default.
  const [repeatStart] = useState(() => new Date());

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      notify('Name your calendar', 'For example “Work” or “Personal”.');
      return;
    }
    const location = defaults.location?.trim() || undefined;
    const cleaned: CalendarDefaults = { ...defaults, location, tags: defaults.tags?.length ? defaults.tags : undefined };
    const hasDefaults = Object.values(cleaned).some((v) => v !== undefined);
    saveCalendar({ ...form, name, defaults: hasDefaults ? cleaned : undefined });
    navigation.goBack();
  };
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Calendar' : 'New Calendar',
      headerRight: () => <HeaderButton title="Save" bold onPress={() => saveRef.current()} />,
    });
  }, [navigation, existing]);

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
        title="Defaults for new events"
        footer="New events in this calendar start with these. Anything you change on an event stays with that event."
      >
        <SwitchRow
          label="Custom reminders"
          subtitle={defaults.reminders ? undefined : 'Using the defaults from Notifications'}
          value={defaults.reminders !== undefined}
          onValueChange={(on) => {
            animateNextLayout();
            setDefaults({ reminders: on ? [...notificationPrefs.defaultReminders] : undefined });
          }}
        />
        {defaults.reminders !== undefined ? (
          <ReminderEditor value={defaults.reminders} onChange={(reminders) => setDefaults({ reminders })} />
        ) : null}
        <Divider />
        <Text style={styles.subhead}>Repeat</Text>
        <RecurrenceEditor value={defaults.recurrenceRule} start={repeatStart} onChange={(recurrenceRule) => setDefaults({ recurrenceRule })} />
        <Divider />
        <Field label="Location">
          <TextField value={defaults.location ?? ''} onChangeText={(location) => setDefaults({ location })} placeholder="No default location" />
        </Field>
        <Field label="Tags">
          <TagEditor value={defaults.tags ?? []} onChange={(tags) => setDefaults({ tags })} suggestions={allTags} />
        </Field>
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
        <Button
          variant="danger"
          title={eventCount ? `Delete calendar (${eventCount} event${eventCount === 1 ? '' : 's'})…` : 'Delete calendar…'}
          onPress={() => navigation.navigate('CalendarDelete', { calendarId: existing.id })}
        />
      ) : null}
      {existing && others.length === 0 ? <Text style={styles.note}>This is your only calendar, so it can’t be deleted.</Text> : null}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  subhead: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  note: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
