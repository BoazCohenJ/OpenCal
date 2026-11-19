import React, { useState } from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button, Divider, Section, SwitchRow } from '../components/ui';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { getWidgetSettings, setWidgetSettings, widgetChoices, type WidgetSettings } from './data';

/** Labels as the launcher's widget list shows them (app.json → widgets → label). */
const WIDGET_LABELS: Record<string, string> = { Schedule: 'Schedule', Day: 'Today', Week: 'Week', Month: 'Month' };

/**
 * One widget's settings: which calendars it shows and whether folded calendars stay folded. Used by
 * Android's widget configuration window (WidgetConfigScreen) and, for widgets added from the app's
 * Settings, by the in-app WidgetSettings screen. It reads straight from the database, since the
 * configuration window runs outside the app's data context.
 */
export function WidgetSettingsForm({
  widgetName,
  widgetId,
  embedded = false,
  onSaved,
  onCancel,
}: {
  widgetName: string;
  widgetId: number;
  /** Inside the app, under a navigation header: no big title, no status bar or top inset. */
  embedded?: boolean;
  /** Called after the settings are stored, to redraw the widget and close. */
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [choices] = useState(widgetChoices);
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<WidgetSettings>(() => getWidgetSettings(widgetId));
  const followApp = !settings.calendarIds;
  const appShown = choices.calendars.filter((c) => !choices.hidden.includes(c.id)).map((c) => c.id);
  const picked = settings.calendarIds ?? appShown;
  const anyFolded = choices.calendars.some((c) => c.folded && picked.includes(c.id));

  const toggle = (id: string) =>
    setSettings((s) => {
      const current = s.calendarIds ?? appShown;
      return { ...s, calendarIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] };
    });

  const save = () => {
    setWidgetSettings(widgetId, settings);
    onSaved();
  };

  return (
    <View style={[styles.screen, { paddingTop: embedded ? 0 : insets.top, paddingBottom: insets.bottom }]}>
      {embedded ? null : <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{WIDGET_LABELS[widgetName] ?? widgetName} widget</Text>
        {embedded ? null : <Text style={styles.title}>Widget settings</Text>}
        <Text style={styles.lead}>These apply to this widget only. Change them later in OpenCal’s Settings, or by long-pressing the widget.</Text>

        <Section title="Calendars">
          <SwitchRow
            label="Same as the app"
            subtitle="Follows Show and Hide in the app's View menu"
            value={followApp}
            onValueChange={(on) => setSettings((s) => ({ ...s, calendarIds: on ? undefined : appShown }))}
          />
          {followApp ? null : (
            <>
              <Divider />
              {choices.calendars.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggle(c.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
                  >
                    <View style={[styles.box, { borderColor: c.color, backgroundColor: on ? c.color : 'transparent' }]}>
                      {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                    <Text style={[styles.rowName, !on && styles.rowNameOff]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.folded ? <Text style={styles.badge}>Folded</Text> : null}
                  </Pressable>
                );
              })}
            </>
          )}
        </Section>

        <Section
          title="Folded calendars"
          footer={
            anyFolded
              ? 'Folded calendars show one block per day, like on the calendar.'
              : 'None of the calendars on this widget is folded right now. Turn folding on in a calendar’s settings.'
          }
        >
          <SwitchRow
            label="Show all events"
            subtitle="Don't fold calendars into one block on this widget"
            value={!!settings.showAll}
            onValueChange={(showAll) => setSettings((s) => ({ ...s, showAll: showAll || undefined }))}
          />
        </Section>
      </ScrollView>
      <View style={styles.actions}>
        <Button variant="secondary" title="Cancel" onPress={onCancel} style={styles.action} />
        <Button title="Save" onPress={save} disabled={!followApp && picked.length === 0} style={styles.action} />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  kicker: { fontFamily: fonts.displayItalic, fontSize: 16, color: colors.primary },
  title: { fontFamily: fonts.displayBold, fontSize: 32, color: colors.text, marginTop: 2 },
  lead: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: spacing.lg },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowName: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  rowNameOff: { color: colors.textMuted },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingTop: spacing.sm },
  action: { flex: 1 },
}));
