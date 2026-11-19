import React, { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { PauseWindowsEditor } from '../components/PauseWindowsEditor';
import { RecurrenceEditor } from '../components/RecurrenceEditor';
import { ReminderEditor } from '../components/ReminderEditor';
import { TagEditor } from '../components/Selectors';
import { Button, Divider, Field, HeaderButton, Section, Segmented, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import { DEFAULT_FOLD, type Calendar, type CalendarDefaults, type CalendarFold } from '../models/Calendar';
import type { ScreenProps } from '../navigation/types';
import { shareICS } from '../services/exports';
import { createStyles, PALETTE, spacing } from '../theme';
import { notify } from '../utils/confirm';
import { newId } from '../utils/id';
import { animateNextLayout } from '../utils/motion';

const FOLD_INFO =
  'Back-to-back events show as one block named after this calendar. Good for a school day of lessons or a day of meetings. Tap a block to see its events, or use Show all events in the View menu. Reminders still come for every event.';

/** Gap choices for joining events into one folded block, in minutes. */
const FOLD_GAPS = ['15', '30', '60', '120'] as const;
const gapLabel = (m: string) => (m === '60' ? '1 hour' : m === '120' ? '2 hours' : `${m} min`);
const nearestGap = (minutes: number) =>
  FOLD_GAPS.reduce((best, m) => (Math.abs(Number(m) - minutes) < Math.abs(Number(best) - minutes) ? m : best), FOLD_GAPS[0]);

export function CalendarEditScreen({ navigation, route }: ScreenProps<'CalendarEdit'>) {
  const styles = useStyles();
  const { calendars, calendarsById, events, saveCalendar, allTags, notificationPrefs } = useCalendarContext();
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
  const fold: CalendarFold = { ...DEFAULT_FOLD, enabled: false, ...form.fold };
  const setFold = (patch: Partial<CalendarFold>) => setForm((f) => ({ ...f, fold: { ...DEFAULT_FOLD, enabled: false, ...f.fold, ...patch } }));
  const [keywordText, setKeywordText] = useState(() => fold.keywords.join(', '));
  // Which touch began with the card open, so tapping the (i) of an open card closes it instead of reopening it.
  const [foldInfoOpen, setFoldInfoOpen] = useState(false);
  const infoWasOpen = useRef(false);
  const closeInfoOnTouch = () => {
    infoWasOpen.current = foldInfoOpen;
    if (foldInfoOpen) setFoldInfoOpen(false);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      notify('Name your calendar', 'For example “Work” or “Personal”.');
      return;
    }
    const location = defaults.location?.trim() || undefined;
    const cleaned: CalendarDefaults = { ...defaults, location, tags: defaults.tags?.length ? defaults.tags : undefined };
    const hasDefaults = Object.values(cleaned).some((v) => v !== undefined);
    const keywords = [...new Set(keywordText.split(',').map((k) => k.trim()).filter(Boolean))];
    // Fold settings are only stored once folding has been turned on, then kept while it's off.
    const nextFold = form.fold ? { ...fold, keywords } : undefined;
    saveCalendar({ ...form, name, defaults: hasDefaults ? cleaned : undefined, fold: nextFold });
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onTouchStart={closeInfoOnTouch}>
      <Section>
        <Field label="Name">
          <TextField value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="e.g. Work" autoFocus={!existing} />
        </Field>
      </Section>

      <Section title="Default color">
        <ColorPicker value={form.color} onChange={(color) => color && setForm((f) => ({ ...f, color }))} />
      </Section>

      <Section title="Defaults for new events">
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

      <Section title="Folding" allowOverflow style={{ zIndex: 3 }}>
        <SwitchRow
          label="Fold into one block"
          value={fold.enabled}
          onValueChange={(enabled) => {
            animateNextLayout();
            setFold({ enabled });
          }}
          info={{
            text: FOLD_INFO,
            open: foldInfoOpen,
            onToggle: () => setFoldInfoOpen(!infoWasOpen.current),
          }}
        />
        {fold.enabled ? (
          <>
            <Divider />
            <Text style={styles.subhead}>Join events with gaps up to</Text>
            <View style={styles.segmentWrap}>
              <Segmented
                options={FOLD_GAPS.map((m) => ({ value: m, label: gapLabel(m) }))}
                value={nearestGap(fold.maxGapMinutes)}
                onChange={(m) => setFold({ maxGapMinutes: Number(m) })}
              />
            </View>
            <Divider />
            <SwitchRow
              label="Always show one-off events"
              subtitle="Events that aren't part of a repeat stay visible on the block"
              value={fold.showOneOffs}
              onValueChange={(showOneOffs) => setFold({ showOneOffs })}
            />
            <Field label="Always show titles containing">
              <TextField value={keywordText} onChangeText={setKeywordText} placeholder="e.g. exam, test, trip" autoCapitalize="none" />
            </Field>
          </>
        ) : null}
      </Section>

      <Section
        title="Pause calendar"
        footer={
          recurringCount
            ? `Skips ${recurringCount} repeating event${recurringCount === 1 ? '' : 's'} in this calendar during these dates.`
            : 'Skips repeating events in this calendar during these dates.'
        }
      >
        <PauseWindowsEditor value={form.pauseWindows} onChange={(pauseWindows) => setForm((f) => ({ ...f, pauseWindows }))} />
      </Section>

      {existing && eventCount ? (
        <Button
          variant="secondary"
          title={`Export ${eventCount} event${eventCount === 1 ? '' : 's'} (.ics)`}
          onPress={() =>
            void shareICS(existing.name, events.filter((e) => e.calendarId === existing.id), calendarsById, notificationPrefs.allDayTime, existing.color)
          }
          style={styles.exportButton}
        />
      ) : null}
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
  exportButton: { marginBottom: spacing.md },
  content: { padding: spacing.lg, paddingBottom: 48 },
  subhead: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  segmentWrap: { padding: spacing.md },
  note: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
