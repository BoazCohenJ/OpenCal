import { addHours, endOfDay, format, setHours, startOfDay } from 'date-fns';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { DateTimeField } from '../components/DateTimeField';
import { IconButtonTile, IconPicker } from '../components/IconPicker';
import { PauseWindowsEditor } from '../components/PauseWindowsEditor';
import { RecurrenceEditor } from '../components/RecurrenceEditor';
import { ReminderEditor } from '../components/ReminderEditor';
import { CalendarSelector, TagEditor } from '../components/Selectors';
import { Button, Divider, Field, HeaderButton, Section, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Calendar } from '../models/Calendar';
import type { Event } from '../models/Event';
import type { NotificationPrefs } from '../models/NotificationPrefs';
import type { EventDraft, ScreenProps } from '../navigation/types';
import { templateFromEvent } from '../services/templates';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { confirmAsync, notify } from '../utils/confirm';
import { deviceTimeZone, formatPauseWindow, nextRoundedHour, parseDayKey, parseTimestamp } from '../utils/dates';
import { newId } from '../utils/id';
import { animateNextLayout } from '../utils/motion';

/** Fields a calendar can pre-fill. Once the user edits one, switching calendars leaves it alone. */
type InheritedField = 'reminders' | 'recurrenceRule' | 'location' | 'tags';
const INHERITED: InheritedField[] = ['reminders', 'recurrenceRule', 'location', 'tags'];

function defaultRemindersFor(calendar: Calendar | undefined, allDay: boolean, prefs: NotificationPrefs): number[] {
  return [...(calendar?.defaults?.reminders ?? (allDay ? prefs.defaultAllDayReminders : prefs.defaultReminders))];
}

/** What a new event in `calendar` starts with for each inherited field. */
function inheritedValues(calendar: Calendar | undefined, allDay: boolean, prefs: NotificationPrefs): Pick<Event, InheritedField> {
  return {
    reminders: defaultRemindersFor(calendar, allDay, prefs),
    recurrenceRule: calendar?.defaults?.recurrenceRule,
    location: calendar?.defaults?.location,
    tags: [...(calendar?.defaults?.tags ?? [])],
  };
}

function buildInitial(
  existing: Event | undefined,
  draft: EventDraft | undefined,
  defaultCalendarId: string,
  calendarsById: Record<string, Calendar>,
  prefs: NotificationPrefs,
): Event {
  if (existing) return existing;
  const start = draft?.startDate ? parseTimestamp(draft.startDate) : nextRoundedHour();
  const merged: Event = {
    id: newId(),
    title: '',
    startDate: start.toISOString(),
    endDate: addHours(start, 1).toISOString(),
    isAllDay: false,
    calendarId: defaultCalendarId,
    pauseWindows: [],
    reminders: [],
    tags: [],
  };
  if (draft) {
    for (const [k, v] of Object.entries(draft)) {
      if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
    }
  }
  const calendar = calendarsById[merged.calendarId] ?? calendarsById[defaultCalendarId];
  const inherited = inheritedValues(calendar, merged.isAllDay, prefs);
  for (const field of INHERITED) {
    if (draft?.[field] === undefined) (merged as unknown as Record<string, unknown>)[field] = inherited[field];
  }
  return merged;
}

