import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { Logo } from '../components/Logo';
import { Divider, Row, Section } from '../components/ui';
import type { ScreenProps } from '../navigation/types';
import { APP_VERSION, updateInfo } from '../services/appInfo';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';

const REPO_URL = 'https://github.com/BoazCohenJ/OpenCal';

type Highlight = { icon: IconName; title: string; text: string };

/** The things OpenCal does that most calendars don't, roughly in the order people find them useful. */
const HIGHLIGHTS: Highlight[] = [
  {
    icon: 'pointer',
    title: 'Tap an empty time to create',
    text: 'In Day or Week view a see-through event appears where you tap. Drag it to move it, pull its handles to resize, and tap Done.',
  },
  {
    icon: 'zap',
    title: 'Quick Add',
    text: 'Type “Lunch with John Fri 1pm at Cafe X” and review the parsed event before saving. Share a message to OpenCal and it finds the date and time for you.',
  },
  {
    icon: 'stamp',
    title: 'Stamps',
    text: 'Save the events you repeat (coffee, gym, calls) and drop them on any empty slot in one tap, with Undo.',
  },
  {
    icon: 'share',
    title: 'Share events both ways',
    text: 'Send any event as an invite every calendar app understands, and open invites, .ics files or invitation emails straight in OpenCal.',
  },
  {
    icon: 'pause',
    title: 'Pause a repeat',
    text: 'Skip a date range for one event or a whole calendar (a holiday, a school break) and it resumes on its own.',
  },
  {
    icon: 'moon',
    title: 'Quiet time & Do Not Disturb',
    text: 'Schedule them like events, say every Monday 17:00–18:00: quiet delivers reminders silently, Do Not Disturb skips them.',
  },
  {
    icon: 'clock',
    title: 'Floating or fixed time',
    text: 'A 9:00 run can stay at 9:00 wherever you travel, while a fixed meeting keeps its moment and time zone through daylight-saving changes.',
  },
  {
    icon: 'widgets',
    title: 'Home-screen widgets',
    text: 'Schedule, Today, Week and Month widgets that follow the app’s theme, page right on the home screen, and roll over at midnight by themselves.',
  },
  {
    icon: 'palette',
    title: 'Color rules',
    text: 'Color every event whose title contains a word: all your “Break” events amber, all “Gym” events green.',
  },
  {
    icon: 'monitor',
    title: 'Desktop layout on the web',
    text: 'In a wide browser window OpenCal gets a sidebar, a toolbar, dialogs and keyboard shortcuts (T, D, W, M, S, C and Q).',
  },
  {
    icon: 'sync',
    title: 'Sync through your own server',
    text: 'Optional. Run the small OpenCal server at home and every phone stays in step. No account and nothing in anyone else’s cloud.',
  },
  {
    icon: 'bot',
    title: 'Let an AI assistant manage it',
    text: 'The same server speaks MCP, so an assistant like Claude, ChatGPT or Hermes can read your schedule and add, move or delete events. Every change is undoable.',
  },
];

export function AboutScreen(_: ScreenProps<'About'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const info = updateInfo();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Logo size={84} variant="tile" />
        <Text style={styles.name}>OpenCal</Text>
        <Text style={styles.tagline}>A calm, local-first calendar. No account, no ads, no tracking.</Text>
        <Text style={styles.version}>{[APP_VERSION ? `Version ${APP_VERSION}` : null, info].filter(Boolean).join(' · ')}</Text>
      </View>

      <Section title="What makes it different">
        {HIGHLIGHTS.map((h, i) => (
          <View key={h.title}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.highlight}>
              <View style={styles.badge}>
                <Icon name={h.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.highlightBody}>
                <Text style={styles.highlightTitle}>{h.title}</Text>
                <Text style={styles.highlightText}>{h.text}</Text>
              </View>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Yours" footer="Everything is stored on your device. It only leaves it for a server you set up yourself.">
        <View style={styles.highlight}>
          <View style={styles.badge}>
            <Icon name="lock" size={20} color={colors.primary} />
          </View>
          <View style={styles.highlightBody}>
            <Text style={styles.highlightTitle}>Private by design</Text>
            <Text style={styles.highlightText}>No Firebase, no Google services and no code loaded from the network in the F-Droid build.</Text>
          </View>
        </View>
        <Divider />
        <Row label="Source code and releases" subtitle="OpenCal is open source (MIT)" onPress={() => void Linking.openURL(REPO_URL)} />
      </Section>
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  name: { marginTop: spacing.sm, fontFamily: fonts.display, fontSize: 30, color: colors.text },
  tagline: { fontSize: 15, lineHeight: 21, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
  version: { marginTop: spacing.xs, fontSize: 12, color: colors.textFaint, textAlign: 'center' },
  highlight: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  badge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  highlightBody: { flex: 1, gap: 2 },
  highlightTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  highlightText: { fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
}));
