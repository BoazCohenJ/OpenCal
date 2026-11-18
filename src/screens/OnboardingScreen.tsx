import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { Logo } from '../components/Logo';
import { Button, PressableScale, Segmented } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { RootStackParamList, ScreenProps } from '../navigation/types';
import { notificationsSupported } from '../services/notifications';
import { createStyles, fonts, radius, spacing, useTheme, type ThemeMode } from '../theme';

/** Widest the tour's text column gets, so a desktop browser doesn't stretch it across the window. */
const COLUMN = 520;

interface Feature {
  icon: IconName;
  title: string;
  text: string;
}

const ADDING: Feature[] = [
  {
    icon: 'plus',
    title: 'Tap an empty time',
    text: 'An event appears there. Drag it to move it, or its handles to change the length.',
  },
  {
    icon: 'sparkles',
    title: 'Quick Add',
    text: 'Type “Lunch with Dana Fri 1pm at Cafe X” and OpenCal fills in the rest.',
  },
  {
    icon: 'stamp',
    title: 'Stamps',
    text: 'Save events you add often, like coffee or gym, and drop one on any free slot.',
  },
];

const DIFFERENT: Feature[] = [
  {
    icon: 'pause',
    title: 'Pause a repeat',
    text: 'Skip a holiday or school break. The repeat picks up again on its own.',
  },
  {
    icon: 'moon',
    title: 'Quiet time',
    text: 'Schedule silent or Do Not Disturb windows like events.',
  },
  {
    icon: 'alarm-clock',
    title: 'Alarms',
    text: 'Turn any reminder into an alarm that rings until you dismiss or snooze it.',
  },
];

type Destination = Extract<keyof RootStackParamList, 'ImportExport' | 'Sync'>;

const PAGE_COUNT = 5;

/**
 * The welcome tour: the first screen on a new device, and reopened from Settings → About. Five
 * swipeable pages: welcome, adding events, what's different, appearance and reminders, and
 * bringing in an existing calendar. Skipping or finishing marks it done for this device.
 */
