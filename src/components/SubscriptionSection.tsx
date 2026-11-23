import { formatDistanceToNow } from 'date-fns';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Calendar, CalendarSubscription } from '../models/Calendar';
import { createStyles, spacing, useTheme } from '../theme';
import { useRefreshSubscription, useSubscriptionStatuses } from './SubscriptionWatcher';
import { Button, Divider, Field, Section, Segmented, TextField } from './ui';

const REFRESH_CHOICES = ['1', '6', '12', '24'] as const;
const refreshLabel = (h: string) => (h === '1' ? 'Hourly' : h === '24' ? 'Daily' : `${h} hours`);
const nearestChoice = (hours: number) =>
  REFRESH_CHOICES.reduce((best, h) => (Math.abs(Number(h) - hours) < Math.abs(Number(best) - hours) ? h : best), REFRESH_CHOICES[0]);

/**
 * The feed address and refresh settings of a subscribed calendar, in the calendar editor. `calendar`
 * is the saved calendar (undefined while it's being created), for its refresh status.
 */
export function SubscriptionSection({
  calendar,
  value,
  onChange,
  onStop,
  autoFocus,
}: {
  calendar?: Calendar;
  value: CalendarSubscription;
  onChange: (value: CalendarSubscription) => void;
  onStop: () => void;
  autoFocus?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const statuses = useSubscriptionStatuses();
  const refresh = useRefreshSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const status = calendar ? statuses[calendar.id] : undefined;
  const saved = calendar?.subscription;

  const refreshNow = () => {
    if (!calendar || !saved) return;
    setRefreshing(true);
    refresh(calendar)
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };

  let statusText: string | null = null;
  if (refreshing) statusText = 'Refreshing…';
  else if (status?.error) statusText = status.error;
  else if (status?.refreshedAt) {
    statusText = `${status.count ?? 0} event${status.count === 1 ? '' : 's'} · updated ${formatDistanceToNow(status.refreshedAt, { addSuffix: true })}`;
  } else if (saved) statusText = 'Not loaded yet';

  return (
    <Section
      title="Subscription"
      footer="Events come from this address and update on their own. Changes you make to their title or time are replaced on the next refresh; reminders, alarms, colors, icons and pauses you add are kept."
    >
      <Field label="Calendar address">
        <TextField
          value={value.url}
          onChangeText={(url) => onChange({ ...value, url })}
          placeholder="https://… or webcal://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          autoFocus={autoFocus}
        />
      </Field>
      <Divider />
      <Text style={styles.subhead}>Refresh</Text>
      <View style={styles.segmentWrap}>
        <Segmented
          options={REFRESH_CHOICES.map((h) => ({ value: h, label: refreshLabel(h) }))}
          value={nearestChoice(value.refreshHours)}
          onChange={(h) => onChange({ ...value, refreshHours: Number(h) })}
        />
      </View>
      {statusText ? (
        <Text style={[styles.status, status?.error && !refreshing ? { color: colors.danger } : null]}>{statusText}</Text>
      ) : null}
      {calendar ? (
        <View style={styles.actions}>
          {saved ? <Button small variant="secondary" title="Refresh now" onPress={refreshNow} disabled={refreshing} /> : null}
          <Button small variant="ghost" title="Stop subscribing" onPress={onStop} />
        </View>
      ) : null}
    </Section>
  );
}

const useStyles = createStyles((colors) => ({
  subhead: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  segmentWrap: { padding: spacing.md },
  status: { fontSize: 13, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexWrap: 'wrap' },
}));