export function EventEditScreen({ navigation, route }: ScreenProps<'EventEdit'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { calendars, calendarsById, events, saveEvent, deleteEvent, saveTemplate, allTags, notificationPrefs, floatingByDefault } =
    useCalendarContext();
  const existing = route.params?.eventId ? events.find((e) => e.id === route.params?.eventId) : undefined;
  const [form, setForm] = useState<Event>(() => {
    const built = buildInitial(existing, route.params?.draft, calendars[0]?.id ?? '', calendarsById, notificationPrefs);
    const initial = { ...built, floating: built.floating ?? floatingByDefault };
    return calendarsById[initial.calendarId] ? initial : { ...initial, calendarId: calendars[0]?.id ?? '' };
  });
  const [showEmoji, setShowEmoji] = useState(false);
  const fromQuickAdd = route.params?.fromQuickAdd ?? false;
  // Fields the user (or the Quick Add text) set explicitly; calendar defaults never overwrite these.
  const [touched, setTouched] = useState<Set<InheritedField>>(
    () => new Set(existing ? INHERITED : INHERITED.filter((f) => route.params?.draft?.[f] !== undefined)),
  );

  const update = (patch: Partial<Event>) => setForm((f) => ({ ...f, ...patch }));
  const edit = (patch: Partial<Pick<Event, InheritedField>>) => {
    setTouched((t) => new Set([...t, ...(Object.keys(patch) as InheritedField[])]));
    update(patch);
  };
  const changeCalendar = (calendarId: string) => {
    if (existing) return update({ calendarId });
    const inherited = inheritedValues(calendarsById[calendarId], form.isAllDay, notificationPrefs);
    const patch: Partial<Event> = { calendarId };
    for (const field of INHERITED) {
      if (!touched.has(field)) (patch as Record<string, unknown>)[field] = inherited[field];
    }
    update(patch);
  };
  const start = parseTimestamp(form.startDate);
  const end = parseTimestamp(form.endDate);
  const calendar = calendarsById[form.calendarId];
  const eventColor = form.color ?? calendar?.color ?? colors.primary;

  const setStart = (d: Date) => {
    const duration = Math.max(0, end.getTime() - start.getTime());
    update({ startDate: d.toISOString(), endDate: new Date(d.getTime() + duration).toISOString() });
  };
  const setEnd = (d: Date) => update({ endDate: (form.isAllDay ? endOfDay(d) : d).toISOString() });
  const setAllDay = (allDay: boolean) => {
    // On new events, swap to the matching default reminders unless the user already changed them.
    const reminders = !existing && !touched.has('reminders') ? { reminders: defaultRemindersFor(calendar, allDay, notificationPrefs) } : {};
    update(
      allDay
        ? { ...reminders, isAllDay: true, startDate: startOfDay(start).toISOString(), endDate: endOfDay(end < start ? start : end).toISOString() }
        : {
            ...reminders,
            isAllDay: false,
            startDate: setHours(startOfDay(start), 9).toISOString(),
            endDate: setHours(startOfDay(start), 10).toISOString(),
          },
    );
  };

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
      skippedDates: form.recurrenceRule ? form.skippedDates : [],
    };
  };

  const save = () => {
    const event = normalized();
    if (!event) return;
    saveEvent(event);
    // From Quick Add, close both the editor and the text screen underneath it.
    if (fromQuickAdd) navigation.popToTop();
    else navigation.goBack();
  };
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Event' : 'New Event',
      headerLeft: () =>
        fromQuickAdd ? (
          <HeaderButton title="‹ Edit text" onPress={() => navigation.goBack()} />
        ) : (
          <HeaderButton title="Cancel" onPress={() => navigation.goBack()} />
        ),
      headerRight: () => <HeaderButton title="Save" bold onPress={() => saveRef.current()} />,
    });
  }, [navigation, existing, fromQuickAdd]);

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
        <IconButtonTile value={form.emoji} color={eventColor} onPress={() => {
            animateNextLayout();
            setShowEmoji((v) => !v);
          }} />
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
        <Section title="Icon" footer="Shown next to the title in every view.">
          <IconPicker
            color={eventColor}
            value={form.emoji}
            onChange={(emoji) => {
              update({ emoji });
              setShowEmoji(false);
            }}
          />
        </Section>
      ) : null}

      <Section title="Calendar">
        <CalendarSelector calendars={calendars} value={form.calendarId} onChange={changeCalendar} />
      </Section>

      <Section title="When">
        <SwitchRow label="All day" value={form.isAllDay} onValueChange={setAllDay} />
        <Divider />
        {!form.isAllDay ? (
          <>
            <SwitchRow
              label="Floating time"
              subtitle={
                form.floating
                  ? `Stays at ${format(start, 'h:mm a')} in any time zone`
                  : `Fixed to ${(form.timeZone ?? deviceTimeZone())?.replace(/_/g, ' ') ?? 'this time zone'}; moves when you travel`
              }
              value={form.floating === true}
              onValueChange={(floating) => update({ floating })}
            />
            <Divider />
          </>
        ) : null}
        <Field label="Starts">
          <DateTimeField value={start} onChange={setStart} mode={form.isAllDay ? 'date' : 'datetime'} />
        </Field>
        <Field label="Ends">
          <DateTimeField value={end} onChange={setEnd} mode={form.isAllDay ? 'date' : 'datetime'} />
        </Field>
      </Section>

      <Section title="Repeat">
        <RecurrenceEditor value={form.recurrenceRule} start={start} onChange={(recurrenceRule) => edit({ recurrenceRule })} />
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

      {form.recurrenceRule && form.skippedDates?.length ? (
        <Section
          title="Deleted occurrences"
          footer="Days removed from this series one at a time. Restore puts the occurrence back when you save."
        >
          {form.skippedDates.map((day, i) => (
            <View key={day}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.skippedRow}>
                <Text style={styles.skippedDate}>{format(parseDayKey(day), 'EEEE, MMM d, yyyy')}</Text>
                <Button
                  small
                  variant="ghost"
                  title="Restore"
                  onPress={() => update({ skippedDates: form.skippedDates?.filter((d) => d !== day) })}
                />
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Reminders">
        <ReminderEditor
          value={form.reminders}
          onChange={(reminders) => edit({ reminders })}
          allDay={form.isAllDay}
          allDayTime={notificationPrefs.allDayTime}
        />
      </Section>

      <Section title="Details">
        <Field label="Location">
          <TextField value={form.location ?? ''} onChangeText={(location) => edit({ location })} placeholder="Add a place" />
        </Field>
        <Field label="Notes">
          <TextField value={form.description ?? ''} onChangeText={(description) => update({ description })} placeholder="Add a description" multiline />
        </Field>
        <Field label="Tags">
          <TagEditor value={form.tags} onChange={(tags) => edit({ tags })} suggestions={allTags} />
        </Field>
      </Section>

      <Section title="Color" footer="Overrides the calendar color for this event only.">
        <ColorPicker value={form.color} inheritColor={calendar?.color} onChange={(color) => update({ color })} />
      </Section>

      <View style={styles.actions}>
        <Button variant="secondary" title="Save as stamp" onPress={saveAsStamp} />
        {existing ? <Button variant="danger" title="Delete event" onPress={remove} /> : null}
      </View>
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
  titleInput: { flex: 1, fontSize: 22, fontFamily: fonts.display, color: colors.text, paddingVertical: 6 },
  inherited: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 16, paddingBottom: 14 },
  skippedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingVertical: 6 },
  skippedDate: { fontSize: 15, color: colors.text },
  actions: { gap: 10, marginTop: 4 },
}));
