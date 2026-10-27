import { addDays, format, startOfDay, startOfMonth } from 'date-fns';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { EventGlyph } from '../components/Icon';
import { MiniMonth } from '../components/MiniMonth';
import { MonthYearGrid } from '../components/MonthYearPicker';
import { Sheet } from '../components/Sheet';
import { Button, Field, HeaderButton, Section, SwitchRow, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Birthday } from '../models/Birthday';
import type { ScreenProps } from '../navigation/types';
import { BIRTHDAY_COLOR, expandBirthdays, hasNoYear, parseBirthDate, toBirthDate } from '../services/birthdays';
import { createStyles, radius, spacing } from '../theme';
import { deepText, softBg } from '../utils/color';
import { confirmAsync, notify } from '../utils/confirm';
import { dayKey, parseDayKey } from '../utils/dates';
import { newId } from '../utils/id';

const MIN_YEAR = 1900;

export function BirthdayEditScreen({ navigation, route }: ScreenProps<'BirthdayEdit'>) {
  const styles = useStyles();
  const { birthdays, saveBirthday, deleteBirthday } = useCalendarContext();
  const existing = birthdays.find((b) => b.id === route.params?.birthdayId);
  const [name, setName] = useState(existing?.name ?? '');
  // Always a full `yyyy-MM-dd` while editing; the year is dropped on save when `withYear` is off.
  const [pickedDate, setPickedDate] = useState<string | null>(existing ? dayKey(parseBirthDate(existing.birthDate)) : null);
  const [withYear, setWithYear] = useState(existing ? !hasNoYear(existing.birthDate) : true);
  const birthDate = pickedDate ? toBirthDate(pickedDate, withYear) : null;
  // The date sheet starts on the month grid when there's no date yet, since birth years are far back.
  const [picker, setPicker] = useState<'month' | 'day' | null>(null);
  const [pickerMonth, setPickerMonth] = useState(() => startOfMonth(pickedDate ? parseDayKey(pickedDate) : new Date(1990, 0, 1)));

  // A yearless birthday loads with the placeholder year 2000; turning the year on asks for the real one.
  const placeholderYear = useRef(!!existing && hasNoYear(existing.birthDate));
  const toggleYear = (on: boolean) => {
    setWithYear(on);
    if (on && pickedDate && placeholderYear.current) {
      setPickerMonth(startOfMonth(parseDayKey(pickedDate)));
      setPicker('month');
    }
  };
  const today = startOfDay(new Date());

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify('Add a name');
      return;
    }
    if (!birthDate) {
      notify('Add a date of birth');
      return;
    }
    saveBirthday({ id: existing?.id ?? newId(), name: trimmed, birthDate });
    navigation.goBack();
  };
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Edit Birthday' : 'New Birthday',
      headerRight: () => <HeaderButton title="Save" bold onPress={() => saveRef.current()} />,
    });
  }, [navigation, existing]);

  const remove = async () => {
    if (!existing) return;
    if (!(await confirmAsync(`Delete ${existing.name}'s birthday?`, 'It will no longer show on the calendar.', 'Delete', true))) return;
    deleteBirthday(existing.id);
    navigation.goBack();
  };

  const preview: Birthday | null = birthDate ? { id: 'preview', name: name.trim() || 'Name', birthDate } : null;
  const next = preview ? expandBirthdays([preview], today, addDays(today, 367))[0] : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Section>
        <Field label="Name">
          <TextField value={name} onChangeText={setName} placeholder="e.g. Dana" autoFocus={!existing} autoCapitalize="words" />
        </Field>
        <Field label="Date of birth">
          <Pressable
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            onPress={() => {
              // Without a year there's no far-back year to hunt for, so go straight to the days.
              if (!pickedDate && !withYear) setPickerMonth(startOfMonth(new Date(2000, today.getMonth(), 1)));
              setPicker(pickedDate || !withYear ? 'day' : 'month');
            }}
          >
            <Text style={[styles.pillText, !pickedDate && styles.placeholder]}>
              {pickedDate ? format(parseDayKey(pickedDate), withYear ? 'MMMM d, yyyy' : 'MMMM d') : 'Choose a date'}
            </Text>
          </Pressable>
        </Field>
        <SwitchRow label="Include birth year" subtitle="Off: just the date, with no age in the event title." value={withYear} onValueChange={toggleYear} />
      </Section>

      {next ? (
        <Section title="Next on the calendar">
          <View style={styles.preview}>
            <View style={[styles.glyph, { backgroundColor: softBg(BIRTHDAY_COLOR) }]}>
              <EventGlyph value="icon:cake" size={18} color={deepText(BIRTHDAY_COLOR)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>{next.event.title}</Text>
              <Text style={styles.previewMeta}>{format(next.start, 'EEEE, MMMM d, yyyy')} · All day</Text>
            </View>
          </View>
        </Section>
      ) : null}

      {existing ? <Button variant="danger" title="Delete birthday" onPress={remove} /> : null}

      <Sheet
        visible={picker !== null}
        onClose={() => {
          setPicker(null);
          // Dismissed without choosing the real year: stay yearless rather than keep the placeholder 2000.
          if (placeholderYear.current) setWithYear(false);
        }}
        title="Date of birth"
        actionLabel={picker === 'month' && pickedDate ? 'Back' : 'Close'}
        onAction={picker === 'month' && pickedDate ? () => setPicker('day') : undefined}
      >
        {picker === 'month' ? (
          <MonthYearGrid
            value={pickerMonth}
            minYear={MIN_YEAR}
            maxYear={today.getFullYear()}
            max={today}
            showSelection={!!pickedDate}
            onSelect={(m) => {
              setPickerMonth(m);
              setPicker('day');
            }}
          />
        ) : (
          <MiniMonth
            month={pickerMonth}
            onChangeMonth={setPickerMonth}
            onPressTitle={() => setPicker('month')}
            selected={pickedDate ? parseDayKey(pickedDate) : undefined}
            onSelectDay={(d) => {
              if (d > today) return;
              placeholderYear.current = false;
              setPickedDate(dayKey(d));
              setPicker(null);
            }}
          />
        )}
      </Sheet>
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  pill: { alignSelf: 'flex-start', backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 12 },
  pillText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  placeholder: { color: colors.textFaint },
  pressed: { opacity: 0.7 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg },
  glyph: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  previewMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
}));
