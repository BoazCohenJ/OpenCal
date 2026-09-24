import React, { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ColorDot, Divider, HeaderButton, Row, Section } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { dayKey, formatPauseWindow } from '../utils/dates';

export function CalendarsScreen({ navigation }: ScreenProps<'Calendars'>) {
  const { calendars, events, visibleCalendarIds } = useCalendarContext();
  const today = dayKey(new Date());

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderButton title="+ New" bold onPress={() => navigation.navigate('CalendarEdit')} /> });
  }, [navigation]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section footer="Every event belongs to a calendar and inherits its color unless the event has its own. Show or hide calendars from the chips on the main screen.">
        {calendars.map((c, i) => {
          const count = events.filter((e) => e.calendarId === c.id).length;
          const activePause = c.pauseWindows.find((w) => w.startDate <= today && w.endDate >= today);
          const upcoming = c.pauseWindows.filter((w) => w.startDate > today).length;
          const parts = [`${count} event${count === 1 ? '' : 's'}`];
          if (activePause) parts.push(`Paused ${formatPauseWindow(activePause)}`);
          else if (upcoming) parts.push(`${upcoming} upcoming pause${upcoming === 1 ? '' : 's'}`);
          if (!visibleCalendarIds.includes(c.id)) parts.push('hidden');
          return (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <Row
                label={c.name}
                subtitle={parts.join(' · ')}
                left={<ColorDot color={c.color} size={16} />}
                onPress={() => navigation.navigate('CalendarEdit', { calendarId: c.id })}
              />
            </View>
          );
        })}
        {calendars.length === 0 ? <Text style={styles.empty}>No calendars yet.</Text> : null}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  empty: { padding: 16, color: colors.textMuted },
});
