import { addDays, format, startOfDay } from 'date-fns';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { EventGlyph } from '../components/Icon';
import { Button, Field, HeaderButton, Section, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Birthday } from '../models/Birthday';
import type { ScreenProps } from '../navigation/types';
import { BIRTHDAY_COLOR, expandBirthdays, hasNoYear, parseBirthDate, YEARLESS_PREFIX } from '../services/birthdays';
import { createStyles, radius, spacing } from '../theme';
import { deepText, softBg } from '../utils/color';
import { confirmAsync, notify } from '../utils/confirm';
import { newId } from '../utils/id';

const MIN_YEAR = 1900;
const MONTH_LABELS = Array.from({ length: 12 }, (_, m) => format(new Date(2000, m, 1), 'MMM'));
const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Days in `month` (0–11); February has 29 unless `year` is known and not a leap year. */
function daysIn(month: number | null, year: number | null): number {
  if (month === null) return 31;
  if (month === 1) return year === null || isLeap(year) ? 29 : 28;
  return [3, 5, 8, 10].includes(month) ? 30 : 31;
}

/**
 * New or edited birthday. The date is picked inline: tap a month, tap a day, and optionally type
 * the birth year (no year means the event shows without an age).
 */
export function BirthdayEditScreen({ navigation, route }: ScreenProps<'BirthdayEdit'>) {
  const styles = useStyles();
  const { birthdays, saveBirthday, deleteBirthday } = useCalendarContext();
  const existing = birthdays.find((b) => b.id === route.params?.birthdayId);
  const initial = existing ? parseBirthDate(existing.birthDate) : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [month, setMonth] = useState<number | null>(initial ? initial.getMonth() : null);
  const [day, setDay] = useState<number | null>(initial ? initial.getDate() : null);
  const [yearText, setYearText] = useState(existing && !hasNoYear(existing.birthDate) && initial ? String(initial.getFullYear()) : '');
  const today = startOfDay(new Date());
  const thisYear = today.getFullYear();

  const yearTyped = yearText.trim();
  const year = /^\d{4}$/.test(yearTyped) ? Number(yearTyped) : null;
  let yearError: string | null = null;
  if (yearTyped && year === null) yearError = 'Type the full year, like 1990';
  else if (year !== null && (year < MIN_YEAR || year > thisYear)) yearError = `Pick a year between ${MIN_YEAR} and ${thisYear}`;
  else if (year !== null && month === 1 && day === 29 && !isLeap(year)) yearError = `${year} had no February 29`;
  else if (year !== null && month !== null && day !== null && new Date(year, month, day) > today) yearError = "That date hasn't happened yet";

  const maxDay = daysIn(month, yearError ? null : year);
  const birthDate =
    month !== null && day !== null && !yearError
      ? year !== null
        ? `${year}-${pad(month + 1)}-${pad(day)}`
        : `${YEARLESS_PREFIX}${pad(month + 1)}-${pad(day)}`
      : null;

  const pickMonth = (m: number) => {
    Keyboard.dismiss();
    setMonth(m);
    // Keep the day when it still exists in the new month (Mar 31 → Apr becomes Apr 30).
    if (day !== null) setDay(Math.min(day, daysIn(m, null)));
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return notify('Add a name');
    if (month === null) return notify('Pick the birthday month');
    if (day === null) return notify('Pick the day of the month');
    if (yearError || !birthDate) return notify(yearError ?? 'Check the date');
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
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="e.g. Dana"
            autoFocus={!existing}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </Field>
      </Section>

      <Section title="Birthday">
        <Field label="Month">
          <View style={styles.grid}>
            {MONTH_LABELS.map((label, m) => {
              const selected = m === month;
              return (
                <Pressable
                  key={m}
                  onPress={() => pickMonth(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={format(new Date(2000, m, 1), 'MMMM')}
                  style={({ pressed }) => [styles.monthCell, pressed && styles.pressed]}
                >
                  <View style={[styles.chip, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <Field label="Day">
          <View style={styles.grid}>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => {
              const selected = d === day;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    Keyboard.dismiss();
                    setDay(d);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={String(d)}
                  style={({ pressed }) => [styles.dayCell, pressed && styles.pressed]}
                >
                  <View style={[styles.chip, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{d}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <Field label="Year (optional)">
          <TextField
            value={yearText}
            onChangeText={(t) => setYearText(t.replace(/\D/g, ''))}
            placeholder="e.g. 1990"
            keyboardType="number-pad"
            maxLength={4}
            returnKeyType="done"
            style={styles.yearInput}
          />
          <Text style={[styles.hint, yearError && yearTyped.length === 4 ? styles.hintError : null]}>
            {yearError && yearTyped.length === 4
              ? yearError
              : year !== null
                ? 'The event shows the age'
                : 'Without a year, no age is shown'}
          </Text>
        </Field>
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
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  monthCell: { width: '25%', padding: 3 },
  dayCell: { width: `${100 / 7}%`, padding: 3 },
  chip: { height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: colors.onPrimary, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  yearInput: { maxWidth: 160 },
  hint: { fontSize: 13, color: colors.textMuted },
  hintError: { color: colors.danger },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg },
  glyph: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  previewMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
}));
