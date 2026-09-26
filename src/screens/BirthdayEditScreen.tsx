import { addDays, format, startOfDay, startOfMonth } from 'date-fns';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { EventGlyph } from '../components/Icon';
import { MiniMonth } from '../components/MiniMonth';
import { MonthYearGrid } from '../components/MonthYearPicker';
import { Sheet } from '../components/Sheet';
import { Button, Field, HeaderButton, Section, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Birthday } from '../models/Birthday';
import type { ScreenProps } from '../navigation/types';
import { BIRTHDAY_COLOR, expandBirthdays } from '../services/birthdays';
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
  const [birthDate, setBirthDate] = useState<string | null>(existing?.birthDate ?? null);
  // The date sheet starts on the month grid when there's no date yet, since birth years are far back.
  const [picker, setPicker] = useState<'month' | 'day' | null>(null);
  const [pickerMonth, setPickerMonth] = useState(() => startOfMonth(birthDate ? parseDayKey(birthDate) : new Date(1990, 0, 1)));
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
            onPress={() => setPicker(birthDate ? 'day' : 'month')}
          >
            <Text style={[styles.pillText, !birthDate && styles.placeholder]}>
              {birthDate ? format(parseDayKey(birthDate), 'MMMM d, yyyy') : 'Choose a date'}
            </Text>
          </Pressable>
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

      <Sheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title="Date of birth"
        actionLabel={picker === 'month' && birthDate ? 'Back' : 'Close'}
        onAction={picker === 'month' && birthDate ? () => setPicker('day') : undefined}
      >
        {picker === 'month' ? (
          <MonthYearGrid
            value={pickerMonth}
            minYear={MIN_YEAR}
            maxYear={today.getFullYear()}
            max={today}
            showSelection={!!birthDate}
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
            selected={birthDate ? parseDayKey(birthDate) : undefined}
            onSelectDay={(d) => {
              if (d > today) return;
              setBirthDate(dayKey(d));
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
