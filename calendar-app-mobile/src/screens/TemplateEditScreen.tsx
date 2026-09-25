import React, { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { IconButtonTile, IconPicker } from '../components/IconPicker';
import { DurationField } from '../components/DurationField';
import { ReminderEditor } from '../components/ReminderEditor';
import { CalendarSelector, TagEditor } from '../components/Selectors';
import { Button, Divider, Field, HeaderButton, Section, Stepper, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { EventTemplate } from '../models/Template';
import type { ScreenProps } from '../navigation/types';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { confirmAsync, notify } from '../utils/confirm';
import { newId } from '../utils/id';
import { animateNextLayout } from '../utils/motion';


export function TemplateEditScreen({ navigation, route }: ScreenProps<'TemplateEdit'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { templates, calendars, calendarsById, saveTemplate, deleteTemplate, allTags, notificationPrefs } = useCalendarContext();
  const existing = templates.find((t) => t.id === route.params?.templateId);
  const [form, setForm] = useState<EventTemplate>(
    () =>
      existing ?? {
        id: newId(),
        name: '',
        title: '',
        durationMinutes: 60,
        isAllDay: false,
        calendarId: calendars[0]?.id ?? '',
        reminders: [...notificationPrefs.defaultReminders],
        tags: [],
        sortOrder: templates.length,
      },
  );
  const [showEmoji, setShowEmoji] = useState(false);
  const update = (patch: Partial<EventTemplate>) => setForm((f) => ({ ...f, ...patch }));
  const calendar = calendarsById[form.calendarId];
  const stampColor = form.color ?? calendar?.color ?? colors.primary;
  const days = Math.max(1, Math.round(form.durationMinutes / 1440));

  const save = () => {
    const title = form.title.trim();
    if (!title) {
      notify('Add an event title', 'This is the title events created from the stamp will get.');
      return;
    }
    saveTemplate({
      ...form,
      title,
      name: form.name.trim() || title,
      location: form.location?.trim() || undefined,
      description: form.description?.trim() || undefined,
      calendarId: calendar ? form.calendarId : calendars[0]?.id ?? '',
    });
    navigation.goBack();
  };
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Stamp' : 'New Stamp',
      headerRight: () => <HeaderButton title="Save" bold onPress={() => saveRef.current()} />,
    });
  }, [navigation, existing]);

  const remove = async () => {
    if (!existing) return;
    if (!(await confirmAsync(`Delete “${existing.name}”?`, 'Events already created from it are kept.', 'Delete', true))) return;
    deleteTemplate(existing.id);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.titleCard}>
        <IconButtonTile value={form.emoji} color={stampColor} onPress={() => {
            animateNextLayout();
            setShowEmoji((v) => !v);
          }} />
        <TextInput
          style={styles.titleInput}
          placeholder="Event title, e.g. Coffee with John"
          placeholderTextColor={colors.textFaint}
          value={form.title}
          onChangeText={(title) => update({ title })}
          autoFocus={!existing}
        />
      </View>
      {showEmoji ? (
        <Section title="Icon">
          <IconPicker
            color={stampColor}
            value={form.emoji}
            onChange={(emoji) => {
              update({ emoji });
              setShowEmoji(false);
            }}
          />
        </Section>
      ) : null}

      <Section footer="Shown in the stamp list. Defaults to the event title.">
        <Field label="Stamp name">
          <TextField value={form.name} onChangeText={(name) => update({ name })} placeholder={form.title || 'Stamp name'} />
        </Field>
      </Section>

      <Section title="Calendar">
        <CalendarSelector calendars={calendars} value={form.calendarId} onChange={(calendarId) => update({ calendarId })} />
      </Section>

      <Section title="Duration">
        <SwitchRow
          label="All day"
          value={form.isAllDay}
          onValueChange={(isAllDay) => update({ isAllDay, durationMinutes: isAllDay ? 1440 : 60 })}
        />
        <Divider />
        {form.isAllDay ? (
          <Field label="Length">
            <Stepper value={days} min={1} max={60} onChange={(d) => update({ durationMinutes: d * 1440 })} format={(v) => `${v} day${v === 1 ? '' : 's'}`} />
          </Field>
        ) : (
          <Field label="Length">
            <DurationField value={form.durationMinutes} onChange={(durationMinutes) => update({ durationMinutes })} />
          </Field>
        )}
      </Section>

      <Section title="Reminders">
        <ReminderEditor
          value={form.reminders}
          onChange={(reminders) => update({ reminders })}
          allDay={form.isAllDay}
          allDayTime={notificationPrefs.allDayTime}
        />
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

      <Section title="Color">
        <ColorPicker value={form.color} inheritColor={calendar?.color} onChange={(color) => update({ color })} />
      </Section>

      {existing ? <Button variant="danger" title="Delete stamp" onPress={remove} /> : null}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
    marginBottom: spacing.lg,
  },
  titleInput: { flex: 1, fontSize: 20, fontFamily: fonts.display, color: colors.text, paddingVertical: 6 },
}));