export function OnboardingScreen({ navigation }: ScreenProps<'Onboarding'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { completeOnboarding, themeMode, setThemeMode, refreshReminders, reminderStatus } = useCalendarContext();
  const [width, setWidth] = useState(windowWidth);
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const scrollX = useState(() => new Animated.Value(0))[0];
  // The page for listeners set up once (Android back), kept current after each render.
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  const last = page === PAGE_COUNT - 1;

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(PAGE_COUNT - 1, index));
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  const finish = (destination?: Destination) => {
    completeOnboarding();
    // Reopened from Settings: go back there. First launch: the calendar replaces the tour.
    if (navigation.canGoBack()) {
      navigation.goBack();
      if (destination) navigation.navigate(destination);
      return;
    }
    navigation.reset({
      index: destination ? 1 : 0,
      routes: destination ? [{ name: 'Calendar' }, { name: destination }] : [{ name: 'Calendar' }],
    });
  };

  // Rotating the phone or resizing the window changes the page width: stay on the same page.
  useEffect(() => {
    scroller.current?.scrollTo({ x: pageRef.current * width, animated: false });
  }, [width]);

  // Android back steps through the pages before leaving the tour.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pageRef.current === 0) return false;
      scroller.current?.scrollTo({ x: (pageRef.current - 1) * width, animated: true });
      setPage(pageRef.current - 1);
      return true;
    });
    return () => sub.remove();
  }, [width]);

  const status = reminderStatus?.status;
  const [asking, setAsking] = useState(false);
  const askForReminders = () => {
    setAsking(true);
    void refreshReminders({ askPermission: true, askAlways: true }).finally(() => setAsking(false));
  };

  const pages = [
    <View key="welcome" style={styles.centerPage}>
      <Logo size={132} variant="tile" />
      <Text style={styles.hero}>Welcome to OpenCal</Text>
      <Text style={styles.lead}>
        A calendar that lives on your phone. No account, no ads, no Google services.
      </Text>
    </View>,
    <FeaturePage key="adding" title="Add events your way" features={ADDING} />,
    <FeaturePage key="different" title="Things most calendars don’t do" features={DIFFERENT} />,
    <View key="yours" style={styles.page}>
      <Text style={styles.title}>Pick a look</Text>
      <Segmented<ThemeMode>
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        value={themeMode}
        onChange={setThemeMode}
      />
      {notificationsSupported ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.featureIcon}>
              <Icon name={status === 'granted' ? 'bell-ring' : 'bell'} size={22} color={colors.primary} />
            </View>
            <Text style={styles.featureTitle}>Reminders</Text>
          </View>
          <Text style={styles.featureText}>
            {status === 'granted'
              ? 'Notifications are on.'
              : status === 'denied'
                ? 'Notifications are blocked. Allow them for OpenCal in your phone’s settings.'
                : 'Allow notifications so reminders and alarms can reach you.'}
          </Text>
          {status !== 'granted' && status !== 'denied' ? (
            <Button title={asking ? 'Asking…' : 'Allow notifications'} variant="secondary" disabled={asking} onPress={askForReminders} />
          ) : null}
        </View>
      ) : null}
    </View>,
    <View key="start" style={styles.page}>
      <Text style={styles.title}>Bring your calendar along</Text>
      <ChoiceCard
        icon="calendar"
        title="Import events"
        text="From Google Calendar, Apple Calendar or Outlook (.ics files), or restore an OpenCal backup."
        onPress={() => finish('ImportExport')}
      />
      <ChoiceCard
        icon="repeat"
        title="Sync with your own server"
        text="Keep several devices in step, and let an AI assistant add events for you."
        onPress={() => finish('Sync')}
      />
    </View>,
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        {!last ? (
          <Pressable accessibilityRole="button" onPress={() => finish()} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : null}
      </View>
      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: Platform.OS !== 'web' })}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))}
        // Web has no momentum events: settle the page from the scroll position instead.
        onScrollEndDrag={Platform.OS === 'web' ? (e) => setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width))) : undefined}
      >
        {pages.map((content, i) => (
          <ScrollView key={i} style={{ width }} contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.column}>{content}</View>
          </ScrollView>
        ))}
      </Animated.ScrollView>
      <View style={styles.bottomBar}>
        <View style={styles.dots} accessibilityRole="adjustable" accessibilityLabel={`Page ${page + 1} of ${PAGE_COUNT}`}>
          {pages.map((_, i) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            const grow = scrollX.interpolate({ inputRange: range, outputRange: [1, 2.6, 1], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return (
              <Pressable key={i} onPress={() => goTo(i)} hitSlop={6} accessibilityLabel={`Go to page ${i + 1}`}>
                <Animated.View style={[styles.dot, { opacity, transform: [{ scaleX: grow }] }]} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.column}>
          <Button title={last ? 'Start with an empty calendar' : page === 0 ? 'Get started' : 'Next'} onPress={() => (last ? finish() : goTo(page + 1))} />
        </View>
      </View>
    </View>
  );
}

function FeaturePage({ title, features }: { title: string; features: Feature[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.page}>
      <Text style={styles.title}>{title}</Text>
      {features.map((f) => (
        <View key={f.title} style={styles.feature}>
          <View style={styles.featureIcon}>
            <Icon name={f.icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.featureBody}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ChoiceCard({ icon, title, text, onPress }: { icon: IconName; title: string; text: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={0.98} style={[styles.card, styles.choice]}>
      <View style={styles.featureIcon}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.featureBody}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.textFaint} />
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { height: 48, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing.xl },
  skip: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  pressed: { opacity: 0.5 },
  pager: { flex: 1 },
  pageScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  page: { gap: spacing.lg },
  centerPage: { alignItems: 'center', gap: spacing.lg },
  hero: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  lead: { fontSize: 17, lineHeight: 25, color: colors.textMuted, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text },
  feature: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBody: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  featureText: { fontSize: 15, lineHeight: 21, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bottomBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
}));
