import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import React, { useLayoutEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { EventGlyph } from '../components/Icon';
import { Button, Divider, EmptyState, HeaderButton, Row, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { BIRTHDAY_COLOR, BIRTHDAYS_CALENDAR_ID, expandBirthdays } from '../services/birthdays';
import { createStyles, spacing } from '../theme';
import { deepText, softBg } from '../utils/color';
import { parseDayKey } from '../utils/dates';

export function BirthdaysScreen({ navigation }: ScreenProps<'Birthdays'>) {
  const styles = useStyles();
  const { birthdays, visibleCalendarIds } = useCalendarContext();

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderButton title="+ New" bold onPress={() => navigation.navigate('BirthdayEdit')} /> });
  }, [navigation]);

  // Soonest upcoming birthday first.
  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return birthdays
      .map((b) => ({ birthday: b, next: expandBirthdays([b], today, addDays(today, 367))[0]?.start }))
      .sort((a, b) => (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity));
  }, [birthdays]);

  if (birthdays.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="cake"
          title="Never miss a birthday"
          subtitle="Add a name and date of birth, and every year the calendar shows it as “Dana's 30th birthday”."
        >
          <Button title="Add a birthday" onPress={() => navigation.navigate('BirthdayEdit')} />
        </EmptyState>
      </View>
    );
  }

  const today = startOfDay(new Date());
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section
        footer={`${visibleCalendarIds.includes(BIRTHDAYS_CALENDAR_ID) ? 'Shown' : 'Hidden'} on the calendar. Show or hide birthdays with the Birthdays chip on the main screen.`}
      >
        {upcoming.map(({ birthday: b, next }, i) => {
          const birth = parseDayKey(b.birthDate);
          const days = next ? differenceInCalendarDays(next, today) : null;
          const when = !next ? '' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
          return (
            <View key={b.id}>
              {i > 0 ? <Divider /> : null}
              <Row
                label={b.name}
                subtitle={`Born ${format(birth, 'MMM d, yyyy')}${next ? ` · turns ${next.getFullYear() - birth.getFullYear()} on ${format(next, 'MMM d')}` : ''}`}
                value={when}
                left={
                  <View style={[styles.glyph, { backgroundColor: softBg(BIRTHDAY_COLOR) }]}>
                    <EventGlyph value="icon:cake" size={18} color={deepText(BIRTHDAY_COLOR)} />
                  </View>
                }
                onPress={() => navigation.navigate('BirthdayEdit', { birthdayId: b.id })}
              />
            </View>
          );
        })}
      </Section>
      <Text style={styles.hint}>Tap a birthday on the calendar to edit it.</Text>
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  glyph: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
