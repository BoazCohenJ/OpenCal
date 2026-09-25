import { addDays, nextMonday, setHours, startOfDay } from 'date-fns';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { DateTimeField } from '../components/DateTimeField';
import { Icon } from '../components/Icon';
import { RecurrenceEditor } from '../components/RecurrenceEditor';
import { Button, Chip, Field, HeaderButton, Section, Segmented, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { FocusKind, FocusWindow } from '../models/NotificationPrefs';
import type { ScreenProps } from '../navigation/types';
import { createStyles, radius, spacing, useTheme } from '../theme';
import { confirmAsync } from '../utils/confirm';
import { newId } from '../utils/id';

const KIND_COPY: Record<FocusKind, { title: string; body: string }> = {
  quiet: { title: 'Quiet', body: 'Reminders still arrive during this time, just without sound.' },
  dnd: { title: 'Do Not Disturb', body: 'No reminders at all during this time. Anything due is skipped.' },
};

const at = (day: Date, hours: number, minutes = 0) => new Date(setHours(startOfDay(day), hours).getTime() + minutes * 60000);

interface Preset {
  label: string;
  build: () => Pick<FocusWindow, 'startDate' | 'endDate' | 'recurrenceRule'>;
}

const PRESETS: Preset[] = [
  {
    label: 'Tonight',
    build: () => ({ startDate: at(new Date(), 22).toISOString(), endDate: at(addDays(new Date(), 1), 7).toISOString() }),
  },
  {
    label: 'Every night',
    build: () => ({
      startDate: at(new Date(), 22).toISOString(),
      endDate: at(addDays(new Date(), 1), 7).toISOString(),
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
    }),
  },
  {
    label: 'Weekdays 9–5',
    build: () => ({
      startDate: at(nextMonday(new Date()), 9).toISOString(),
      endDate: at(nextMonday(new Date()), 17).toISOString(),
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR',
    }),
  },
  {
    label: 'Mondays 5–6 PM',
    build: () => ({
      startDate: at(nextMonday(new Date()), 17).toISOString(),
      endDate: at(nextMonday(new Date()), 18).toISOString(),
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
    }),
  },
  {
    label: 'Weekends',
    build: () => {
      const sat = addDays(nextMonday(new Date()), -2);
      return {
        startDate: at(sat, 0).toISOString(),
        endDate: at(addDays(sat, 2), 0).toISOString(),
        recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SA',
      };
    },
  },
];

/** Create or edit a scheduled quiet / Do Not Disturb window. */
export function FocusEditScreen({ navigation, route }: ScreenProps<'FocusEdit'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { notificationPrefs, updateNotificationPrefs } = useCalendarContext();
  const existing = notificationPrefs.focusWindows.find((w) => w.id === route.params?.windowId);
  const [form, setForm] = useState<FocusWindow>(() => {
    if (existing) return existing;
    const start = at(new Date(), 22);
    return {
      id: newId(),
      kind: route.params?.kind ?? 'quiet',
      startDate: start.toISOString(),
      endDate: at(addDays(new Date(), 1), 7).toISOString(),
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
      enabled: true,
    };
  });
  const update = (patch: Partial<FocusWindow>) => setForm((f) => ({ ...f, ...patch }));
  const start = new Date(form.startDate);
  const end = new Date(form.endDate);

  const setStart = (d: Date) => {
    const duration = Math.max(15 * 60000, end.getTime() - start.getTime());
    update({ startDate: d.toISOString(), endDate: new Date(d.getTime() + duration).toISOString() });
  };
  // Ends before the start mean "overnight": roll to the next day instead of rejecting.
  const setEnd = (d: Date) => update({ endDate: (d <= start ? addDays(d, 1) : d).toISOString() });

  const save = () => {
    const others = notificationPrefs.focusWindows.filter((w) => w.id !== form.id);
    const cleaned = { ...form, label: form.label?.trim() || undefined };
    updateNotificationPrefs({ focusWindows: [...others, cleaned] });
    navigation.goBack();
  };
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `${existing ? 'Edit' : 'New'} ${form.kind === 'dnd' ? 'Do Not Disturb' : 'quiet time'}`,
      headerLeft: () => <HeaderButton title="Cancel" onPress={() => navigation.goBack()} />,
      headerRight: () => <HeaderButton title="Save" bold onPress={() => saveRef.current()} />,
    });
  }, [navigation, existing, form.kind]);

  const remove = async () => {
    if (!existing) return;
    if (!(await confirmAsync('Delete this quiet time?', 'Reminders during it will play normally again.', 'Delete', true))) return;
    updateNotificationPrefs({ focusWindows: notificationPrefs.focusWindows.filter((w) => w.id !== existing.id) });
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.kindCard, form.kind === 'dnd' && styles.kindCardDnd]}>
        <Segmented<FocusKind>
          options={[
            { value: 'quiet', label: 'Quiet' },
            { value: 'dnd', label: 'Do Not Disturb' },
          ]}
          value={form.kind}
          onChange={(kind) => update({ kind })}
        />
        <View style={styles.kindBody}>
          <Icon name={form.kind === 'dnd' ? 'bell-off' : 'moon'} size={20} color={colors.primary} />
          <Text style={styles.kindText}>{KIND_COPY[form.kind].body}</Text>
        </View>
      </View>

      <Section>
        <Field label="Name (optional)">
          <TextField value={form.label ?? ''} onChangeText={(label) => update({ label })} placeholder={KIND_COPY[form.kind].title} />
        </Field>
      </Section>

      {!existing ? (
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Chip key={p.label} label={p.label} onPress={() => update({ recurrenceRule: undefined, ...p.build() })} />
          ))}
        </View>
      ) : null}

      <Section title="When">
        <Field label="Starts">
          <DateTimeField value={start} onChange={setStart} />
        </Field>
        <Field label="Ends">
          <DateTimeField value={end} onChange={setEnd} />
        </Field>
      </Section>

      <Section title="Repeat">
        <RecurrenceEditor value={form.recurrenceRule} start={start} onChange={(recurrenceRule) => update({ recurrenceRule })} />
      </Section>

      {existing ? (
        <>
          <Section>
            <SwitchRow label="Active" value={form.enabled} onValueChange={(enabled) => update({ enabled })} />
          </Section>
          <Button variant="danger" title="Delete" onPress={() => void remove()} />
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  kindCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  kindCardDnd: { borderColor: colors.primary },
  kindBody: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  kindText: { flex: 1, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
}));
